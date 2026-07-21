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
                    if (config.getApiKey() != null && !config.getApiKey().isEmpty()) apiKey = config.getApiKey().trim();
                    if (config.getCustomModelName() != null && !config.getCustomModelName().isEmpty()) model = config.getCustomModelName().trim();
                }
            }

            List<Concept> existingConcepts = conceptRepository.findByUserId(item.getUserId());
            String existingKeywordsStr = existingConcepts.stream()
                    .map(Concept::getLabel)
                    .collect(Collectors.joining(", "));

            String prompt = buildKeywordPrompt(item, userNote, existingKeywordsStr);
            String response = callDeepSeek(prompt, apiUrl, apiKey, model);
            
            return parseKeywordResponse(response);

        } catch (Exception e) {
            log.error("Failed to analyze keywords for item {}", item.getId(), e);
            return new ArrayList<>();
        }
    }

    private String buildKeywordPrompt(InformationItem item, String note, String existingKeywords) {
        String title = item.getTitle() != null ? item.getTitle() : "无标题";
        String content = item.getContentRaw() != null ? item.getContentRaw() : "";
        if (content.length() > 2000) content = content.substring(0, 2000) + "...";
        String userNote = note != null ? note : "";

        return "你是一个内容关键词提取专家。请根据以下信息源的标题、内容和用户笔记，提取 4 个最能概括这条信息源核心价值的关键词。\n\n"
                + "关键词要求：\n"
                + "- 2-4 个字的简洁中文短语\n"
                + "- 反映信息源的核心主题、价值或打动用户的关键点\n"
                + "- 可以是具体主题（如\"微服务架构\"）也可以是抽象概念（如\"认知升级\"、\"生命力\"）\n\n"
                + "用户当前已有的关键词列表：\n[" + existingKeywords + "]\n\n"
                + "规则：\n"
                + "1. 优先从上述已有列表中选择匹配的关键词\n"
                + "2. 如果已有列表中没有合适的，可以建议新关键词\n"
                + "3. 避免创建与已有关键词含义重叠的新关键词（如已有\"前端开发\"就不要再建\"Web前端\"）\n"
                + "4. 返回恰好 4 个关键词\n\n"
                + "信息源标题：" + title + "\n"
                + "信息源内容：" + content + "\n"
                + "用户笔记：" + userNote + "\n\n"
                + "请严格返回 JSON（不要 markdown 代码块标记）：\n"
                + "{\n"
                + "  \"keywords\": [\n"
                + "    {\"label\": \"关键词名称\", \"isNew\": false},\n"
                + "    {\"label\": \"新关键词名称\", \"isNew\": true}\n"
                + "  ]\n"
                + "}";
    }

    private String callDeepSeek(String prompt, String apiUrl, String apiKey, String model) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 512);
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
        Map<String, Object> root = objectMapper.readValue(responseBody, Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
        if (choices == null || choices.isEmpty()) throw new RuntimeException("无 choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) throw new RuntimeException("无 message");
        String content = (String) message.get("content");
        if (content == null) throw new RuntimeException("无 content");

        content = content.trim();
        if (content.startsWith("```")) {
            content = content.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "");
        }

        Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
        List<Map<String, Object>> keywordsList = (List<Map<String, Object>>) parsed.get("keywords");
        
        List<KeywordSuggestion> result = new ArrayList<>();
        if (keywordsList != null) {
            for (Map<String, Object> kw : keywordsList) {
                KeywordSuggestion suggestion = new KeywordSuggestion();
                suggestion.setLabel((String) kw.get("label"));
                suggestion.setNew(Boolean.TRUE.equals(kw.get("isNew")));
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
            itemConceptRepository.save(mapping);
        }
    }
}
