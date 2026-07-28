package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.AIConfig;
import com.infodigest.entity.Concept;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ItemConcept;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.ConceptRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.security.CredentialCryptoService;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
public class KeywordService {
    @Autowired
    private CredentialCryptoService credentialCryptoService;

    @Autowired
    private ConceptRepository conceptRepository;

    @Autowired
    private ItemConceptRepository itemConceptRepository;

    @Autowired
    private AIConfigRepository aiConfigRepository;

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Value("${ai.deepseek.api-url}")
    private String defaultApiUrl;

    @Value("${ai.deepseek.api-key}")
    private String defaultApiKey;

    @Value("${ai.deepseek.model}")
    private String defaultModel;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(60))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Data
    public static class KeywordSuggestion {
        private String label;
        private boolean isNew;
        private boolean isSelected = true;
        private boolean highlighted = true;
        private Double confidence;
        private String reason;
    }

    @Async
    @Transactional
    public void analyzeAndApplyKeywordsAsync(InformationItem item, String userNote) {
        log.info("[KeywordService] 异步生成关键词: {}", item.getTitle());
        try {
            List<KeywordSuggestion> keywords = analyzeKeywords(item, userNote);
            if (keywords != null && !keywords.isEmpty()) {
                applyKeywords(item.getId(), item.getUserId(), keywords);
                log.info("[KeywordService] ✅ 完成关键词生成: {}", keywords.stream().map(KeywordSuggestion::getLabel).collect(Collectors.joining(", ")));
            } else {
                log.warn("[KeywordService] ⚠️ 生成关键词为空");
            }
        } catch (Exception e) {
            log.error("[KeywordService] ❌ 生成关键词失败: {}", item.getTitle(), e);
        }
    }

    public List<KeywordSuggestion> analyzeKeywords(InformationItem item, String userNote) {
        try {
            String apiUrl = defaultApiUrl;
            String apiKey = defaultApiKey;
            String model = defaultModel;

            if (item.getUserId() != null) {
                Optional<AIConfig> userConfig = aiConfigRepository.findByUserId(item.getUserId());
                if (userConfig.isPresent()) {
                    AIConfig config = userConfig.get();
                    // 兼容旧数据：读取时去除首尾空格
                    if (config.getApiEndpoint() != null && !config.getApiEndpoint().isEmpty()) apiUrl = config.getApiEndpoint().trim();
                    if (config.getApiKey() != null && !config.getApiKey().isEmpty()) {
                        apiKey = credentialCryptoService.decrypt(config.getApiKey()).trim();
                    }
                    if (config.getCustomModelName() != null && !config.getCustomModelName().isEmpty()) model = config.getCustomModelName().trim();
                }
            }

            List<Concept> existingConcepts = conceptRepository.findByUserId(item.getUserId());
            String existingKeywordsStr = existingConcepts.stream()
                    .map(Concept::getLabel)
                    .collect(Collectors.joining(", "));

            log.info("[KeywordService] 分析关键词: title='{}', contentLength={}, note='{}'",
                    item.getTitle(),
                    item.getContentRaw() != null ? item.getContentRaw().length() : 0,
                    userNote != null ? userNote.substring(0, Math.min(50, userNote.length())) : "null");

            String prompt = buildKeywordPrompt(item, userNote, existingKeywordsStr)
                    + "\nEach keyword object MUST also include confidence (0.0-1.0) and a short reason grounded in the source text. "
                    + "Avoid assigning a category based only on superficial title words.";
            String response = callDeepSeek(prompt, apiUrl, apiKey, model);
            
            List<KeywordSuggestion> result = parseKeywordResponse(response);
            log.info("[KeywordService] 返回 {} 个关键词: {}", result.size(),
                    result.stream().map(k -> k.getLabel() + (k.isSelected() ? "✓" : "")).collect(Collectors.joining(", ")));
            return result;

        } catch (Exception e) {
            log.error("[KeywordService] 分析关键词失败 item={}, title='{}': {}", item.getId(), item.getTitle(), e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    private String buildKeywordPrompt(InformationItem item, String note, String existingKeywords) {
        String title = item.getTitle() != null ? item.getTitle() : "无标题";

        // 优先使用 AI 摘要（已经基于完整字幕内容生成），其次才使用原始内容
        String content = "";
        if (item.getAiSummary() != null && !item.getAiSummary().isEmpty()) {
            content = item.getAiSummary();
            log.debug("[KeywordService] 使用 AI 摘要提取关键词 (长度: {})", content.length());
        } else if (item.getContentRaw() != null && !item.getContentRaw().isEmpty()) {
            content = item.getContentRaw();
            if (content.length() > 2000) content = content.substring(0, 2000) + "...";
            log.debug("[KeywordService] 使用原始内容提取关键词 (长度: {})", content.length());
        } else {
            log.warn("[KeywordService] 既无 AI 摘要也无原始内容，将仅基于标题提取关键词: {}", title);
        }

        String userNote = note != null ? note : "";

        // 当内容为空时，提示 AI 基于标题推断
        String contentSection;
        if (content.isEmpty() && userNote.isEmpty()) {
            contentSection = "信息源标题：" + title + "\n"
                    + "信息源内容：（无正文内容，请完全基于标题进行推断）\n"
                    + "用户笔记：（无笔记）\n\n";
        } else {
            contentSection = "信息源标题：" + title + "\n"
                    + "信息源内容：" + (content.isEmpty() ? "（无正文内容，请基于标题和笔记推断）" : content) + "\n"
                    + "用户笔记：" + (userNote.isEmpty() ? "（无笔记）" : userNote) + "\n\n";
        }

        return "你是一个内容关键词提取专家。请根据以下信息源的标题、内容和用户笔记，推荐最相关的领域关键词。\n\n"
                + "关键词要求：\n"
                + "- 2-4 个字的简洁中文短语\n"
                + "- 反映信息源的核心主题、价值或打动用户的关键点\n"
                + "- 可以是具体主题（如\"微服务架构\"）也可以是抽象概念（如\"认知升级\"、\"生命力\"）\n\n"
                + "用户当前已有的关键词列表：\n[" + existingKeywords + "]\n\n"
                + "规则（非常重要）：\n"
                + "1. 优先考虑从上述已有列表中选择合适的关键词，但**绝不要仅仅为了匹配而引入不相关的已有领域**。宁缺毋滥。\n"
                + "2. 如果已有列表中没有合适的，可以造新关键词。避免造出与已有关键词含义重叠的新词。\n"
                + "3. 返回 2 到 5 个最相关的关键词（具体数量由你根据内容的丰富度自主决定，不相关的不写）。\n"
                + "4. 在你返回的关键词中，你需要评估它们的相关度。将最核心、最能代表该信息的领域（通常 1-3 个）的 isSelected 设为 true。稍微次要或延伸的领域，作为备选推荐，isSelected 设为 false。\n"
                + "5. **即使信息很少（比如只有标题），你也必须至少返回 2 个关键词。**不允许返回空数组。\n\n"
                + contentSection
                + "请严格返回 JSON（不要 markdown 代码块标记）：\n"
                + "{\n"
                + "  \"keywords\": [\n"
                + "    {\"label\": \"核心领域名称\", \"isNew\": false, \"isSelected\": true},\n"
                + "    {\"label\": \"次要领域名称\", \"isNew\": true, \"isSelected\": false}\n"
                + "  ]\n"
                + "}";
    }

    private String callDeepSeek(String prompt, String apiUrl, String apiKey, String model) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 8192);
        body.put("messages", List.of(
                Map.of("role", "system", "content", "你是一个内容关键词提取专家，返回纯 JSON，不要用 markdown 代码块包裹。"),
                Map.of("role", "user", "content", prompt)
        ));

        String jsonBody = objectMapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("API 返回 " + response.statusCode() + ": " + response.body());
        }
        return response.body();
    }

    @SuppressWarnings("unchecked")
    private List<KeywordSuggestion> parseKeywordResponse(String responseBody) throws Exception {
        log.info("[KeywordService] 原始 API 响应: {}", responseBody);

        Map<String, Object> root = objectMapper.readValue(responseBody, Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
        if (choices == null || choices.isEmpty()) throw new RuntimeException("无 choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) throw new RuntimeException("无 message");
        String content = (String) message.get("content");
        if (content == null) throw new RuntimeException("无 content");

        content = content.trim();
        log.info("[KeywordService] DeepSeek returned content: {}", content);
        
        if (content.isEmpty()) {
            log.warn("[KeywordService] API 返回了空的 content，可能遭遇模型输出截断或审核过滤");
            return new ArrayList<>();
        }

        // 1. 去除 markdown 代码块标记
        if (content.startsWith("```json")) {
            content = content.substring(7);
        } else if (content.startsWith("```")) {
            content = content.substring(3);
        }
        if (content.endsWith("```")) {
            content = content.substring(0, content.length() - 3);
        }
        content = content.trim();

        // 2. 提取 JSON 对象
        int startIdx = content.indexOf("{");
        int endIdx = content.lastIndexOf("}");
        if (startIdx >= 0 && endIdx > startIdx) {
            content = content.substring(startIdx, endIdx + 1);
        } else if (startIdx >= 0 && endIdx < startIdx) {
            // JSON 不完整（只有 { 没有 }），尝试修复
            log.warn("[KeywordService] JSON 不完整，尝试从 keywords 数组中提取数据");
            // 尝试找到最后一个完整的 } 并补全
            String partial = content.substring(startIdx);
            // 检查是否有 "keywords" 数组中的完整元素
            if (partial.contains("\"label\"")) {
                // 尝试补全 JSON
                if (!partial.endsWith("}")) {
                    partial = partial + "]}";
                }
                content = partial;
                log.info("[KeywordService] 尝试修复后的 JSON: {}", content);
            } else {
                throw new RuntimeException("AI 返回内容中 JSON 不完整，无法提取关键词: " + content);
            }
        } else {
            throw new RuntimeException("AI 返回内容中未找到 JSON 对象: " + content);
        }

        // 3. 解析 JSON
        Map<String, Object> parsed;
        try {
            parsed = objectMapper.readValue(content, Map.class);
        } catch (Exception e) {
            log.error("[KeywordService] JSON 解析失败, 原文: {}", content);
            throw new RuntimeException("AI 返回的 JSON 格式无法解析: " + e.getMessage());
        }

        List<Map<String, Object>> keywordsList = (List<Map<String, Object>>) parsed.get("keywords");
        
        List<KeywordSuggestion> result = new ArrayList<>();
        if (keywordsList != null) {
            for (Map<String, Object> kw : keywordsList) {
                KeywordSuggestion suggestion = new KeywordSuggestion();
                suggestion.setLabel((String) kw.get("label"));
                suggestion.setNew(Boolean.TRUE.equals(kw.get("isNew")));
                Object isSelectedObj = kw.get("isSelected");
                suggestion.setSelected(isSelectedObj == null || Boolean.TRUE.equals(isSelectedObj));
                Object confidence = kw.get("confidence");
                if (confidence instanceof Number) {
                    suggestion.setConfidence(Math.max(0.0, Math.min(1.0, ((Number) confidence).doubleValue())));
                }
                suggestion.setReason(kw.get("reason") instanceof String ? (String) kw.get("reason") : null);
                result.add(suggestion);
            }
        }
        return result;
    }

    @Transactional
    public void applyKeywords(Long itemId, Long userId, List<KeywordSuggestion> keywords) {
        // 先删除已有的映射
        List<ItemConcept> existingMappings = itemConceptRepository.findByItemId(itemId);
        if (!existingMappings.isEmpty()) {
            itemConceptRepository.deleteByItemId(itemId);
        }

        String[] defaultColors = {"#10B981", "#0EA5E9", "#F59E0B", "#F43F5E", "#8B5CF6", "#EC4899", "#3B82F6"};

        for (KeywordSuggestion kw : keywords) {
            String label = kw.getLabel();
            if (label == null || label.trim().isEmpty()) continue;
            label = label.trim();

            Optional<Concept> existingConcept = conceptRepository.findByUserIdAndLabel(userId, label);
            Concept concept;
            if (existingConcept.isPresent()) {
                concept = existingConcept.get();
            } else {
                concept = new Concept();
                concept.setUserId(userId);
                concept.setName(label);
                concept.setLabel(label);
                // Assign a random color from the list
                concept.setColor(defaultColors[Math.abs(label.hashCode()) % defaultColors.length]);
                concept = conceptRepository.save(concept);
            }

            ItemConcept mapping = new ItemConcept();
            mapping.setItemId(itemId);
            mapping.setConceptId(concept.getId());
            mapping.setConfidence(kw.getConfidence());
            mapping.setReason(kw.getReason());
            itemConceptRepository.save(mapping);
        }
    }
}
