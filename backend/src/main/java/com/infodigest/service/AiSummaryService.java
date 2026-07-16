package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 摘要服务：调用 DeepSeek API 对信息源生成摘要、评分和分类
 */
@Service
public class AiSummaryService {

    @Value("${ai.deepseek.api-url}")
    private String apiUrl;

    @Value("${ai.deepseek.api-key}")
    private String apiKey;

    @Value("${ai.deepseek.model}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(60))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 为单条信息源生成 AI 摘要
     * @return true 表示生成成功
     */
    public boolean generateSummary(InformationItem item) {
        try {
            String prompt = buildPrompt(item);
            String response = callDeepSeek(prompt);
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
    private String callDeepSeek(String prompt) throws Exception {
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
}
