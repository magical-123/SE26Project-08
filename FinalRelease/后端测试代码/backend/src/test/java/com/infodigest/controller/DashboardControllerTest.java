package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.DashboardInsightService;
import com.infodigest.service.ReviewCardGenerationService;
import com.infodigest.service.UserDailyStatsService;
import com.infodigest.service.WordCloudService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @Mock
    private UserReportRepository userReportRepository;

    @Mock
    private ReviewCardRepository reviewCardRepository;

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AIConfigRepository aiConfigRepository;

    @Mock
    private DashboardInsightService dashboardInsightService;

    @Mock
    private ReviewCardGenerationService reviewCardGenerationService;

    @Mock
    private WordCloudService wordCloudService;

    @Mock
    private UserDailyStatsService dailyStatsService;

    @InjectMocks
    private DashboardController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        lenient().when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getNutrition_ReturnsNutritionData() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setProcessStatus("PROCESSED");
        item.setNutritionProtein(40);
        item.setNutritionCarbs(30);
        item.setNutritionVitamins(20);
        item.setNutritionFats(5);
        item.setNutritionFiber(5);
        item.setCrawledAt(LocalDateTime.now());
        item.setDurationMinutes(10);

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getNutrition("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasData"));
        assertNotNull(body.get("data"));
        assertNotNull(body.get("totalHours"));
    }

    @Test
    void getNutrition_ReturnsNoDataWhenEmpty() {
        // Given
        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Collections.emptyList());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getNutrition("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("hasData"));
        assertEquals(0.0, body.get("totalHours"));
    }

    @Test
    void getInsights_ReturnsInsights() {
        // Given
        Map<String, Object> mockInsight = Map.of(
                "id", 1,
                "summary", "你最近对技术架构关注度上升",
                "fullText", "你最近对技术架构的关注度显著上升，建议深入学习。",
                "hasData", true
        );
        when(dashboardInsightService.getDashboardInsight(1L)).thenReturn(mockInsight);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getInsights();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("你最近对技术架构关注度上升", body.get(0).get("summary"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getSummary_ReturnsSummaryStats() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setCrawledAt(LocalDateTime.now());
        item1.setDurationMinutes(30);

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setIsPremium(true);
        item2.setCrawledAt(LocalDateTime.now());
        item2.setDurationMinutes(20);

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(item1, item2));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getSummary();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("todayViews"));
        assertNotNull(body.get("premiumCount"));
        assertNotNull(body.get("immersionHours"));
    }

    @Test
    void getTodayReviews_ReturnsReviewCards() {
        // Given
        Map<String, Object> card1 = Map.of("title", "什么是LoRA?", "content", "微调大模型的高效技术");
        Map<String, Object> card2 = Map.of("title", "锚定效应", "content", "人们依赖最初的信息做决策");
        when(reviewCardGenerationService.getTodayReviewCards(1L)).thenReturn(List.of(card1, card2));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTodayReviews();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
        assertEquals("什么是LoRA?", body.get(0).get("title"));
    }

    @Test
    void getWordCloud_ReturnsWordCloudData() throws Exception {
        // Given
        Map<String, Object> kw1 = Map.of("word", "大模型架构", "weight", 100);
        Map<String, Object> kw2 = Map.of("word", "React 19", "weight", 80);
        Map<String, Object> wordCloudData = Map.of("keywords", List.of(kw1, kw2));
        when(wordCloudService.getWordCloud(1L, LocalDate.now())).thenReturn(wordCloudData);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordCloud();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
    }

    // ==================== Nutrition (additional types) ====================

    @Test
    void getNutrition_WithAllType_UsesHistoricalStats() {
        // Given
        UserDailyStatsService.HistoricalStats historicalStats = new UserDailyStatsService.HistoricalStats();
        historicalStats.totalSeconds = 7200;
        historicalStats.proteinSeconds = 3600;
        historicalStats.carbsSeconds = 1800;
        historicalStats.vitaminsSeconds = 900;
        historicalStats.fatsSeconds = 450;
        historicalStats.fiberSeconds = 450;
        when(dailyStatsService.getHistoricalStats(anyLong(), any(LocalDate.class))).thenReturn(historicalStats);

        InformationItem todayItem = new InformationItem();
        todayItem.setId(2L);
        todayItem.setUserId(1L);
        todayItem.setProcessStatus("PROCESSED");
        todayItem.setNutritionProtein(40);
        todayItem.setNutritionCarbs(30);
        todayItem.setNutritionVitamins(20);
        todayItem.setNutritionFats(5);
        todayItem.setNutritionFiber(5);
        todayItem.setCrawledAt(LocalDateTime.now());
        todayItem.setDurationMinutes(10);
        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(todayItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getNutrition("all");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasData"));
        assertNotNull(body.get("data"));
        assertNotNull(body.get("totalHours"));
    }

    @Test
    void getNutrition_WithDailyType() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setProcessStatus("PROCESSED");
        item.setNutritionProtein(40);
        item.setNutritionCarbs(30);
        item.setNutritionVitamins(20);
        item.setNutritionFats(5);
        item.setNutritionFiber(5);
        item.setCrawledAt(LocalDateTime.now());
        item.setDurationMinutes(10);
        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getNutrition("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasData"));
        assertNotNull(body.get("data"));
        assertNotNull(body.get("totalHours"));
    }

    // ==================== WordCloud (fallback & history) ====================

    @Test
    void getWordCloud_FallbackOnException() throws Exception {
        // Given
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service unavailable"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordCloud();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWordCloudHistory_ReturnsHistory() {
        // Given
        Map<String, Object> day1 = Map.of("date", "7天前", "data", List.of(Map.of("name", "AI", "value", 100)));
        Map<String, Object> day2 = Map.of("date", "6天前", "data", List.of(Map.of("name", "React", "value", 80)));
        when(wordCloudService.getWeeklyWordClouds(anyLong(), any(LocalDate.class)))
                .thenReturn(List.of(day1, day2));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordCloudHistory();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
        assertEquals("7天前", body.get(0).get("date"));
    }

    @Test
    void getWordCloudHistory_FallbackOnException() {
        // Given
        when(wordCloudService.getWeeklyWordClouds(anyLong(), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordCloudHistory();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ==================== Word Sources (溯源) ====================

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_ReturnsSources() throws Exception {
        // Given
        InformationItem sourceItem = new InformationItem();
        sourceItem.setId(100L);
        sourceItem.setUserId(1L);
        sourceItem.setTitle("测试视频标题");
        sourceItem.setPlatform("BILIBILI");
        sourceItem.setUrl("http://bilibili.com/video/100");
        sourceItem.setAiSummary("这是一个关于AI的测试视频");
        sourceItem.setCompletionRate(0.85);
        sourceItem.setCrawledAt(LocalDateTime.now());

        Map<String, Object> keywordData = new LinkedHashMap<>();
        keywordData.put("word", "testword");
        keywordData.put("weight", 100);
        keywordData.put("relatedVideos", List.of(100));
        keywordData.put("relatedSources", List.of(
                Map.of("itemId", 100, "title", "Original Title", "platform", "BILIBILI",
                       "url", "http://bilibili.com/video/100", "summary", "A summary")
        ));

        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);
        when(informationItemRepository.findByIdAndUserId(100L, 1L))
                .thenReturn(Optional.of(sourceItem));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.isEmpty());
        assertEquals(100L, body.get(0).get("id"));
        assertEquals("测试视频标题", body.get(0).get("title"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_WordNotFound() throws Exception {
        // Given
        Map<String, Object> keywordData = Map.of("word", "otherword", "weight", 50);
        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("nonexistent", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ==================== Generate WordCloud ====================

    @Test
    void generateWordCloud_Succeeds() throws Exception {
        // Given
        when(wordCloudService.generateWordCloud(anyLong(), any(LocalDate.class))).thenReturn(null);

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateWordCloud(null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("词云生成成功", body.get("message"));
    }

    @Test
    void generateWordCloud_Fails() throws Exception {
        // Given
        doThrow(new RuntimeException("Generation error"))
                .when(wordCloudService).generateWordCloud(anyLong(), any(LocalDate.class));

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateWordCloud(null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("失败"));
    }

    @Test
    void generateWordCloud_WithDateParam_Succeeds() throws Exception {
        // Given
        when(wordCloudService.generateWordCloud(anyLong(), any(LocalDate.class))).thenReturn(null);

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateWordCloud("2026-07-30");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
    }

    @Test
    void generateWordCloud_WithInvalidDate_ReturnsFailure() throws Exception {
        // When
        ResponseEntity<Map<String, Object>> response = controller.generateWordCloud("not-a-date");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    // ==================== Generate Insight ====================

    @Test
    void generateInsight_Succeeds() {
        // Given
        doNothing().when(dashboardInsightService).generateDashboardInsight(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateInsight();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("洞察生成成功", body.get("message"));
    }

    @Test
    void generateInsight_Fails() {
        // Given
        doThrow(new RuntimeException("Insight generation error"))
                .when(dashboardInsightService).generateDashboardInsight(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateInsight();

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("失败"));
    }

    // ==================== Review Card Feedback ====================

    @Test
    void handleReviewFeedback_Succeeds() {
        // Given
        doNothing().when(reviewCardGenerationService).processFeedback(anyLong(), anyLong(), anyBoolean());
        Map<String, Boolean> payload = Map.of("remembered", true);

        // When
        ResponseEntity<Map<String, Object>> response = controller.handleReviewFeedback(1L, payload);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
    }

    @Test
    void handleReviewFeedback_MissingRemembered() {
        // Given
        Map<String, Boolean> payload = Map.of();

        // When
        ResponseEntity<Map<String, Object>> response = controller.handleReviewFeedback(1L, payload);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("Missing"));
    }

    @Test
    void handleReviewFeedback_IllegalArgument() {
        // Given
        doThrow(new IllegalArgumentException("Card not found"))
                .when(reviewCardGenerationService).processFeedback(anyLong(), anyLong(), anyBoolean());
        Map<String, Boolean> payload = Map.of("remembered", true);

        // When
        ResponseEntity<Map<String, Object>> response = controller.handleReviewFeedback(1L, payload);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertEquals("Card not found", body.get("message"));
    }

    // ==================== Delete Review Card ====================

    @Test
    void deleteReviewCard_Succeeds() {
        // Given
        com.infodigest.entity.ReviewCard mockCard = new com.infodigest.entity.ReviewCard();
        mockCard.setId(1L);
        mockCard.setUserId(1L);
        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(mockCard));
        doNothing().when(reviewCardRepository).deleteById(1L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
    }

    @Test
    void deleteReviewCard_NotFound() {
        // Given
        when(reviewCardRepository.findById(1L)).thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        // Card not found should still return success
    }

    // ==================== Generate Review Card ====================

    @Test
    void generateReviewCard_Succeeds() {
        // Given
        doNothing().when(reviewCardGenerationService).generateTodayReviewCard(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateReviewCard();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals("复习卡片生成成功", body.get("message"));
    }

    @Test
    void generateReviewCard_Fails() {
        // Given
        doThrow(new RuntimeException("Generation error"))
                .when(reviewCardGenerationService).generateTodayReviewCard(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateReviewCard();

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("失败"));
    }

    // ==================== Cleanup Duplicates ====================

    @Test
    void cleanupDuplicates_RemovesDuplicates() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setUrl("http://example.com/video");
        item1.setPlatform("BILIBILI");
        item1.setCrawledAt(LocalDateTime.now().minusHours(2));

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setUrl("http://example.com/video");
        item2.setPlatform("BILIBILI");
        item2.setCrawledAt(LocalDateTime.now());

        InformationItem item3 = new InformationItem();
        item3.setId(3L);
        item3.setUserId(1L);
        item3.setUrl("http://unique.com");
        item3.setPlatform("ZHIHU");
        item3.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(new ArrayList<>(List.of(item1, item2, item3)));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupDuplicates();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("deletedCount"));  // item1 should be deleted (older duplicate)
        assertEquals(2, body.get("remainingCount")); // item2 and item3 remain
        verify(informationItemRepository, times(1)).deleteById(1L);
    }

    @Test
    void cleanupTitleDuplicates_RemovesDuplicates() {
        // Given
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setTitle("相同标题");
        item1.setPlatform("BILIBILI");
        item1.setCrawledAt(LocalDateTime.now().minusHours(2));

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setTitle("相同标题");
        item2.setPlatform("BILIBILI");
        item2.setCrawledAt(LocalDateTime.now());

        InformationItem item3 = new InformationItem();
        item3.setId(3L);
        item3.setUserId(1L);
        item3.setTitle("不同标题");
        item3.setPlatform("ZHIHU");
        item3.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(new ArrayList<>(List.of(item1, item2, item3)));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupTitleDuplicates();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("deletedCount"));
        assertEquals(2, body.get("remainingCount"));
        verify(informationItemRepository, times(1)).deleteById(1L);
    }

    // ==================== Reset Premium ====================

    @Test
    void resetPremium_ResetsFlag() {
        // Given
        InformationItem premiumItem = new InformationItem();
        premiumItem.setId(1L);
        premiumItem.setUserId(1L);
        premiumItem.setIsPremium(true);
        premiumItem.setCrawledAt(LocalDateTime.now());

        InformationItem normalItem = new InformationItem();
        normalItem.setId(2L);
        normalItem.setUserId(1L);
        normalItem.setIsPremium(false);
        normalItem.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(premiumItem, normalItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenAnswer(i -> i.getArgument(0));

        // When
        ResponseEntity<Map<String, Object>> response = controller.resetPremium();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("resetCount"));
        verify(informationItemRepository, times(1)).save(premiumItem);
        verify(informationItemRepository, never()).save(normalItem);
    }

    // ==================== Cleanup Mismatched Content ====================

    @Test
    void cleanupMismatchedContent_HandlesBilibili() {
        // Given
        InformationItem badItem = new InformationItem();
        badItem.setId(1L);
        badItem.setUserId(1L);
        badItem.setPlatform("BILIBILI");
        badItem.setTitle("深入理解Transformer架构");
        badItem.setContentRaw("完全不相关的错误字幕内容");
        badItem.setAiSummary("原有不相关摘要");
        badItem.setCrawledAt(LocalDateTime.now());

        InformationItem goodItem = new InformationItem();
        goodItem.setId(2L);
        goodItem.setUserId(1L);
        goodItem.setPlatform("ZHIHU");
        goodItem.setTitle("知乎好问题");
        goodItem.setContentRaw("一些相关内容");
        goodItem.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(badItem, goodItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenAnswer(i -> i.getArgument(0));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupMismatchedContent();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("fixedCount"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    // ==================== Diagnostic ====================

    @SuppressWarnings("unchecked")
    @Test
    void getDiagnostic_ReturnsStats() {
        // Given
        User anotherUser = new User();
        anotherUser.setId(2L);
        anotherUser.setUsername("otheruser");

        when(userRepository.findAll()).thenReturn(List.of(currentUser, anotherUser));
        when(informationItemRepository.findByUserId(1L)).thenReturn(new ArrayList<>());
        when(informationItemRepository.findByUserId(2L)).thenReturn(new ArrayList<>());
        when(aiConfigRepository.findByUserId(anyLong())).thenReturn(Optional.empty());

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getDiagnostic();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.size());
        assertEquals("testuser", body.get(0).get("username"));
        assertEquals("otheruser", body.get(1).get("username"));
    }

    // ==================== Rebuild Stats ====================

    @Test
    void rebuildStats_Succeeds() {
        // Given
        doNothing().when(dailyStatsService).rebuildAllStats(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.rebuildStats();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
    }

    @Test
    void rebuildStats_Fails() {
        // Given
        doThrow(new RuntimeException("Rebuild error"))
                .when(dailyStatsService).rebuildAllStats(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.rebuildStats();

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
    }

    // ==================== Rebuild Stats For All Users ====================

    @Test
    void rebuildStatsForAllUsers_Succeeds() {
        // Given
        User user1 = new User();
        user1.setId(1L);
        user1.setUsername("testuser");
        User user2 = new User();
        user2.setId(2L);
        user2.setUsername("otheruser");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));
        doNothing().when(dailyStatsService).rebuildAllStats(anyLong());

        // When
        ResponseEntity<Map<String, Object>> response = controller.rebuildStatsForAllUsers();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(2, body.get("totalUsers"));
        assertEquals(2, body.get("successCount"));
        assertEquals(0, body.get("failCount"));
        verify(dailyStatsService, times(2)).rebuildAllStats(anyLong());
    }

    // ==================== Delete Review Card - different user ====================

    @Test
    void deleteReviewCard_WithDifferentUser_DoesNotDelete() {
        // Given - card belongs to another user
        com.infodigest.entity.ReviewCard mockCard = new com.infodigest.entity.ReviewCard();
        mockCard.setId(1L);
        mockCard.setUserId(99L); // different user
        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(mockCard));

        // When
        ResponseEntity<Map<String, Object>> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        verify(reviewCardRepository, never()).deleteById(anyLong());
    }

    // ==================== Handle Review Feedback - generic Exception ====================

    @Test
    void handleReviewFeedback_GenericException_Returns500() {
        // Given
        doThrow(new RuntimeException("Unexpected database error"))
                .when(reviewCardGenerationService).processFeedback(anyLong(), anyLong(), anyBoolean());
        Map<String, Boolean> payload = Map.of("remembered", true);

        // When
        ResponseEntity<Map<String, Object>> response = controller.handleReviewFeedback(1L, payload);

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("Failed to process feedback"));
    }

    // ==================== Word Sources - snapshot & deleted ====================

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_WithSnapshotSource() throws Exception {
        // Given - word cloud has keyword with snapshot, but item is deleted from DB
        Map<String, Object> keywordData = new LinkedHashMap<>();
        keywordData.put("word", "testword");
        keywordData.put("weight", 100);
        keywordData.put("relatedVideos", List.of(100));
        keywordData.put("relatedSources", List.of(
                Map.of("itemId", 100, "title", "Snapshot Title", "platform", "BILIBILI",
                       "url", "http://bilibili.com/video/100", "summary", "A snapshot summary")
        ));

        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);
        when(informationItemRepository.findByIdAndUserId(100L, 1L))
                .thenReturn(Optional.empty()); // item deleted from DB

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.isEmpty());
        assertEquals(100L, body.get(0).get("id"));
        assertEquals("Snapshot Title", body.get(0).get("title"));
        assertEquals(true, body.get(0).get("deleted"));
        assertEquals(true, body.get(0).get("snapshot"));
    }

    @Test
    void getWordSources_WithDeletedSource_NoSnapshot() throws Exception {
        // Given - word cloud has keyword with videoId but no relatedSources snapshot
        Map<String, Object> keywordData = new LinkedHashMap<>();
        keywordData.put("word", "testword");
        keywordData.put("weight", 100);
        keywordData.put("relatedVideos", List.of(999L)); // no relatedSources in keyword

        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);
        when(informationItemRepository.findByIdAndUserId(999L, 1L))
                .thenReturn(Optional.empty()); // item deleted from DB

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.isEmpty());
        assertEquals(999L, body.get(0).get("id"));
        assertEquals("原始数据已删除", body.get(0).get("title"));
        assertEquals(true, body.get(0).get("deleted"));
        assertEquals(false, body.get(0).get("snapshot"));
    }

    // ==================== Diagnostic with AI Config ====================

    @Test
    void getDiagnostic_WithAIConfig() {
        // Given - user has AI config
        User anotherUser = new User();
        anotherUser.setId(2L);
        anotherUser.setUsername("otheruser");

        com.infodigest.entity.AIConfig aiConfig = new com.infodigest.entity.AIConfig();
        aiConfig.setUserId(1L);
        aiConfig.setCustomModelName("gpt-4");
        aiConfig.setApiEndpoint("https://api.openai.com/v1");
        aiConfig.setApiKey("sk-test12345678key");

        when(userRepository.findAll()).thenReturn(List.of(currentUser));
        when(informationItemRepository.findByUserId(1L)).thenReturn(new ArrayList<>());
        when(aiConfigRepository.findByUserId(1L)).thenReturn(Optional.of(aiConfig));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getDiagnostic();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        Map<String, Object> userStats = body.get(0);
        assertNotNull(userStats.get("aiConfig"));
        Map<String, Object> aiConfigInfo = (Map<String, Object>) userStats.get("aiConfig");
        assertTrue((Boolean) aiConfigInfo.get("configured"));
        assertEquals("gpt-4", aiConfigInfo.get("model"));
        assertTrue((Boolean) aiConfigInfo.get("hasApiKey"));
    }

    @Test
    void getDiagnostic_WithException_ReturnsErrorInList() {
        // Given - findAll throws
        when(userRepository.findAll()).thenThrow(new RuntimeException("Database connection failed"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getDiagnostic();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        Map<String, Object> errorEntry = body.get(0);
        assertTrue(errorEntry.containsKey("error"));
        assertTrue(((String) errorEntry.get("error")).contains("Database connection failed"));
    }

    // ==================== Cleanup Mismatched Content - orphan summary ====================

    @Test
    void cleanupMismatchedContent_OrphanSummary() {
        // Given - item has no real content (contentRaw equals title) but has orphan AI summary
        InformationItem orphanItem = new InformationItem();
        orphanItem.setId(1L);
        orphanItem.setUserId(1L);
        orphanItem.setPlatform("BILIBILI");
        orphanItem.setTitle("深入理解Transformer架构");
        orphanItem.setContentRaw("深入理解Transformer架构"); // equals title → hasRealContent = false
        orphanItem.setAiSummary("完全不相关的美食烹饪技巧摘要");
        orphanItem.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(orphanItem));
        when(informationItemRepository.save(any(InformationItem.class))).thenAnswer(i -> i.getArgument(0));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupMismatchedContent();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(1, body.get("fixedCount"));
        verify(informationItemRepository, times(1)).save(any(InformationItem.class));
    }

    // ==================== P0 - deleteReviewCard catch 块异常 ====================

    @Test
    void deleteReviewCard_FindById抛出异常_返回500() {
        // Given - findById 抛出异常
        when(reviewCardRepository.findById(anyLong())).thenThrow(new RuntimeException("Database error"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("Failed to delete card"));
    }

    @Test
    void deleteReviewCard_DeleteById抛出异常_返回500() {
        // Given - findById 成功，但 deleteById 抛出异常
        com.infodigest.entity.ReviewCard mockCard = new com.infodigest.entity.ReviewCard();
        mockCard.setId(1L);
        mockCard.setUserId(1L);
        when(reviewCardRepository.findById(1L)).thenReturn(Optional.of(mockCard));
        doThrow(new RuntimeException("Delete error")).when(reviewCardRepository).deleteById(1L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.deleteReviewCard(1L);

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("Failed to delete card"));
    }

    // ==================== P0 - rebuildStatsForAllUsers 外层 catch ====================

    @Test
    void rebuildStatsForAllUsers_外层Catch异常_返回500() {
        // Given - userRepository.findAll() 抛出异常
        when(userRepository.findAll()).thenThrow(new RuntimeException("Database connection failed"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.rebuildStatsForAllUsers();

        // Then
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("批量重建失败"));
    }

    // ==================== P0 - getWordSources 异常路径 ====================

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_Keywords为Null_返回空列表() throws Exception {
        // Given - keywords 为 null
        Map<String, Object> wordCloudData = new LinkedHashMap<>();
        wordCloudData.put("keywords", null);
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @Test
    void getWordSources_Service抛出异常_返回空列表() throws Exception {
        // Given - getWordCloud 抛出异常
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_RelatedVideosObj不为List_跳过() throws Exception {
        // Given - relatedVideos 是 String 类型，不是 List
        Map<String, Object> keywordData = new LinkedHashMap<>();
        keywordData.put("word", "testword");
        keywordData.put("relatedVideos", "not_a_list");

        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);

        // When - relatedVideoIds 保持 null，返回空列表
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getWordSources_Obj不为Number_跳过() throws Exception {
        // Given - relatedVideos 列表中元素不是 Number 类型
        Map<String, Object> keywordData = new LinkedHashMap<>();
        keywordData.put("word", "testword");
        keywordData.put("relatedVideos", List.of("not_a_number"));

        Map<String, Object> wordCloudData = Map.of("keywords", List.of(keywordData));
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);

        // When - 所有 obj 都不为 Number，被 filter 掉，relatedVideoIds 为空
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordSources("testword", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ==================== P1 - getNutrition null 营养字段 ====================

    @Test
    void getNutrition_Null营养字段_正常处理() {
        // Given - item 有观看时长但所有营养字段为 null
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setProcessStatus("PROCESSED");
        item.setNutritionProtein(null);
        item.setNutritionCarbs(null);
        item.setNutritionVitamins(null);
        item.setNutritionFats(null);
        item.setNutritionFiber(null);
        item.setCrawledAt(LocalDateTime.now());
        item.setDurationMinutes(10);

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getNutrition("weekly");

        // Then - 有 totalSeconds > 0，应返回 hasData=true
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasData"));
        assertNotNull(body.get("data"));
        List<Map<String, Object>> data = (List<Map<String, Object>>) body.get("data");
        // 所有营养字段为 null，所以 protein/carbs/vitamins/fats 都是 0，fiber 应为 100
        assertEquals(100, data.get(4).get("value")); // fiber
        assertEquals(0.17, (Double) body.get("totalHours"), 0.01);
    }

    // ==================== P1 - getSummary filter 分支 ====================

    @SuppressWarnings("unchecked")
    @Test
    void getSummary_Filter分支_过滤非今日数据() {
        // Given - 部分 item 的 crawledAt 不是今天
        InformationItem todayItem = new InformationItem();
        todayItem.setId(1L);
        todayItem.setUserId(1L);
        todayItem.setCrawledAt(LocalDateTime.now()); // 今天的
        todayItem.setDurationMinutes(30);

        InformationItem yesterdayItem = new InformationItem();
        yesterdayItem.setId(2L);
        yesterdayItem.setUserId(1L);
        yesterdayItem.setCrawledAt(LocalDateTime.now().minusDays(1)); // 昨天的应被 filter 掉
        yesterdayItem.setDurationMinutes(20);

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(todayItem, yesterdayItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getSummary();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(2, body.get("todayViews")); // 总共 2 条
        double immersionHours = (Double) body.get("immersionHours");
        assertEquals(0.5, immersionHours, 0.01); // 只有今天的 30 分钟 = 0.5 小时
    }

    // ==================== P1 - getWordCloud keywords=null ====================

    @Test
    void getWordCloud_Keywords为Null_返回空列表() throws Exception {
        // Given - wordCloudData 中 keywords 为 null
        Map<String, Object> wordCloudData = new LinkedHashMap<>();
        wordCloudData.put("keywords", null);
        when(wordCloudService.getWordCloud(anyLong(), any(LocalDate.class))).thenReturn(wordCloudData);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getWordCloud();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    // ==================== P1 - getCurrentUserId orElseThrow ====================

    @Test
    void getSummary_用户不存在_抛出异常() {
        // Given - 设置一个不存在的用户名
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("nonexistent", null, java.util.List.of()));
        when(userRepository.findByUsername("nonexistent")).thenReturn(Optional.empty());

        // When & Then - getCurrentUserId() 抛出 RuntimeException("User not found")
        assertThrows(RuntimeException.class, () -> controller.getSummary());
    }

    // ==================== P2 - buildUserStats stream filter ====================

    @SuppressWarnings("unchecked")
    @Test
    void getDiagnostic_BuildUserStats各种组合() {
        // Given - 创建一个用户的多种 item 覆盖 aiSummary 和 processStatus 组合
        // Item 1: PROCESSED, aiSummary = "有摘要" → withSummary=1
        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(1L);
        item1.setProcessStatus("PROCESSED");
        item1.setAiSummary("这是一个有效的摘要");

        // Item 2: PROCESSED, aiSummary = null → withoutSummary=1, processedWithoutSummary=1
        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(1L);
        item2.setProcessStatus("PROCESSED");
        item2.setAiSummary(null);

        // Item 3: PROCESSED, aiSummary = "" → withoutSummary=1, processedWithoutSummary=1
        InformationItem item3 = new InformationItem();
        item3.setId(3L);
        item3.setUserId(1L);
        item3.setProcessStatus("PROCESSED");
        item3.setAiSummary("");

        // Item 4: UNPROCESSED, aiSummary = "有摘要" → withSummary=1, unprocessedWithSummary=1
        InformationItem item4 = new InformationItem();
        item4.setId(4L);
        item4.setUserId(1L);
        item4.setProcessStatus("UNPROCESSED");
        item4.setAiSummary("未处理但有摘要");

        // Item 5: UNPROCESSED, aiSummary = null → withoutSummary=1
        InformationItem item5 = new InformationItem();
        item5.setId(5L);
        item5.setUserId(1L);
        item5.setProcessStatus("UNPROCESSED");
        item5.setAiSummary(null);

        // Item 6: FAILED, aiSummary = "有摘要" → withSummary=1, failedWithSummary=1
        InformationItem item6 = new InformationItem();
        item6.setId(6L);
        item6.setUserId(1L);
        item6.setProcessStatus("FAILED");
        item6.setAiSummary("失败但有摘要");

        // Item 7: FAILED, aiSummary = null → withoutSummary=1, failedWithoutSummary=1
        InformationItem item7 = new InformationItem();
        item7.setId(7L);
        item7.setUserId(1L);
        item7.setProcessStatus("FAILED");
        item7.setAiSummary(null);

        when(userRepository.findAll()).thenReturn(List.of(currentUser));
        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(item1, item2, item3, item4, item5, item6, item7));
        when(aiConfigRepository.findByUserId(anyLong())).thenReturn(Optional.empty());

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getDiagnostic();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());

        Map<String, Object> stats = body.get(0);
        // 总数 7
        assertEquals(7L, stats.get("totalItems"));
        // withAiSummary: item1(PROCESSED+非空), item4(UNPROCESSED+非空), item6(FAILED+非空) = 3
        assertEquals(3L, stats.get("withAiSummary"));
        // withoutAiSummary: 7-3 = 4
        assertEquals(4L, stats.get("withoutAiSummary"));
        // unprocessedWithSummary: item4(UNPROCESSED+非空) = 1
        assertEquals(1L, stats.get("unprocessedWithSummary"));
        // processedWithoutSummary: item2(PROCESSED+null), item3(PROCESSED+空) = 2
        assertEquals(2L, stats.get("processedWithoutSummary"));
        // failedWithSummary: item6(FAILED+非空) = 1
        assertEquals(1L, stats.get("failedWithSummary"));
        // failedWithoutSummary: item7(FAILED+null) = 1
        assertEquals(1L, stats.get("failedWithoutSummary"));
    }

    // ==================== P2 - cleanupMismatchedContent 复杂分支 ====================

    @Test
    void cleanupMismatchedContent_Title为Null_跳过() {
        // Given - BILIBILI 平台但 title 为 null，应被跳过
        InformationItem nullTitleItem = new InformationItem();
        nullTitleItem.setId(1L);
        nullTitleItem.setUserId(1L);
        nullTitleItem.setPlatform("BILIBILI");
        nullTitleItem.setTitle(null);
        nullTitleItem.setContentRaw("一些内容");
        nullTitleItem.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(nullTitleItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupMismatchedContent();

        // Then - title 为 null 跳过，无修复
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(0, body.get("fixedCount"));
        verify(informationItemRepository, never()).save(any(InformationItem.class));
    }

    @Test
    void cleanupMismatchedContent_Title为空_跳过() {
        // Given - BILIBILI 平台但 title 为空字符串，应被跳过
        InformationItem emptyTitleItem = new InformationItem();
        emptyTitleItem.setId(1L);
        emptyTitleItem.setUserId(1L);
        emptyTitleItem.setPlatform("BILIBILI");
        emptyTitleItem.setTitle("");
        emptyTitleItem.setContentRaw("一些内容");
        emptyTitleItem.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserId(1L)).thenReturn(List.of(emptyTitleItem));

        // When
        ResponseEntity<Map<String, Object>> response = controller.cleanupMismatchedContent();

        // Then - title 为空跳过，无修复
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(0, body.get("fixedCount"));
        verify(informationItemRepository, never()).save(any(InformationItem.class));
    }

    @Test
    void rebuildStatsForAllUsers_PartialFailure() {
        // Given
        User user1 = new User();
        user1.setId(1L);
        user1.setUsername("testuser");
        User user2 = new User();
        user2.setId(2L);
        user2.setUsername("otheruser");
        when(userRepository.findAll()).thenReturn(List.of(user1, user2));
        doNothing().when(dailyStatsService).rebuildAllStats(1L);
        doThrow(new RuntimeException("Failed for user 2"))
                .when(dailyStatsService).rebuildAllStats(2L);

        // When
        ResponseEntity<Map<String, Object>> response = controller.rebuildStatsForAllUsers();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertEquals(2, body.get("totalUsers"));
        assertEquals(1, body.get("successCount"));
        assertEquals(1, body.get("failCount"));
        assertNotNull(body.get("errors"));
    }
}
