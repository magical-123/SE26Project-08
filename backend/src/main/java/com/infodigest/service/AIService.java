package com.infodigest.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.dto.AnalysisResultDTO;
import com.infodigest.entity.AIConfig;
import com.infodigest.repository.AIConfigRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@Slf4j
public class AIService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Autowired
    private AIConfigRepository aiConfigRepository;

    public AIService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * 生成洞察（返回纯文本，由调用方解析）
     */
    public String generateInsight(String prompt, Long userId) throws Exception {
        // 获取用户的 AI 配置
        AIConfig config = aiConfigRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("用户未配置 AI 模型"));

        return generateInsightWithConfig(prompt, config);
    }

    public String generateInsightWithConfig(String prompt, AIConfig config) throws Exception {
        String modelType = config.getModelType();

        if (modelType.startsWith("GPT")) {
            return callOpenAIForInsight(config, prompt);
        } else if (modelType.startsWith("CLAUDE")) {
            return callClaudeForInsight(config, prompt);
        } else if (modelType.startsWith("GEMINI")) {
            return callGeminiForInsight(config, prompt);
        } else if (modelType.equals("DEEPSEEK") || modelType.equals("QWEN") || modelType.equals("GLM") || modelType.equals("KIMI") || modelType.equals("DOUBAO")) {
            return callCustomModelForInsight(config, prompt);
        } else if (modelType.equals("CUSTOM")) {
            return callCustomModelForInsight(config, prompt);
        } else {
            throw new IllegalArgumentException("Unsupported model type: " + modelType);
        }
    }

    private String callOpenAIForInsight(AIConfig config, String prompt) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://api.openai.com/v1/chat/completions";

        String requestBody = String.format("""
            {
              "model": "%s",
              "messages": [
                {
                  "role": "user",
                  "content": %s
                }
              ],
              "response_format": { "type": "json_object" },
              "temperature": 0.7
            }
            """,
            getOpenAIModelName(config.getModelType()),
            objectMapper.writeValueAsString(prompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + (config.getApiKey() == null ? "" : config.getApiKey().trim()))
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("OpenAI API error: {}", response.body());
            throw new RuntimeException("OpenAI API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        return responseJson.get("choices").get(0).get("message").get("content").asText();
    }

    private String callClaudeForInsight(AIConfig config, String prompt) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://api.anthropic.com/v1/messages";

        String requestBody = String.format("""
            {
              "model": "%s",
              "temperature": 0.3,
              "max_tokens": 8192,
              "messages": [
                {
                  "role": "user",
                  "content": %s
                }
              ]
            }
            """,
            getClaudeModelName(config.getModelType()),
            objectMapper.writeValueAsString(prompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("x-api-key", config.getApiKey() == null ? "" : config.getApiKey().trim())
                .header("anthropic-version", "2023-06-01")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Claude API error: {}", response.body());
            throw new RuntimeException("Claude API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        return responseJson.get("content").get(0).get("text").asText();
    }

    private String callGeminiForInsight(AIConfig config, String prompt) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

        String requestBody = String.format("""
            {
              "contents": [{
                "parts": [{
                  "text": %s
                }]
              }]
            }
            """,
            objectMapper.writeValueAsString(prompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint + "?key=" + (config.getApiKey() == null ? "" : config.getApiKey().trim())))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Gemini API error: {}", response.body());
            throw new RuntimeException("Gemini API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        return responseJson.get("candidates").get(0).get("content").get("parts").get(0).get("text").asText();
    }

    private String callCustomModelForInsight(AIConfig config, String prompt) throws Exception {
        String requestBody = String.format("""
            {
              "model": "%s",
              "messages": [
                {
                  "role": "user",
                  "content": %s
                }
              ]
            }
            """,
            config.getCustomModelName(),
            objectMapper.writeValueAsString(prompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getApiEndpoint()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + (config.getApiKey() == null ? "" : config.getApiKey().trim()))
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Custom model API error: {}", response.body());
            throw new RuntimeException("Custom model API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        return responseJson.get("choices").get(0).get("message").get("content").asText();
    }

    public AnalysisResultDTO analyze(AIConfig config, String systemPrompt, String userContent) throws Exception {
        String modelType = config.getModelType();

        if (modelType.startsWith("GPT")) {
            return callOpenAI(config, systemPrompt, userContent);
        } else if (modelType.startsWith("CLAUDE")) {
            return callClaude(config, systemPrompt, userContent);
        } else if (modelType.startsWith("GEMINI")) {
            return callGemini(config, systemPrompt, userContent);
        } else if (modelType.equals("DEEPSEEK") || modelType.equals("QWEN") || modelType.equals("GLM") || modelType.equals("KIMI") || modelType.equals("DOUBAO")) {
            return callCustomModel(config, systemPrompt, userContent);
        } else if (modelType.equals("CUSTOM")) {
            return callCustomModel(config, systemPrompt, userContent);
        } else {
            throw new IllegalArgumentException("Unsupported model type: " + modelType);
        }
    }

    private AnalysisResultDTO callOpenAI(AIConfig config, String systemPrompt, String userContent) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://api.openai.com/v1/chat/completions";

        String requestBody = String.format("""
            {
              "model": "%s",
              "messages": [
                {
                  "role": "system",
                  "content": %s
                },
                {
                  "role": "user",
                  "content": %s
                }
              ],
              "response_format": { "type": "json_object" },
              "temperature": 0.3
            }
            """,
            getOpenAIModelName(config.getModelType()),
            objectMapper.writeValueAsString(systemPrompt),
            objectMapper.writeValueAsString(userContent)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + (config.getApiKey() == null ? "" : config.getApiKey().trim()))
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("OpenAI API error: {}", response.body());
            throw new RuntimeException("OpenAI API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        String content = responseJson.get("choices").get(0).get("message").get("content").asText();

        return parseAnalysisResult(content);
    }

    private AnalysisResultDTO callClaude(AIConfig config, String systemPrompt, String userContent) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://api.anthropic.com/v1/messages";

        String requestBody = String.format("""
            {
              "model": "%s",
              "max_tokens": 1024,
              "system": %s,
              "messages": [
                {
                  "role": "user",
                  "content": %s
                }
              ]
            }
            """,
            getClaudeModelName(config.getModelType()),
            objectMapper.writeValueAsString(systemPrompt),
            objectMapper.writeValueAsString(userContent)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .header("x-api-key", config.getApiKey() == null ? "" : config.getApiKey().trim())
                .header("anthropic-version", "2023-06-01")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Claude API error: {}", response.body());
            throw new RuntimeException("Claude API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        String content = responseJson.get("content").get(0).get("text").asText();

        return parseAnalysisResult(content);
    }

    private AnalysisResultDTO callGemini(AIConfig config, String systemPrompt, String userContent) throws Exception {
        String endpoint = config.getApiEndpoint() != null ? config.getApiEndpoint() : "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

        String combinedPrompt = systemPrompt + "\n\n" + userContent;

        String requestBody = String.format("""
            {
              "contents": [{
                "parts": [{
                  "text": %s
                }]
              }]
            }
            """,
            objectMapper.writeValueAsString(combinedPrompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint + "?key=" + (config.getApiKey() == null ? "" : config.getApiKey().trim())))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Gemini API error: {}", response.body());
            throw new RuntimeException("Gemini API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        String content = responseJson.get("candidates").get(0).get("content").get("parts").get(0).get("text").asText();

        return parseAnalysisResult(content);
    }

    private AnalysisResultDTO callCustomModel(AIConfig config, String systemPrompt, String userContent) throws Exception {
        String requestBody = String.format("""
            {
              "model": "%s",
              "messages": [
                {
                  "role": "system",
                  "content": %s
                },
                {
                  "role": "user",
                  "content": %s
                }
              ]
            }
            """,
            config.getCustomModelName(),
            objectMapper.writeValueAsString(systemPrompt),
            objectMapper.writeValueAsString(userContent)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.getApiEndpoint()))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + (config.getApiKey() == null ? "" : config.getApiKey().trim()))
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            log.error("Custom model API error: {}", response.body());
            throw new RuntimeException("Custom model API call failed: " + response.statusCode());
        }

        JsonNode responseJson = objectMapper.readTree(response.body());
        String content = responseJson.get("choices").get(0).get("message").get("content").asText();

        return parseAnalysisResult(content);
    }

    private AnalysisResultDTO parseAnalysisResult(String jsonContent) throws Exception {
        String cleanedContent = jsonContent.trim();

        // 移除 Markdown 代码块标记
        if (cleanedContent.startsWith("```json")) {
            cleanedContent = cleanedContent.substring(7).trim();
        } else if (cleanedContent.startsWith("```")) {
            cleanedContent = cleanedContent.substring(3).trim();
        }
        if (cleanedContent.endsWith("```")) {
            cleanedContent = cleanedContent.substring(0, cleanedContent.length() - 3).trim();
        }

        // 用花括号计数法精确提取 JSON 对象
        int braceDepth = 0;
        int jsonStart = -1;
        for (int i = 0; i < cleanedContent.length(); i++) {
            char c = cleanedContent.charAt(i);
            if (c == '{') {
                if (braceDepth == 0) jsonStart = i;
                braceDepth++;
            } else if (c == '}') {
                braceDepth--;
                if (braceDepth == 0 && jsonStart >= 0) {
                    cleanedContent = cleanedContent.substring(jsonStart, i + 1);
                    break;
                }
            }
        }

        // 关键修复：只清理字符串值内部的非法反斜杠转义（如 \'），不碰结构换行符
        // DeepSeek 有时在字符串值中返回 \' 等非法转义，导致 Jackson 解析失败
        StringBuilder sb = new StringBuilder();
        boolean inString = false;
        boolean escaped = false;
        for (int i = 0; i < cleanedContent.length(); i++) {
            char c = cleanedContent.charAt(i);
            if (!inString) {
                if (c == '"') {
                    inString = true;
                    escaped = false;
                    sb.append(c);
                } else {
                    sb.append(c);
                }
            } else {
                if (escaped) {
                    // 前一个字符是反斜杠，检查当前字符是否是合法 JSON 转义
                    if (c == '"' || c == '\\' || c == '/' ||
                        c == 'b' || c == 'f' || c == 'n' ||
                        c == 'r' || c == 't' || c == 'u') {
                        sb.append('\\').append(c);
                    } else {
                        // 非法转义（如 \'），丢弃反斜杠，只保留字符
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
        cleanedContent = sb.toString();

        JsonNode resultJson = objectMapper.readTree(cleanedContent);

        Integer protein = resultJson.has("protein") ? resultJson.get("protein").asInt() : null;
        Integer carbs = resultJson.has("carbs") ? resultJson.get("carbs").asInt() : null;
        Integer vitamins = resultJson.has("vitamins") ? resultJson.get("vitamins").asInt() : null;
        Integer fats = resultJson.has("fats") ? resultJson.get("fats").asInt() : null;
        Integer fiber = resultJson.has("fiber") ? resultJson.get("fiber").asInt() : null;
        String reasoning = resultJson.has("reasoning") ? resultJson.get("reasoning").asText() : null;
        String summary = resultJson.has("summary") ? resultJson.get("summary").asText() : null;

        return new AnalysisResultDTO(protein, carbs, vitamins, fats, fiber, reasoning, summary);
    }

    private String getOpenAIModelName(String modelType) {
        return switch (modelType) {
            case "GPT_4" -> "gpt-4";
            case "GPT_4_TURBO" -> "gpt-4-turbo-preview";
            case "GPT_3_5_TURBO" -> "gpt-3.5-turbo";
            default -> "gpt-4";
        };
    }

    private String getClaudeModelName(String modelType) {
        return switch (modelType) {
            case "CLAUDE_3_OPUS" -> "claude-3-opus-20240229";
            case "CLAUDE_3_SONNET" -> "claude-3-sonnet-20240229";
            case "CLAUDE_3_HAIKU" -> "claude-3-haiku-20240307";
            default -> "claude-3-sonnet-20240229";
        };
    }
}
