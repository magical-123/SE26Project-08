package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.AIConfig;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.ConceptRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ItemConceptRepository;
import com.infodigest.security.CredentialCryptoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiSummaryServiceTest {

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private ItemConceptRepository itemConceptRepository;

    @Mock
    private AIConfigRepository aiConfigRepository;

    @Mock
    private CredentialCryptoService credentialCryptoService;

    @Mock
    private PlatformTransactionManager transactionManager;

    private AiSummaryService service;

    private HttpClient httpClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        service = new AiSummaryService();
        httpClient = mock(HttpClient.class);
        ReflectionTestUtils.setField(service, "informationItemRepository", informationItemRepository);
        ReflectionTestUtils.setField(service, "conceptRepository", conceptRepository);
        ReflectionTestUtils.setField(service, "itemConceptRepository", itemConceptRepository);
        ReflectionTestUtils.setField(service, "aiConfigRepository", aiConfigRepository);
        ReflectionTestUtils.setField(service, "credentialCryptoService", credentialCryptoService);
        ReflectionTestUtils.setField(service, "httpClient", httpClient);
        ReflectionTestUtils.setField(service, "objectMapper", objectMapper);
        ReflectionTestUtils.setField(service, "defaultApiUrl", "https://api.deepseek.com/v1/chat/completions");
        ReflectionTestUtils.setField(service, "defaultApiKey", "default-key");
        ReflectionTestUtils.setField(service, "defaultModel", "deepseek-chat");
        ReflectionTestUtils.setField(service, "transactionManager", transactionManager);
    }

    private InformationItem createItem(Long id, Long userId, String title, String content, String platform) {
        InformationItem item = new InformationItem();
        item.setId(id);
        item.setUserId(userId);
        item.setTitle(title);
        item.setContentRaw(content);
        item.setPlatform(platform);
        return item;
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateSummary_returnsTrueOnSuccess() throws Exception {
        InformationItem item = createItem(1L, 10L, "Test Title", "Some content", "Bilibili");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"summary\\": \\"A great summary\\", \\"knowledgeScore\\": 75, \\"scoreReasoning\\": \\"Deep technical content\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("A great summary", item.getAiSummary());
        assertEquals(75, item.getKnowledgeScore());
        assertEquals("Deep technical content", item.getScoreReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateSummary_returnsFalseOnFailure() throws Exception {
        InformationItem item = createItem(2L, 20L, "Test Title", "Content", "Bilibili");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("Server Error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertFalse(result);
        assertNull(item.getAiSummary());
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateSummary_returnsFalseOnException() throws Exception {
        InformationItem item = createItem(3L, 30L, "Test Title", "Content", "Bilibili");

        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new RuntimeException("Network error"));

        boolean result = service.generateSummary(item);

        assertFalse(result);
        assertNull(item.getAiSummary());
    }

    @Test
    void generateSummary_usesDefaultConfigWhenUserHasNoConfig() throws Exception {
        InformationItem item = createItem(4L, 40L, "Test Title", "Content", "Bilibili");

        when(aiConfigRepository.findByUserId(40L)).thenReturn(Optional.empty());

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"summary\\": \\"Default summary\\", \\"knowledgeScore\\": 50, \\"scoreReasoning\\": \\"Average content\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("Default summary", item.getAiSummary());
        assertEquals(50, item.getKnowledgeScore());
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateSummary_usesUserConfigWhenAvailable() throws Exception {
        InformationItem item = createItem(5L, 50L, "Custom Config Title", "Custom content", "GITHUB");

        AIConfig userConfig = new AIConfig();
        userConfig.setApiEndpoint("https://custom.api.com/v1/chat");
        userConfig.setApiKey("enc:user-key");
        userConfig.setCustomModelName("custom-model");

        when(aiConfigRepository.findByUserId(50L)).thenReturn(Optional.of(userConfig));
        when(credentialCryptoService.decrypt("enc:user-key")).thenReturn("decrypted-key");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"summary\\": \\"User config summary\\", \\"knowledgeScore\\": 90, \\"scoreReasoning\\": \\"Excellent\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("User config summary", item.getAiSummary());
        assertEquals(90, item.getKnowledgeScore());
        assertEquals("Excellent", item.getScoreReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateSummaryAsync_handlesAsyncCorrectly() throws Exception {
        InformationItem item = createItem(6L, 60L, "Async Title", "Async content", "Bilibili");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"summary\\": \\"Async summary\\", \\"knowledgeScore\\": 60, \\"scoreReasoning\\": \\"Decent\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // generateSummaryAsync is void, so just ensure no exception
        service.generateSummaryAsync(item);

        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void parseResponse_handlesMarkdownCodeBlocks() throws Exception {
        InformationItem item = createItem(7L, 70L, "Markdown Title", "Content with markdown response", "Bilibili");

        // Response wraps JSON in markdown code blocks
        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "```json\\n{\\"summary\\": \\"Summary from markdown\\", \\"knowledgeScore\\": 80, \\"scoreReasoning\\": \\"Good reasoning\\"}\\n```"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("Summary from markdown", item.getAiSummary());
        assertEquals(80, item.getKnowledgeScore());
        assertEquals("Good reasoning", item.getScoreReasoning());
    }

    @Test
    @SuppressWarnings("unchecked")
    void parseResponse_handlesPlainCodeBlockWithoutJson() throws Exception {
        InformationItem item = createItem(8L, 80L, "Plain code block", "Content", "Bilibili");

        // Response wraps in ``` without json keyword
        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "```\\n{\\"summary\\": \\"Plain code block summary\\", \\"knowledgeScore\\": 55, \\"scoreReasoning\\": \\"Okay\\"}\\n```"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("Plain code block summary", item.getAiSummary());
        assertEquals(55, item.getKnowledgeScore());
    }

    @Test
    void buildPrompt_includesPlatformAndContent() {
        InformationItem item = createItem(9L, 90L, "Build Prompt Test", "This is the content body", "Bilibili");

        String prompt = (String) ReflectionTestUtils.invokeMethod(service, "buildPrompt", item);

        assertNotNull(prompt);
        assertTrue(prompt.contains("Bilibili"));
        assertTrue(prompt.contains("Build Prompt Test"));
        assertTrue(prompt.contains("This is the content body"));
    }

    @Test
    void buildPrompt_handlesNullPlatformAndTitle() {
        InformationItem item = createItem(10L, 100L, null, "Content only", null);

        String prompt = (String) ReflectionTestUtils.invokeMethod(service, "buildPrompt", item);

        assertNotNull(prompt);
        assertTrue(prompt.contains("无标题"));
        assertTrue(prompt.contains("未知"));
        assertTrue(prompt.contains("Content only"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void parseResponse_handlesDeepSeekResponseFormat() throws Exception {
        // Simulate DeepSeek's actual response format with nested structure
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role", "assistant");
        message.put("content", "{\"summary\": \"Good summary\", \"knowledgeScore\": 70, \"scoreReasoning\": \"Solid\"}");

        Map<String, Object> choice = new LinkedHashMap<>();
        choice.put("index", 0);
        choice.put("message", message);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("choices", List.of(choice));

        String responseBody = objectMapper.writeValueAsString(root);

        InformationItem item = createItem(11L, 110L, "DeepSeek Test", "Content", "Bilibili");

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        assertEquals("Good summary", item.getAiSummary());
        assertEquals(70, item.getKnowledgeScore());
        assertEquals("Solid", item.getScoreReasoning());
    }

    @Test
    void generateSummary_itemWithoutUserIdUsesDefaultConfig() throws Exception {
        InformationItem item = createItem(12L, null, "No User", "Content", "Bilibili");

        String responseBody = """
                {
                  "choices": [{
                    "message": {
                      "content": "{\\"summary\\": \\"No user summary\\", \\"knowledgeScore\\": 30, \\"scoreReasoning\\": \\"Basic\\"}"
                    }
                  }]
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertTrue(result);
        verify(aiConfigRepository, never()).findByUserId(anyLong());
        assertEquals("No user summary", item.getAiSummary());
    }

    @Test
    void generateSummary_emptyResponseChoices_returnsFalse() throws Exception {
        InformationItem item = createItem(13L, 130L, "Empty Choices", "Content", "Bilibili");

        String responseBody = """
                {
                  "choices": []
                }
                """;

        HttpResponse<String> httpResponse = mock(HttpResponse.class);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        boolean result = service.generateSummary(item);

        assertFalse(result);
        assertNull(item.getAiSummary());
    }
}
