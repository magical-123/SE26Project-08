package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.dto.AnalysisResultDTO;
import com.infodigest.entity.AIConfig;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.security.CredentialCryptoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AIServiceTest {

    @Mock
    private AIConfigRepository aiConfigRepository;

    @Mock
    private CredentialCryptoService credentialCryptoService;

    private AIService aiService;

    private HttpClient httpClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        aiService = new AIService();
        httpClient = mock(HttpClient.class);
        ReflectionTestUtils.setField(aiService, "httpClient", httpClient);
        ReflectionTestUtils.setField(aiService, "objectMapper", objectMapper);
        ReflectionTestUtils.setField(aiService, "credentialCryptoService", credentialCryptoService);
        ReflectionTestUtils.setField(aiService, "aiConfigRepository", aiConfigRepository);
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeReturnsAnalysisResultDTO() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 40, \\"carbs\\": 30, \\"vitamins\\": 10, \\"fats\\": 10, \\"fiber\\": 10, \\"reasoning\\": \\"test reasoning\\", \\"summary\\": \\"test summary\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        String systemPrompt = "You are an analyst";
        String userContent = "Analyze this";

        // When
        AnalysisResultDTO result = aiService.analyze(config, systemPrompt, userContent);

        // Then
        assertNotNull(result);
        assertEquals(40, result.getProtein());
        assertEquals(30, result.getCarbs());
        assertEquals(10, result.getVitamins());
        assertEquals(10, result.getFats());
        assertEquals(10, result.getFiber());
        assertEquals("test reasoning", result.getReasoning());
        assertEquals("test summary", result.getSummary());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeThrowsExceptionOnApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("Internal Server Error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        String systemPrompt = "You are an analyst";
        String userContent = "Analyze this";

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.analyze(config, systemPrompt, userContent)
        );
        assertTrue(exception.getMessage().contains("API call failed"));
        assertTrue(exception.getMessage().contains("500"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeHandlesRateLimiting() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new java.io.IOException("429: Rate limit exceeded"));

        String systemPrompt = "You are an analyst";
        String userContent = "Analyze this";

        // When & Then
        Exception exception = assertThrows(
                Exception.class,
                () -> aiService.analyze(config, systemPrompt, userContent)
        );
        assertTrue(exception.getMessage().contains("429"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithClaudeModel() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_SONNET");
        config.setApiKey("enc:test-key");
        when(credentialCryptoService.decrypt("enc:test-key")).thenReturn("decrypted-key");

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"protein\\": 50, \\"carbs\\": 25, \\"vitamins\\": 0, \\"fats\\": 25, \\"fiber\\": 0, \\"reasoning\\": \\"claude reasoning\\", \\"summary\\": \\"claude summary\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(50, result.getProtein());
        assertEquals("claude reasoning", result.getReasoning());
    }

    @Test
    void analyzeThrowsExceptionForUnsupportedModel() {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("UNKNOWN_MODEL");

        // When & Then
        assertThrows(
                IllegalArgumentException.class,
                () -> aiService.analyze(config, "system", "content")
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightReturnsResult() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(config));

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"Test Insight\\", \\"summary\\": \\"Test summary\\", \\"fullText\\": \\"Test full text\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsight("Test prompt", 1L);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Test Insight"));
        assertTrue(result.contains("Test summary"));
        assertTrue(result.contains("Test full text"));
    }

    @Test
    void generateInsightThrowsExceptionWhenNoConfig() {
        // Given
        when(aiConfigRepository.findByUserId(99L)).thenReturn(Optional.empty());

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.generateInsight("prompt", 99L)
        );
        assertTrue(exception.getMessage().contains("未配置 AI 模型"));
    }

    // ========== generateInsightWithConfig tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForClaude() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_SONNET");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"title\\": \\"Claude Insight\\", \\"summary\\": \\"Claude summary\\", \\"fullText\\": \\"Claude full\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("test prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Claude Insight"));
        assertTrue(result.contains("Claude summary"));
        assertTrue(result.contains("Claude full"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForGemini() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GEMINI_PRO");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "candidates": [{
                    "content": {
                      "parts": [{
                        "text": "{\\"title\\": \\"Gemini Insight\\", \\"summary\\": \\"Gemini summary\\", \\"fullText\\": \\"Gemini full\\"}"
                      }]
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("test prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Gemini Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForDeepSeek() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("DEEPSEEK");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        config.setCustomModelName("deepseek-chat");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"DeepSeek Insight\\", \\"summary\\": \\"DeepSeek summary\\", \\"fullText\\": \\"DeepSeek full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("test prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("DeepSeek Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForCustomModel() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CUSTOM");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom.api.com/v1/chat");
        config.setCustomModelName("custom-model");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"Custom Insight\\", \\"summary\\": \\"Custom summary\\", \\"fullText\\": \\"Custom full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("test prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Custom Insight"));
    }

    @Test
    void generateInsightWithConfigThrowsForUnsupportedModel() {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("UNKNOWN_MODEL");

        // When & Then
        assertThrows(IllegalArgumentException.class,
                () -> aiService.generateInsightWithConfig("prompt", config));
    }

    // ========== Additional analyze tests for model coverage ==========

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithGeminiModel() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GEMINI_PRO");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "candidates": [{
                    "content": {
                      "parts": [{
                        "text": "{\\"protein\\": 30, \\"carbs\\": 30, \\"vitamins\\": 20, \\"fats\\": 10, \\"fiber\\": 10, \\"reasoning\\": \\"gemini reasoning\\", \\"summary\\": \\"gemini summary\\"}"
                      }]
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(30, result.getProtein());
        assertEquals("gemini reasoning", result.getReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithDeepSeekModel() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("DEEPSEEK");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        config.setCustomModelName("deepseek-chat");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 40, \\"carbs\\": 20, \\"vitamins\\": 15, \\"fats\\": 15, \\"fiber\\": 10, \\"reasoning\\": \\"deepseek reasoning\\", \\"summary\\": \\"deepseek summary\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(40, result.getProtein());
        assertEquals("deepseek reasoning", result.getReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithCustomModelType() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CUSTOM");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom.api.com/v1/chat");
        config.setCustomModelName("custom-model");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 50, \\"carbs\\": 20, \\"vitamins\\": 10, \\"fats\\": 10, \\"fiber\\": 10, \\"reasoning\\": \\"custom reasoning\\", \\"summary\\": \\"custom summary\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(50, result.getProtein());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeUsesCustomEndpoint() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom-openai-proxy.com/v1/chat/completions");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 20, \\"carbs\\": 20, \\"vitamins\\": 20, \\"fats\\": 20, \\"fiber\\": 20, \\"reasoning\\": \\"proxy test\\", \\"summary\\": \\"proxy summary\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(20, result.getProtein());
    }

    // ========== parseAnalysisResult edge case tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void analyzeHandlesMarkdownCodeBlockInResponse() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "```json\\n{\\"protein\\": 60, \\"carbs\\": 20, \\"vitamins\\": 5, \\"fats\\": 10, \\"fiber\\": 5, \\"reasoning\\": \\"with markdown\\", \\"summary\\": \\"markdown test\\"}\\n```"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(60, result.getProtein());
        assertEquals("with markdown", result.getReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeHandlesIllegalEscapeCharacters() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        // Response with illegal escapes like \\'
        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 25, \\"carbs\\": 25, \\"vitamins\\": 25, \\"fats\\": 25, \\"fiber\\": 0, \\"reasoning\\": \\"it\\\\'s a test\\", \\"summary\\": \\"escape test\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(25, result.getProtein());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeHandlesQuotesInResponse() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 30, \\"carbs\\": 20, \\"vitamins\\": 15, \\"fats\\": 15, \\"fiber\\": 20, \\"reasoning\\": \\"quote reasoning\\", \\"summary\\": \\"quote summary\\", \\"quotes\\": [{\\"text\\": \\"inspirational quote\\", \\"reason\\": \\"it is deep\\"}]}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertNotNull(result.getQuotes());
        assertEquals(1, result.getQuotes().size());
        assertEquals("inspirational quote", result.getQuotes().get(0).getText());
        assertEquals("it is deep", result.getQuotes().get(0).getReason());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeFiltersEmptyQuotes() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 20, \\"carbs\\": 20, \\"vitamins\\": 20, \\"fats\\": 20, \\"fiber\\": 20, \\"reasoning\\": \\"empty quotes\\", \\"summary\\": \\"empty quotes test\\", \\"quotes\\": [{\\"text\\": \\"\\", \\"reason\\": \\"empty\\"}]}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertNull(result.getQuotes());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithNullDecryptedApiKey() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:null-key");

        lenient().when(credentialCryptoService.decrypt("enc:null-key")).thenReturn(null);

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 10, \\"carbs\\": 10, \\"vitamins\\": 10, \\"fats\\": 10, \\"fiber\\": 60, \\"reasoning\\": \\"null key\\", \\"summary\\": \\"null key test\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system", "content");

        // Then
        assertNotNull(result);
        assertEquals(10, result.getProtein());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithGeminiUsesCombinedPrompt() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GEMINI_PRO");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "candidates": [{
                    "content": {
                      "parts": [{
                        "text": "{\\"protein\\": 15, \\"carbs\\": 15, \\"vitamins\\": 15, \\"fats\\": 15, \\"fiber\\": 40, \\"reasoning\\": \\"gemini combined\\", \\"summary\\": \\"gemini combined summary\\"}"
                      }]
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        AnalysisResultDTO result = aiService.analyze(config, "system prompt", "user content");

        // Then
        assertNotNull(result);
        assertEquals(15, result.getProtein());
        assertEquals("gemini combined", result.getReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithClaudeApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_SONNET");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("Claude error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.analyze(config, "system", "content")
        );
        assertTrue(exception.getMessage().contains("Claude API call failed"));
        assertTrue(exception.getMessage().contains("500"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithGeminiApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GEMINI_PRO");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(400);
        when(httpResponse.body()).thenReturn("Gemini error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.analyze(config, "system", "content")
        );
        assertTrue(exception.getMessage().contains("Gemini API call failed"));
        assertTrue(exception.getMessage().contains("400"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithCustomModelApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CUSTOM");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom.api.com/v1/chat");
        config.setCustomModelName("custom-model");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(403);
        when(httpResponse.body()).thenReturn("Forbidden");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.analyze(config, "system", "content")
        );
        assertTrue(exception.getMessage().contains("Custom model API call failed"));
        assertTrue(exception.getMessage().contains("403"));
    }

    // ========== generateInsight with various model configs (via repository) ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightUsesClaudeModelFromConfig() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_SONNET");
        config.setApiKey("enc:test-key");

        when(aiConfigRepository.findByUserId(5L)).thenReturn(Optional.of(config));

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"title\\": \\"Claude via Config\\", \\"summary\\": \\"Summary\\", \\"fullText\\": \\"Full text\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsight("Test prompt", 5L);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Claude via Config"));
    }

    // ========== generateInsightWithConfig API error path tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForOpenAIThrowsOnApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("Internal Server Error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
        assertTrue(exception.getMessage().contains("OpenAI API call failed"));
        assertTrue(exception.getMessage().contains("500"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForClaudeThrowsOnApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_SONNET");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(502);
        when(httpResponse.body()).thenReturn("Bad Gateway");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
        assertTrue(exception.getMessage().contains("Claude API call failed"));
        assertTrue(exception.getMessage().contains("502"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForGeminiThrowsOnApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GEMINI_PRO");
        config.setApiKey("enc:test-key");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(429);
        when(httpResponse.body()).thenReturn("Rate Limit Exceeded");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
        assertTrue(exception.getMessage().contains("Gemini API call failed"));
        assertTrue(exception.getMessage().contains("429"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForCustomModelThrowsOnApiError() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CUSTOM");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom.api.com/v1/chat");
        config.setCustomModelName("custom-model");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(401);
        when(httpResponse.body()).thenReturn("Unauthorized");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        RuntimeException exception = assertThrows(
                RuntimeException.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
        assertTrue(exception.getMessage().contains("Custom model API call failed"));
        assertTrue(exception.getMessage().contains("401"));
    }

    // ========== generateInsightWithConfig additional model types ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForGPT4_TURBO() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4_TURBO");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"GPT4 Turbo Insight\\", \\"summary\\": \\"Turbo summary\\", \\"fullText\\": \\"Turbo full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("GPT4 Turbo Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForGPT3_5_TURBO() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_3_5_TURBO");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"GPT3.5 Turbo Insight\\", \\"summary\\": \\"Gpt35 summary\\", \\"fullText\\": \\"Gpt35 full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("GPT3.5 Turbo Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForQWEN() throws Exception {
        // Given - QWEN goes through callCustomModelForInsight
        AIConfig config = new AIConfig();
        config.setModelType("QWEN");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
        config.setCustomModelName("qwen-plus");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"QWEN Insight\\", \\"summary\\": \\"Qwen summary\\", \\"fullText\\": \\"Qwen full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("QWEN Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForGLM() throws Exception {
        // Given - GLM goes through callCustomModelForInsight
        AIConfig config = new AIConfig();
        config.setModelType("GLM");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://open.bigmodel.cn/api/paas/v4/chat/completions");
        config.setCustomModelName("glm-4");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"GLM Insight\\", \\"summary\\": \\"Glm summary\\", \\"fullText\\": \\"Glm full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("GLM Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForKIMI() throws Exception {
        // Given - KIMI goes through callCustomModelForInsight
        AIConfig config = new AIConfig();
        config.setModelType("KIMI");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://api.moonshot.cn/v1/chat/completions");
        config.setCustomModelName("moonshot-v1-8k");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"KIMI Insight\\", \\"summary\\": \\"Kimi summary\\", \\"fullText\\": \\"Kimi full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("KIMI Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForDOUBAO() throws Exception {
        // Given - DOUBAO goes through callCustomModelForInsight
        AIConfig config = new AIConfig();
        config.setModelType("DOUBAO");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
        config.setCustomModelName("doubao-1.5-pro");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"DOUBAO Insight\\", \\"summary\\": \\"Doubao summary\\", \\"fullText\\": \\"Doubao full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("DOUBAO Insight"));
    }

    // ========== Claude model variant tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForClaude3Opus() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_OPUS");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"title\\": \\"Claude Opus Insight\\", \\"summary\\": \\"Opus summary\\", \\"fullText\\": \\"Opus full\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Claude Opus Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigForClaude3Haiku() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_3_HAIKU");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"title\\": \\"Claude Haiku Insight\\", \\"summary\\": \\"Haiku summary\\", \\"fullText\\": \\"Haiku full\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Claude Haiku Insight"));
    }

    // ========== IOException / timeout tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigThrowsIOException() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new java.io.IOException("Connection timed out"));

        // When & Then
        assertThrows(
                java.io.IOException.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
    }

    // ========== getOpenAIModelName / getClaudeModelName default branch tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void analyzeWithUnknownGptVariantFallsToDefaultModelName() throws Exception {
        // Given — "GPT_XYZ" matches startsWith("GPT") in analyze(), but
        //          getOpenAIModelName("GPT_XYZ") hits the default branch → "gpt-4"
        AIConfig config = new AIConfig();
        config.setModelType("GPT_XYZ");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"protein\\": 35, \\"carbs\\": 25, \\"vitamins\\": 10, \\"fats\\": 20, \\"fiber\\": 10, \\"reasoning\\": \\"default model\\", \\"summary\\": \\"default model test\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        AnalysisResultDTO result = aiService.analyze(config, "system", "content");
        assertNotNull(result);
        assertEquals(35, result.getProtein());
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigWithUnknownClaudeVariantFallsToDefaultModelName() throws Exception {
        // Given — "CLAUDE_XYZ" matches startsWith("CLAUDE") in generateInsightWithConfig(),
        //          but getClaudeModelName("CLAUDE_XYZ") hits the default branch
        AIConfig config = new AIConfig();
        config.setModelType("CLAUDE_XYZ");
        config.setApiKey("enc:test-key");

        String responseBody = """
                {
                  "content": [{
                    "text": "{\\"title\\": \\"Default Claude Fallback\\", \\"summary\\": \\"default summary\\", \\"fullText\\": \\"default full\\"}"
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        String result = aiService.generateInsightWithConfig("prompt", config);
        assertNotNull(result);
        assertTrue(result.contains("Default Claude Fallback"));
    }

    // ========== Null decrypted API key tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigWithNullDecryptedApiKey() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:null-key");
        // credentialCryptoService.decrypt returns null by default (mock default)

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"Null ApiKey Insight\\", \\"summary\\": \\"Null key summary\\", \\"fullText\\": \\"Null key full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Null ApiKey Insight"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithNullDecryptedApiKey() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:null-key");

        when(aiConfigRepository.findByUserId(10L)).thenReturn(Optional.of(config));
        lenient().when(credentialCryptoService.decrypt("enc:null-key")).thenReturn(null);

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"Null Key Via Repo\\", \\"summary\\": \\"Repo null key summary\\", \\"fullText\\": \\"Repo null key full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsight("prompt", 10L);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Null Key Via Repo"));
    }

    // ========== JSON parsing failure in generateInsightWithConfig ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigThrowsOnMalformedJsonResponse() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        // Malformed JSON response from API
        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{invalid json}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        assertThrows(
                Exception.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
    }

    // ========== Empty response handling ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigThrowsOnEmptyResponse() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");

        // Empty body response
        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When & Then
        assertThrows(
                Exception.class,
                () -> aiService.generateInsightWithConfig("prompt", config)
        );
    }

    // ========== generateInsightWithConfig with custom endpoint ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateInsightWithConfigUsesCustomEndpoint() throws Exception {
        // Given
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("enc:test-key");
        config.setApiEndpoint("https://custom-openai-proxy.com/v1/chat/completions");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"title\\": \\"Custom Endpoint Insight\\", \\"summary\\": \\"Endpoint summary\\", \\"fullText\\": \\"Endpoint full\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        String result = aiService.generateInsightWithConfig("prompt", config);

        // Then
        assertNotNull(result);
        assertTrue(result.contains("Custom Endpoint Insight"));
    }
}
