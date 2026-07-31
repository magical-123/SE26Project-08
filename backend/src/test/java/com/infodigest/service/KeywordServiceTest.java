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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeywordServiceTest {

    @Mock
    private CredentialCryptoService credentialCryptoService;

    @Mock
    private ConceptRepository conceptRepository;

    @Mock
    private ItemConceptRepository itemConceptRepository;

    @Mock
    private AIConfigRepository aiConfigRepository;

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    @InjectMocks
    private KeywordService keywordService;

    @Captor
    private ArgumentCaptor<Concept> conceptCaptor;

    @Captor
    private ArgumentCaptor<ItemConcept> itemConceptCaptor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // HttpClient is a final field initialized inline, inject via reflection
        ReflectionTestUtils.setField(keywordService, "httpClient", httpClient);
        // @Value fields are not populated by Mockito, set them manually
        ReflectionTestUtils.setField(keywordService, "defaultApiUrl", "https://api.deepseek.com/v1/chat/completions");
        ReflectionTestUtils.setField(keywordService, "defaultApiKey", "sk-default-key");
        ReflectionTestUtils.setField(keywordService, "defaultModel", "deepseek-chat");
    }

    @Test
    void analyzeKeywords_returnsKeywordsForContent() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("深入理解微服务架构设计");
        item.setAiSummary("本文介绍了微服务架构的核心概念、服务拆分原则以及分布式系统设计模式。");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String contentJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "微服务", "isNew", false, "isSelected", true, "confidence", 0.95, "reason", "核心主题"),
                        java.util.Map.of("label", "分布式系统", "isNew", true, "isSelected", true, "confidence", 0.85, "reason", "文中详细讨论了分布式设计模式")
                ))
        );
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", contentJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then
        assertThat(results).hasSize(2);
        assertThat(results.get(0).getLabel()).isEqualTo("微服务");
        assertThat(results.get(0).isSelected()).isTrue();
        assertThat(results.get(0).getConfidence()).isEqualTo(0.95);
        assertThat(results.get(1).getLabel()).isEqualTo("分布式系统");
        assertThat(results.get(1).isNew()).isTrue();
    }

    @Test
    void analyzeKeywords_returnsEmptyList_whenHttpCallFails() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试内容");
        item.setAiSummary("这是一段简短的测试摘要。");

        // aiConfigRepository returns empty -> uses default config
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        // Mock HttpClient to throw exception
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new java.io.IOException("Connection refused"));

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then - exception is caught, returns empty list
        assertThat(results).isEmpty();
    }

    @Test
    void analyzeKeywords_handlesShortContent() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("简短标题");
        item.setContentRaw("短内容");
        // No aiSummary, short contentRaw

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String contentJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "测试", "isNew", true, "isSelected", true, "confidence", 0.7, "reason", "基于标题推断")
                ))
        );
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", contentJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then
        assertThat(results).isNotEmpty();
        assertThat(results.get(0).getLabel()).isEqualTo("测试");
    }

    @Test
    void applyKeywords_createsNewConceptAndMappings() {
        // Given
        Long itemId = 10L;
        Long userId = 1L;

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("微服务");
        kw.setNew(true);
        kw.setSelected(true);
        kw.setConfidence(0.95);
        kw.setReason("核心主题");

        when(itemConceptRepository.findByItemId(itemId)).thenReturn(List.of());
        when(conceptRepository.findByUserIdAndLabel(userId, "微服务")).thenReturn(Optional.empty());

        Concept savedConcept = new Concept();
        savedConcept.setId(100L);
        savedConcept.setUserId(userId);
        savedConcept.setLabel("微服务");
        when(conceptRepository.save(any(Concept.class))).thenReturn(savedConcept);

        // When
        keywordService.applyKeywords(itemId, userId, List.of(kw));

        // Then
        verify(itemConceptRepository, never()).deleteByItemId(itemId);
        verify(conceptRepository).save(conceptCaptor.capture());
        assertThat(conceptCaptor.getValue().getLabel()).isEqualTo("微服务");
        verify(itemConceptRepository).save(itemConceptCaptor.capture());
        assertThat(itemConceptCaptor.getValue().getItemId()).isEqualTo(itemId);
        assertThat(itemConceptCaptor.getValue().getConceptId()).isEqualTo(100L);
    }

    @Test
    void applyKeywords_reusesExistingConcept() {
        // Given
        Long itemId = 10L;
        Long userId = 1L;

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("微服务");
        kw.setNew(false);
        kw.setSelected(true);

        Concept existingConcept = new Concept();
        existingConcept.setId(100L);
        existingConcept.setUserId(userId);
        existingConcept.setLabel("微服务");

        when(itemConceptRepository.findByItemId(itemId)).thenReturn(List.of());
        when(conceptRepository.findByUserIdAndLabel(userId, "微服务")).thenReturn(Optional.of(existingConcept));

        // When
        keywordService.applyKeywords(itemId, userId, List.of(kw));

        // Then
        verify(conceptRepository, never()).save(any());
        verify(itemConceptRepository).save(any());
    }

    @Test
    void analyzeKeywords_handlesNon200Response() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试内容");
        item.setAiSummary("这是一段测试摘要。");

        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("Internal Server Error");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then — RuntimeError for non-200 is caught, returns empty list
        assertThat(results).isEmpty();
    }

    @Test
    void analyzeKeywords_handlesResponseWithMarkdownCodeBlock() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("微服务架构");
        item.setAiSummary("微服务架构的核心概念。");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        // Content wrapped in markdown code block
        String innerJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "微服务", "isNew", false, "isSelected", true, "confidence", 0.9, "reason", "核心主题")
                ))
        );
        String markdownWrapped = "```json\n" + innerJson + "\n```";
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", markdownWrapped))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getLabel()).isEqualTo("微服务");
    }

    @Test
    void analyzeKeywords_handlesEmptyContent() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要内容");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        // Empty content string
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", ""))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then — empty content returns empty list
        assertThat(results).isEmpty();
    }

    @Test
    void analyzeKeywords_handlesResponseWithoutKeywordsKey() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要内容");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        // Valid JSON but without "keywords" key
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", "{\"otherKey\": []}"))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then — no keywords key returns empty list
        assertThat(results).isEmpty();
    }

    @Test
    void analyzeKeywords_handlesInvalidJsonResponse() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要内容");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        // Non-JSON content
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", "这不是有效的JSON内容"))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then — RuntimeException caught, returns empty list
        assertThat(results).isEmpty();
    }

    @Test
    void applyKeywords_skipsEmptyLabel() {
        // Given
        Long itemId = 10L;
        Long userId = 1L;

        KeywordService.KeywordSuggestion kw1 = new KeywordService.KeywordSuggestion();
        kw1.setLabel(null);  // null label → should be skipped
        kw1.setNew(true);
        kw1.setSelected(true);

        KeywordService.KeywordSuggestion kw2 = new KeywordService.KeywordSuggestion();
        kw2.setLabel("分布式系统");
        kw2.setNew(true);
        kw2.setSelected(true);

        when(itemConceptRepository.findByItemId(itemId)).thenReturn(List.of());
        when(conceptRepository.findByUserIdAndLabel(userId, "分布式系统")).thenReturn(Optional.empty());

        Concept savedConcept = new Concept();
        savedConcept.setId(100L);
        savedConcept.setUserId(userId);
        savedConcept.setLabel("分布式系统");
        when(conceptRepository.save(any(Concept.class))).thenReturn(savedConcept);

        // When
        keywordService.applyKeywords(itemId, userId, List.of(kw1, kw2));

        // Then — only kw2 is processed, kw1 is skipped
        verify(conceptRepository, times(1)).save(any(Concept.class));
        verify(itemConceptRepository, times(1)).save(any(ItemConcept.class));
    }

    @Test
    void analyzeKeywords_withUserNote() throws Exception {
        // Given
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("深入理解微服务架构设计");
        item.setAiSummary("本文介绍了微服务架构的核心概念。");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("https://api.deepseek.com/v1/chat/completions");
        aiConfig.setApiKey("encrypted-key");
        aiConfig.setCustomModelName("deepseek-chat");
        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        lenient().when(credentialCryptoService.decrypt("encrypted-key")).thenReturn("sk-test-key");
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String contentJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "微服务", "isNew", false, "isSelected", true, "confidence", 0.95, "reason", "核心主题")
                ))
        );
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", contentJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, "用户笔记：微服务很重要");

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getLabel()).isEqualTo("微服务");
    }

    @Test
    void analyzeKeywords_noContentOnlyTitle() throws Exception {
        // Given — no aiSummary, no contentRaw, should build prompt based on title only
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试标题");

        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String contentJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "测试", "isNew", true, "isSelected", true, "confidence", 0.5, "reason", "基于标题推断")
                ))
        );
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", contentJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getLabel()).isEqualTo("测试");
    }

    @Test
    void analyzeKeywords_usesDefaultConfig_whenConfigHasEmptyFields() throws Exception {
        // Given — config exists but all fields are empty → fall back to defaults
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要");

        AIConfig aiConfig = new AIConfig();
        aiConfig.setApiEndpoint("");
        aiConfig.setApiKey("");
        aiConfig.setCustomModelName("");
        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String contentJson = objectMapper.writeValueAsString(
                java.util.Map.of("keywords", List.of(
                        java.util.Map.of("label", "测试", "isNew", false, "isSelected", true, "confidence", 0.8, "reason", "测试")
                ))
        );
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", contentJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getLabel()).isEqualTo("测试");
    }

    @Test
    void analyzeKeywords_handlesIncompleteJsonRecovery() throws Exception {
        // Given — AI returns JSON with '{' but no matching '}', and has "label" → recovery path
        InformationItem item = new InformationItem();
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要内容");

        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        String incompleteJson = "{\"keywords\": [{\"label\": \"关键词1\", \"isNew\": true, \"isSelected\": true}";
        String responseBody = objectMapper.writeValueAsString(
                java.util.Map.of("choices", List.of(
                        java.util.Map.of("message", java.util.Map.of("content", incompleteJson))
                ))
        );

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseBody);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(httpResponse);

        // When
        List<KeywordService.KeywordSuggestion> results = keywordService.analyzeKeywords(item, null);

        // Then — recovery cannot fix an inner-object without closing brace,
        // so analyzeKeywords returns empty list via its catch block
        assertThat(results).isEmpty();
    }

    @Test
    void applyKeywords_deletesExistingMappings() {
        // Given — existing mappings exist for the item
        Long itemId = 10L;
        Long userId = 1L;

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("微服务");
        kw.setNew(true);
        kw.setSelected(true);

        ItemConcept existingMapping = new ItemConcept();
        existingMapping.setId(1L);
        existingMapping.setItemId(itemId);
        when(itemConceptRepository.findByItemId(itemId)).thenReturn(List.of(existingMapping));

        Concept existingConcept = new Concept();
        existingConcept.setId(100L);
        existingConcept.setUserId(userId);
        existingConcept.setLabel("微服务");
        when(conceptRepository.findByUserIdAndLabel(userId, "微服务")).thenReturn(Optional.of(existingConcept));

        // When
        keywordService.applyKeywords(itemId, userId, List.of(kw));

        // Then — existing mappings are deleted first
        verify(itemConceptRepository).deleteByItemId(itemId);
        verify(conceptRepository, never()).save(any());
        verify(itemConceptRepository).save(any(ItemConcept.class));
    }

    @Test
    void analyzeAndApplyKeywordsAsync_appliesKeywords() {
        // Given — full chain: analyzeKeywords returns keywords → applyKeywords is called
        InformationItem item = new InformationItem();
        item.setId(10L);
        item.setUserId(1L);
        item.setTitle("微服务架构");
        item.setAiSummary("微服务架构的核心概念");

        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        try {
            String contentJson = objectMapper.writeValueAsString(
                    java.util.Map.of("keywords", List.of(
                            java.util.Map.of("label", "微服务", "isNew", false, "isSelected", true, "confidence", 0.9, "reason", "核心主题")
                    ))
            );
            String responseBody = objectMapper.writeValueAsString(
                    java.util.Map.of("choices", List.of(
                            java.util.Map.of("message", java.util.Map.of("content", contentJson))
                    ))
            );

            when(httpResponse.statusCode()).thenReturn(200);
            when(httpResponse.body()).thenReturn(responseBody);
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                    .thenReturn(httpResponse);
        } catch (Exception e) {
            // Won't happen
        }

        lenient().when(itemConceptRepository.findByItemId(10L)).thenReturn(List.of());
        lenient().when(conceptRepository.findByUserIdAndLabel(eq(1L), eq("微服务"))).thenReturn(Optional.empty());
        Concept savedConcept = new Concept();
        savedConcept.setId(100L);
        lenient().when(conceptRepository.save(any(Concept.class))).thenReturn(savedConcept);

        // When
        keywordService.analyzeAndApplyKeywordsAsync(item, null);

        // Then
        verify(conceptRepository).save(any(Concept.class));
        verify(itemConceptRepository).save(any(ItemConcept.class));
    }

    @Test
    void analyzeAndApplyKeywordsAsync_skipsWhenKeywordsEmpty() {
        // Given — analyzeKeywords returns empty keywords → applyKeywords should NOT be called
        InformationItem item = new InformationItem();
        item.setId(10L);
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要");

        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        try {
            String contentJson = "{\"keywords\": []}";
            String responseBody = objectMapper.writeValueAsString(
                    java.util.Map.of("choices", List.of(
                            java.util.Map.of("message", java.util.Map.of("content", contentJson))
                    ))
            );
            when(httpResponse.statusCode()).thenReturn(200);
            when(httpResponse.body()).thenReturn(responseBody);
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                    .thenReturn(httpResponse);
        } catch (Exception e) {
            // Won't happen
        }

        // When
        keywordService.analyzeAndApplyKeywordsAsync(item, null);

        // Then — applyKeywords should not be called
        verify(itemConceptRepository, never()).findByItemId(any());
    }

    @Test
    void analyzeAndApplyKeywordsAsync_catchesException() {
        // Given — HTTP call throws → analyzeKeywords returns empty → no applyKeywords
        InformationItem item = new InformationItem();
        item.setId(10L);
        item.setUserId(1L);
        item.setTitle("测试");
        item.setAiSummary("摘要");

        lenient().when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(conceptRepository.findByUserId(1L)).thenReturn(List.of());

        try {
            when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                    .thenThrow(new java.io.IOException("Connection refused"));
        } catch (Exception e) {
            // Won't happen
        }

        // When — should not throw despite HTTP error (exception caught internally)
        keywordService.analyzeAndApplyKeywordsAsync(item, null);

        // Then — exception is caught, applyKeywords never called
        verify(itemConceptRepository, never()).findByItemId(any());
    }

    @Test
    void applyKeywords_handlesNullConfidenceAndReason() {
        // Given
        Long itemId = 10L;
        Long userId = 1L;

        KeywordService.KeywordSuggestion kw = new KeywordService.KeywordSuggestion();
        kw.setLabel("微服务");
        kw.setNew(false);
        kw.setSelected(true);
        // confidence and reason remain null

        when(itemConceptRepository.findByItemId(itemId)).thenReturn(List.of());

        Concept existingConcept = new Concept();
        existingConcept.setId(100L);
        existingConcept.setUserId(userId);
        existingConcept.setLabel("微服务");
        when(conceptRepository.findByUserIdAndLabel(userId, "微服务")).thenReturn(Optional.of(existingConcept));

        // When
        keywordService.applyKeywords(itemId, userId, List.of(kw));

        // Then — no NPE, mapping saved with null values
        verify(itemConceptRepository).save(itemConceptCaptor.capture());
        ItemConcept savedMapping = itemConceptCaptor.getValue();
        assertThat(savedMapping.getConfidence()).isNull();
        assertThat(savedMapping.getReason()).isNull();
    }
}
