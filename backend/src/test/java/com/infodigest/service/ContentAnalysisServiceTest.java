package com.infodigest.service;

import com.infodigest.dto.AnalysisResultDTO;
import com.infodigest.dto.AnalysisResultDTO.QuoteItem;
import com.infodigest.entity.AIConfig;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.QuoteExtract;
import com.infodigest.entity.User;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.QuoteExtractRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContentAnalysisServiceTest {

    @Mock
    private InformationItemRepository itemRepository;

    @Mock
    private AIConfigRepository configRepository;

    @Mock
    private AIService aiService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private QuoteExtractRepository quoteExtractRepository;

    @Mock
    private UserDailyStatsService dailyStatsService;

    private ContentAnalysisService service;

    private InformationItem createItem(Long id, Long userId, Integer protein, Integer carbs,
                                       Integer vitamins, Integer fats, Integer fiber,
                                       String summary, String contentRaw, String title,
                                       String platform, Integer durationMinutes) {
        InformationItem item = new InformationItem();
        item.setId(id);
        item.setUserId(userId);
        item.setTitle(title);
        item.setPlatform(platform);
        item.setDurationMinutes(durationMinutes);
        item.setContentRaw(contentRaw);
        item.setNutritionProtein(protein);
        item.setNutritionCarbs(carbs);
        item.setNutritionVitamins(vitamins);
        item.setNutritionFats(fats);
        item.setNutritionFiber(fiber);
        item.setAiSummary(summary);
        item.setProcessStatus("UNPROCESSED");
        return item;
    }

    @BeforeEach
    void setUp() {
        service = new ContentAnalysisService();
        ReflectionTestUtils.setField(service, "itemRepository", itemRepository);
        ReflectionTestUtils.setField(service, "configRepository", configRepository);
        ReflectionTestUtils.setField(service, "aiService", aiService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "quoteExtractRepository", quoteExtractRepository);
        ReflectionTestUtils.setField(service, "dailyStatsService", dailyStatsService);
    }

    // --- analyzeItem tests ---

    @Test
    void analyzeItem_skipsWhenBothNutritionAndSummaryExist() throws Exception {
        InformationItem item = createItem(1L, 10L, 50, 30, 10, 5, 5,
                "Existing summary", "Some content", "Test Title", "Bilibili", 10);
        when(itemRepository.findById(1L)).thenReturn(Optional.of(item));

        service.analyzeItem(1L);

        verify(aiService, never()).analyze(any(), anyString(), anyString());
        verify(itemRepository, never()).updateAnalysisFields(anyLong(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void analyzeItem_performsNutritionAnalysisWhenMissing() throws Exception {
        InformationItem item = createItem(2L, 20L, null, null, null, null, null,
                null, "Test content for analysis", "Test Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");
        config.setApiKey("key");

        User user = new User();
        user.setSelfPortrait("I love deep tech content");

        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good content", "A fine summary", null);

        when(itemRepository.findById(2L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(20L)).thenReturn(Optional.of(config));
        when(userRepository.findById(20L)).thenReturn(Optional.of(user));
        when(aiService.analyze(eq(config), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(2L)).thenReturn(Optional.of(item));

        service.analyzeItem(2L);

        verify(aiService).analyze(eq(config), anyString(), anyString());
        verify(itemRepository).updateAnalysisFields(eq(2L), eq(40), eq(30), eq(10), eq(10), eq(10),
                eq("Good content"), eq("A fine summary"), any(LocalDateTime.class));
        verify(dailyStatsService).updateDailyStats(eq(20L), any(InformationItem.class));
    }

    @Test
    void analyzeItem_handlesRateLimitByRethrowing() throws Exception {
        InformationItem item = createItem(3L, 30L, null, null, null, null, null,
                null, "Content", "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        when(itemRepository.findById(3L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(30L)).thenReturn(Optional.of(config));
        when(userRepository.findById(30L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("429 Too Many Requests"));

        Exception ex = assertThrows(RuntimeException.class, () -> service.analyzeItem(3L));
        assertTrue(ex.getMessage().contains("429"));

        verify(itemRepository).updateProcessStatus(3L, "UNPROCESSED");
        verify(itemRepository, never()).updateAnalysisFields(anyLong(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void analyzeItem_handlesRateLimit_msgContainsRateLimit() throws Exception {
        InformationItem item = createItem(31L, 31L, null, null, null, null, null,
                null, "Content", "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        when(itemRepository.findById(31L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(31L)).thenReturn(Optional.of(config));
        when(userRepository.findById(31L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("rate limit exceeded"));

        Exception ex = assertThrows(RuntimeException.class, () -> service.analyzeItem(31L));
        assertTrue(ex.getMessage().toLowerCase().contains("rate limit"));

        verify(itemRepository).updateProcessStatus(31L, "UNPROCESSED");
    }

    @Test
    void analyzeItem_marksFailedOnNonRateLimitError() throws Exception {
        InformationItem item = createItem(4L, 40L, null, null, null, null, null,
                null, "Content", "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        when(itemRepository.findById(4L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(40L)).thenReturn(Optional.of(config));
        when(userRepository.findById(40L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString()))
                .thenThrow(new RuntimeException("API key invalid"));

        service.analyzeItem(4L);

        verify(itemRepository).updateProcessStatus(4L, "FAILED");
        verify(itemRepository, never()).updateProcessStatus(4L, "UNPROCESSED");
    }

    // --- saveQuotesFromAnalysis tests (via analyzeItem) ---

    @Test
    void saveQuotesFromAnalysis_savesAndTrimsTo20QuotesMax() throws Exception {
        InformationItem item = createItem(5L, 50L, null, null, null, null, null,
                null, "This is the original content with a great quote inside it for testing purposes",
                "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        User user = new User();
        user.setId(50L);

        QuoteItem qi1 = new QuoteItem("great quote inside", "Reason 1");
        QuoteItem qi2 = new QuoteItem("for testing purposes", "Reason 2");
        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good", "Summary", List.of(qi1, qi2));

        when(itemRepository.findById(5L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(50L)).thenReturn(Optional.of(config));
        when(userRepository.findById(50L)).thenReturn(Optional.of(user));
        when(aiService.analyze(any(), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(5L)).thenReturn(Optional.of(item));
        when(quoteExtractRepository.findByItemId(5L)).thenReturn(List.of());
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(50L)).thenReturn(List.of());

        service.analyzeItem(5L);

        ArgumentCaptor<List<QuoteExtract>> captor = ArgumentCaptor.captor();
        verify(quoteExtractRepository).saveAll(captor.capture());
        List<QuoteExtract> saved = captor.getValue();
        assertEquals(2, saved.size());
        assertEquals("great quote inside", saved.get(0).getContent());
        assertEquals("for testing purposes", saved.get(1).getContent());
    }

    @Test
    void saveQuotesFromAnalysis_filtersOutQuotesNotFoundInContent() throws Exception {
        InformationItem item = createItem(6L, 60L, null, null, null, null, null,
                null, "Original content here with some text",
                "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        QuoteItem matching = new QuoteItem("Original content here", "Found");
        QuoteItem missing = new QuoteItem("This text does not appear in the original content at all", "Hallucinated");
        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good", "Summary", List.of(matching, missing));

        when(itemRepository.findById(6L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(60L)).thenReturn(Optional.of(config));
        when(userRepository.findById(60L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(6L)).thenReturn(Optional.of(item));
        when(quoteExtractRepository.findByItemId(6L)).thenReturn(List.of());
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(60L)).thenReturn(List.of());

        service.analyzeItem(6L);

        ArgumentCaptor<List<QuoteExtract>> captor = ArgumentCaptor.captor();
        verify(quoteExtractRepository).saveAll(captor.capture());
        List<QuoteExtract> saved = captor.getValue();
        assertEquals(1, saved.size());
        assertEquals("Original content here", saved.get(0).getContent());
    }

    @Test
    void saveQuotesFromAnalysis_deletesExistingQuotesForSameItem() throws Exception {
        InformationItem item = createItem(7L, 70L, null, null, null, null, null,
                null, "Content with a quote that matches exactly",
                "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        QuoteExtract existing = new QuoteExtract();
        existing.setId(100L);

        QuoteItem qi = new QuoteItem("quote that matches exactly", "Great point");
        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good", "Summary", List.of(qi));

        when(itemRepository.findById(7L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(70L)).thenReturn(Optional.of(config));
        when(userRepository.findById(70L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(7L)).thenReturn(Optional.of(item));
        when(quoteExtractRepository.findByItemId(7L)).thenReturn(List.of(existing));
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(70L)).thenReturn(List.of());

        service.analyzeItem(7L);

        verify(quoteExtractRepository).deleteAll(List.of(existing));
    }

    @Test
    void saveQuotesFromAnalysis_skipsWhenNoQuotes() throws Exception {
        InformationItem item = createItem(8L, 80L, null, null, null, null, null,
                null, "Content here", "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good", "Summary", null);

        when(itemRepository.findById(8L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(80L)).thenReturn(Optional.of(config));
        when(userRepository.findById(80L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(8L)).thenReturn(Optional.of(item));

        service.analyzeItem(8L);

        verify(quoteExtractRepository, never()).saveAll(any());
    }

    @Test
    void saveQuotesFromAnalysis_trimsUserQuotesTo20() throws Exception {
        InformationItem item = createItem(9L, 90L, null, null, null, null, null,
                null, "Matching quote text for trimming test case here",
                "Title", "Bilibili", 10);
        AIConfig config = new AIConfig();
        config.setModelType("GPT_4");

        QuoteItem qi = new QuoteItem("Matching quote text for trimming test case here", "Test");
        AnalysisResultDTO result = new AnalysisResultDTO(40, 30, 10, 10, 10,
                "Good", "Summary", List.of(qi));

        // Simulate 21 existing quotes for the user — exceeds limit of 20 by 1
        List<QuoteExtract> twentyPlusExisting = new java.util.ArrayList<>();
        for (int i = 0; i < 21; i++) {
            QuoteExtract qe = new QuoteExtract();
            qe.setId((long) (100 + i));
            twentyPlusExisting.add(qe);
        }

        when(itemRepository.findById(9L)).thenReturn(Optional.of(item));
        when(configRepository.findByUserId(90L)).thenReturn(Optional.of(config));
        when(userRepository.findById(90L)).thenReturn(Optional.of(new User()));
        when(aiService.analyze(any(), anyString(), anyString())).thenReturn(result);
        when(itemRepository.findById(9L)).thenReturn(Optional.of(item));
        when(quoteExtractRepository.findByItemId(9L)).thenReturn(List.of());
        when(quoteExtractRepository.findByUserIdOrderByCreatedAtDesc(90L)).thenReturn(twentyPlusExisting);

        service.analyzeItem(9L);

        // With 21 existing quotes (mock returns 21), 21 > 20, should trim the oldest 1
        ArgumentCaptor<List<QuoteExtract>> deleteCaptor = ArgumentCaptor.captor();
        verify(quoteExtractRepository).deleteAll(deleteCaptor.capture());
        assertEquals(1, deleteCaptor.getValue().size());
    }

    // --- truncateContent test ---

    @Test
    void truncateContent_truncatesLongContentWithHeadAndTail() {
        // Use reflection to access private method
        String shortContent = "Short content";
        String longContent = "A".repeat(100000);

        String result1 = (String) ReflectionTestUtils.invokeMethod(
                service, "truncateContent", shortContent, 100000);
        assertEquals(shortContent, result1);

        // For a 200k char string with max 100k, truncate should return head + [...省略...] + tail
        String veryLongContent = "B".repeat(200000);
        String result2 = (String) ReflectionTestUtils.invokeMethod(
                service, "truncateContent", veryLongContent, 100000);

        assertNotNull(result2);
        assertTrue(result2.contains("[... 内容省略 ...]"));
        assertTrue(result2.length() < 200000);
        // head = 60000 chars, tail = 30000 chars, plus the ellipsis text
        assertTrue(result2.startsWith("B".repeat(60000)));
        assertTrue(result2.endsWith("B".repeat(30000)));
    }

    // --- buildContentPrompt test ---

    @Test
    void buildContentPrompt_appendsSelfPortraitWhenAvailable() {
        InformationItem item = createItem(10L, 100L, null, null, null, null, null,
                null, "Content body", "Test Title", "Bilibili", 15);

        String result = (String) ReflectionTestUtils.invokeMethod(
                service, "buildContentPrompt", item, "Template {title} {platform} {duration} {content}", "I love deep tech");

        assertNotNull(result);
        assertTrue(result.contains("Test Title"));
        assertTrue(result.contains("Bilibili"));
        assertTrue(result.contains("15"));
        assertTrue(result.contains("Content body"));
        assertTrue(result.contains("I love deep tech"));
        assertTrue(result.contains("用户的个人需求描述"));
    }

    @Test
    void buildContentPrompt_skipsSelfPortraitWhenNull() {
        InformationItem item = createItem(11L, 110L, null, null, null, null, null,
                null, "Content body", "Test Title", "Bilibili", 15);

        String result = (String) ReflectionTestUtils.invokeMethod(
                service, "buildContentPrompt", item, "Template {title} {platform} {duration} {content}", null);

        assertNotNull(result);
        assertTrue(result.contains("Test Title"));
        assertTrue(result.contains("Bilibili"));
        assertFalse(result.contains("用户的个人需求描述"));
    }

    @Test
    void buildContentPrompt_handlesNullFields() {
        InformationItem item = createItem(12L, 120L, null, null, null, null, null,
                null, "Content body", null, null, null);

        String result = (String) ReflectionTestUtils.invokeMethod(
                service, "buildContentPrompt", item, "Template {title} {platform} {duration} {content}", null);

        assertNotNull(result);
        assertTrue(result.contains("Template"));
    }
}
