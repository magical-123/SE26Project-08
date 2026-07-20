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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * AI 摘要服务：调用 DeepSeek API 对信息源生成摘要、评分和分类
 */
@Service
public class AiSummaryService {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private ConceptRepository conceptRepository;

    @Autowired
    private ItemConceptRepository itemConceptRepository;

    @Autowired
    private AIConfigRepository aiConfigRepository;

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

    /**
     * 异步为非空摘要的条目生成 AI 摘要
     */
    @Async
    public void generateSummaryAsync(InformationItem item) {
        // 分隔一下异步线程的输出，避免日志混杂
        System.out.println("[AiSummary] 异步生成摘要: " + item.getTitle());
        boolean ok = generateSummary(item);
        if (ok) {
            // 使用局部更新，仅更新 AI 摘要相关字段，避免覆盖用户手动标记的 isPremium 等字段
            informationItemRepository.updateAiSummaryFields(
                    item.getId(),
                    item.getAiSummary(),
                    item.getKnowledgeScore(),
                    item.getScoreReasoning(),
                    item.getCategory(),
                    LocalDateTime.now()
            );
            System.out.println("[AiSummary] ✅ 完成: " + item.getTitle()
                    + " | 评分=" + item.getKnowledgeScore()
                    + " | 分类=" + item.getCategory());
        } else {
            System.out.println("[AiSummary] ❌ 失败: " + item.getTitle());
        }
    }

    /**
     * 为单条信息源生成 AI 摘要
     * 优先使用用户自己的 AI 配置，找不到则使用默认配置
     * @return true 表示生成成功
     */
    public boolean generateSummary(InformationItem item) {
        try {
            // 优先查找用户自己的 AI 配置
            String apiUrl = defaultApiUrl;
            String apiKey = defaultApiKey;
            String model = defaultModel;

            if (item.getUserId() != null) {
                Optional<AIConfig> userConfig = aiConfigRepository.findByUserId(item.getUserId());
                if (userConfig.isPresent()) {
                    AIConfig config = userConfig.get();
                    if (config.getApiEndpoint() != null && !config.getApiEndpoint().isEmpty()) {
                        apiUrl = config.getApiEndpoint();
                    }
                    if (config.getApiKey() != null && !config.getApiKey().isEmpty()) {
                        apiKey = config.getApiKey();
                    }
                    if (config.getCustomModelName() != null && !config.getCustomModelName().isEmpty()) {
                        model = config.getCustomModelName();
                    }
                    System.out.println("[AiSummary] 使用用户 " + item.getUserId() + " 的 AI 配置: model=" + model);
                } else {
                    System.out.println("[AiSummary] 用户 " + item.getUserId() + " 未配置 AI，使用默认配置");
                }
            }

            String prompt = buildPrompt(item);
            String response = callDeepSeek(prompt, apiUrl, apiKey, model);
            Map<String, Object> result = parseResponse(response);

            // 更新 entity 字段
            if (result.containsKey("summary")) {
                item.setAiSummary((String) result.get("summary"));
            }
            if (result.containsKey("knowledgeScore")) {
                item.setKnowledgeScore(((Number) result.get("knowledgeScore")).intValue());
            }
            if (result.containsKey("scoreReasoning")) {
                item.setScoreReasoning((String) result.get("scoreReasoning"));
            }
            if (result.containsKey("category")) {
                item.setCategory((String) result.get("category"));
            }

            // 自动创建概念映射：根据 AI 分类将信息源关联到对应概念
            ensureConceptMapping(item);

            return true;
        } catch (Exception e) {
            System.err.println("[AiSummary] 生成摘要失败: " + item.getTitle() + " - " + e.getMessage());
            return false;
        }
    }

