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
import org.springframework.transaction.support.TransactionTemplate;

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

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

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
    @Async("aiSummaryExecutor")
    public void generateSummaryAsync(InformationItem item) {
        // 分隔一下异步线程的输出，避免日志混杂
        System.out.println("[AiSummary] 异步生成摘要: " + item.getTitle());
        boolean ok = generateSummary(item);
        if (ok) {
            // 使用编程式事务，因为 @Async 和 @Transactional 不能直接一起工作
            TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
            transactionTemplate.executeWithoutResult(status -> {
                // 使用局部更新，仅更新 AI 摘要相关字段，避免覆盖用户手动标记的 isPremium 等字段
                informationItemRepository.updateAiSummaryFields(
                        item.getId(),
                        item.getAiSummary(),
                        item.getKnowledgeScore(),
                        item.getScoreReasoning(),
                        item.getCategory(),
                        LocalDateTime.now()
                );
            });
            System.out.println("[AiSummary] ✅ 完成: " + item.getTitle()
                    + " | 评分=" + item.getKnowledgeScore());
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
                    // 兼容旧数据：读取时去除首尾空格，避免 DeepSeek/LiteLLM 鉴权失败
                    if (config.getApiEndpoint() != null && !config.getApiEndpoint().isEmpty()) {
                        apiUrl = config.getApiEndpoint().trim();
                    }
                    if (config.getApiKey() != null && !config.getApiKey().isEmpty()) {
                        apiKey = config.getApiKey().trim();
                    }
                    if (config.getCustomModelName() != null && !config.getCustomModelName().isEmpty()) {
                        model = config.getCustomModelName().trim();
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

        // 不再截断内容，支持完整字幕分析

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
                + "  \"scoreReasoning\": \"一句话说明打分理由（如：硬核技术教程，清晰讲解架构原理）\"\n"
                + "}";
    }

    /**
     * 调用 DeepSeek Chat API
     */
    private String callDeepSeek(String prompt, String apiUrl, String apiKey, String model) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        body.put("max_tokens", 100000);
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

        // 用花括号计数法精确提取 JSON 对象
        int braceDepth = 0;
        int jsonStart = -1;
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (c == '{') {
                if (braceDepth == 0) jsonStart = i;
                braceDepth++;
            } else if (c == '}') {
                braceDepth--;
                if (braceDepth == 0 && jsonStart >= 0) {
                    content = content.substring(jsonStart, i + 1);
                    break;
                }
            }
        }

        // 清除字符串值中非法的反斜杠转义（如 \'），保留合法转义
        StringBuilder sb = new StringBuilder();
        boolean inString = false;
        boolean escaped = false;
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (!inString) {
                if (c == '"') { inString = true; escaped = false; sb.append(c); }
                else { sb.append(c); }
            } else {
                if (escaped) {
                    if (c == '"' || c == '\\' || c == '/' ||
                        c == 'b' || c == 'f' || c == 'n' ||
                        c == 'r' || c == 't' || c == 'u') {
                        sb.append('\\').append(c);
                    } else {
                        sb.append(c);
                    }
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                    sb.append(c);
                } else {
                    sb.append(c);
                }
            }
        }
        content = sb.toString();

        return objectMapper.readValue(content, Map.class);
    }

    // Removed ensureConceptMapping and getCategoryColor
}