    /**
     * 组装 Prompt
     */
    private String buildPrompt(InformationItem item) {
        String title = item.getTitle() != null ? item.getTitle() : "无标题";
        String content = item.getContentRaw() != null ? item.getContentRaw() : "";
        String platform = item.getPlatform() != null ? item.getPlatform() : "未知";

        // 截断过长的内容
        if (content.length() > 3000) {
            content = content.substring(0, 3000) + "...";
        }

        return "你是一个信息营养分析师。请阅读以下来自「" + platform + "」的内容，\n"
                + "先判断内容是否属于「娱乐短剧」类（包括但不限于：生活日常、八卦闲聊、搞笑段子、穿搭美妆、\n"
                + "明星娱乐、游戏实况、纯颜值、情感吐槽、人设滤镜），若属于娱乐类，摘要只需简短一句（如\n"
                + "「一条生活日常分享」「一则搞笑娱乐内容」）。\n"
                + "非娱乐类内容请认真提炼核心观点和知识价值。\n\n"
                + "标题：" + title + "\n"
                + "正文：" + content + "\n\n"
                + "请严格返回一个 JSON 对象（不要多余文字、不要 markdown 代码块标记）：\n"
                + "{\n"
                + "  \"summary\": \"30-80字中文摘要，娱乐内容可短至10-20字\",\n"
                + "  \"knowledgeScore\": 从 0 到 100 的知识含量评分，娱乐类 0-20，实用技巧/资讯 40-60，深度知识/科普 60-100,\n"
                + "  \"scoreReasoning\": \"一句话说明打分理由（如：硬核技术教程，清晰讲解架构原理）\",\n"
                + "  \"category\": \"深度知识|行业资讯|创意灵感|实用技巧|娱乐科普|娱乐短剧（六选一）\"\n"
                + "}";
    }

    /**
     * 调用 DeepSeek Chat API
     */
    private String callDeepSeek(String prompt, String apiUrl, String apiKey, String model) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 512);
        body.put("messages", List.of(
                Map.of("role", "system", "content", "你是一个信息营养分析师，返回纯 JSON，不要用 markdown 代码块包裹。"),
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
            throw new RuntimeException("DeepSeek API 返回 " + response.statusCode() + ": " + response.body());
        }

        return response.body();
    }

    /**
     * 解析 DeepSeek 返回的 JSON，提取 content 中的 JSON 对象
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseResponse(String responseBody) throws Exception {
        Map<String, Object> root = objectMapper.readValue(responseBody, Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new RuntimeException("DeepSeek 返回无 choices");
        }

        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) {
            throw new RuntimeException("DeepSeek 返回无 message");
        }

        String content = (String) message.get("content");
        if (content == null) {
            throw new RuntimeException("DeepSeek 返回无 content");
        }

        // 清理可能的 markdown 代码块标记
        content = content.trim();
        if (content.startsWith("```")) {
            content = content.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "");
        }

        return objectMapper.readValue(content, Map.class);
    }

    /**
     * 确保信息项有对应的概念映射（根据 category 字段）
     * 如果概念不存在则自动创建，如果映射不存在则自动建立
     */
    public void ensureConceptMapping(InformationItem item) {
        String category = item.getCategory();
        if (category == null || category.isEmpty()) return;

        Long userId = item.getUserId();
        String conceptName = "cat-" + category;
        String conceptLabel = category;
        String color = getCategoryColor(category);

        // 查找或创建概念
        List<Concept> userConcepts = conceptRepository.findByUserId(userId);
        Concept targetConcept = userConcepts.stream()
                .filter(c -> conceptName.equals(c.getName()))
                .findFirst()
                .orElse(null);

        if (targetConcept == null) {
            // 创建新概念
            Concept newConcept = new Concept();
            newConcept.setUserId(userId);
            newConcept.setName(conceptName);
            newConcept.setLabel(conceptLabel);
            newConcept.setColor(color);
            targetConcept = conceptRepository.save(newConcept);
            System.out.println("[AiSummary] 自动创建概念: " + conceptLabel + " (color=" + color + ")");
        }

        // 检查映射是否已存在，避免重复
        if (itemConceptRepository.findByItemIdAndConceptId(item.getId(), targetConcept.getId()).isEmpty()) {
            ItemConcept mapping = new ItemConcept();
            mapping.setItemId(item.getId());
            mapping.setConceptId(targetConcept.getId());
            itemConceptRepository.save(mapping);
        }
    }

    /**
     * 根据分类返回对应颜色
     */
    private String getCategoryColor(String category) {
        switch (category) {
            case "深度知识": return "#10B981";
            case "行业资讯": return "#F59E0B";
            case "创意灵感": return "#3B82F6";
            case "实用技巧": return "#0EA5E9";
            case "娱乐科普": return "#EC4899";
            case "娱乐短剧": return "#F43F5E";
            default: return "#8B5CF6";
        }
    }
}
