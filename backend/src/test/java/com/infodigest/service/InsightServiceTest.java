package com.infodigest.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserReportRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InsightServiceTest {
    @Test
    void nutritionDistributionUsesRealDurationWithEstimatedFallback() throws Exception {
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        InformationItem watched = new InformationItem(); watched.setWatchDurationSeconds(100); watched.setDurationMinutes(60); watched.setNutritionProtein(50); watched.setNutritionFats(50);
        InformationItem estimateOnly = new InformationItem(); estimateOnly.setDurationMinutes(60); estimateOnly.setNutritionProtein(100);
        var method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class); method.setAccessible(true);
        @SuppressWarnings("unchecked") Map<String,Integer> result = (Map<String,Integer>) method.invoke(service, List.of(watched, estimateOnly));
        assertEquals(99, result.get("protein")); assertEquals(1, result.get("fats")); assertEquals(0, result.get("carbs"));
    }

    @Test
    void readsHistoryAndNormalizesWeeklyDate() {
        InsightService service = new InsightService(); UserReportRepository reports = mock(UserReportRepository.class); InformationItemRepository items = mock(InformationItemRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        LocalDate date = LocalDate.of(2026, 7, 22); UserReport report = new UserReport();
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(3L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(new InformationItem()));
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.WEEKLY, LocalDate.of(2026, 7, 20))).thenReturn(Optional.of(report));
        assertTrue(service.getLatestInsight(3L, ReportType.WEEKLY, date).isPresent());
        service.getLatestInsight(3L, ReportType.DAILY, date); service.getHistoryInsights(3L, ReportType.DAILY, date); service.getAllHistoryReports(3L, ReportType.DAILY);
        verify(reports).findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.DAILY, date);
        verify(reports).findByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.DAILY, date);
        verify(reports).findLatestReportsByUserIdAndType(3L, ReportType.DAILY);
    }

    @Test
    void hidesSavedDailyInsightWhenSourceItemsNoLongerExist() {
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        InformationItemRepository items = mock(InformationItemRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(
                eq(3L), eq("PROCESSED"), any(), any())).thenReturn(List.of());

        assertTrue(service.getLatestInsight(3L, ReportType.DAILY, date).isEmpty());
        verify(reports, never()).findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                3L, ReportType.DAILY, date);
    }

    @Test
    void generatesDailyInsightAndSavesFirstVersion() throws Exception {
        InsightService service = new InsightService(); InformationItemRepository items = mock(InformationItemRepository.class); UserReportRepository reports = mock(UserReportRepository.class); AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items); ReflectionTestUtils.setField(service, "reportRepository", reports); ReflectionTestUtils.setField(service, "aiService", ai); ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        InformationItem item = new InformationItem(); item.setPlatform("BILIBILI"); item.setTitle("Test"); item.setWatchDurationSeconds(60); item.setNutritionProtein(40); item.setNutritionCarbs(20); item.setNutritionVitamins(10); item.setNutritionFats(10); item.setNutritionFiber(20);
        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(9L), eq("PROCESSED"), any(), any())).thenReturn(List.of(item));
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(9L, ReportType.DAILY, date)).thenReturn(Optional.empty());
        when(ai.generateInsight(anyString(), eq(9L))).thenReturn("{\"title\":\"t\",\"summary\":\"s\",\"fullText\":\"f\"}");
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));
        UserReport result = service.generateInsight(9L, ReportType.DAILY, date);
        assertEquals(1, result.getVersion()); assertEquals(ReportType.DAILY, result.getType()); verify(ai).generateInsight(anyString(), eq(9L));
    }

    @Test
    void rejectsDailyInsightWhenNoItems() {
        InsightService service = new InsightService(); InformationItemRepository items = mock(InformationItemRepository.class); ReflectionTestUtils.setField(service, "itemRepository", items);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(anyLong(), eq("PROCESSED"), any(), any())).thenReturn(List.of());
        assertThrows(Exception.class, () -> service.generateInsight(9L, ReportType.DAILY, LocalDate.of(2026, 7, 22)));
    }

    @Test
    void generateInsightReturnsExistingReportWhenReportExists() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Test");
        item.setWatchDurationSeconds(60);
        item.setNutritionProtein(40);

        UserReport existingReport = new UserReport();
        existingReport.setVersion(2);

        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(10L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(10L, ReportType.DAILY, date))
                .thenReturn(Optional.of(existingReport));
        when(ai.generateInsight(anyString(), eq(10L)))
                .thenReturn("{\"title\":\"Updated Title\",\"summary\":\"Updated summary\",\"fullText\":\"Updated full text\"}");
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(10L, ReportType.DAILY, date);

        // Then
        assertEquals(3, result.getVersion());
        assertEquals("Updated Title", result.getInsightTitle());
        verify(reports).save(any(UserReport.class));
    }

    // ========== Weekly insight generation tests ==========

    @Test
    @SuppressWarnings("unchecked")
    void generateWeeklyInsightWithoutDailyReports() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        LocalDate monday = LocalDate.of(2026, 7, 20);

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Weekly Video");
        item.setWatchDurationSeconds(120);
        item.setNutritionProtein(60);
        item.setNutritionCarbs(20);
        item.setNutritionFats(20);

        when(reports.findByUserIdAndTypeAndReportDateBetween(eq(5L), eq(ReportType.DAILY), any(), any()))
                .thenReturn(List.of());
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(5L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(ai.generateInsight(anyString(), eq(5L)))
                .thenReturn("{\"title\":\"Weekly Insight\",\"summary\":\"Weekly summary\",\"fullText\":\"Weekly full text\"}");
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(eq(5L), eq(ReportType.WEEKLY), eq(monday)))
                .thenReturn(Optional.empty());
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(5L, ReportType.WEEKLY, monday);

        // Then
        assertNotNull(result);
        assertEquals(ReportType.WEEKLY, result.getType());
        assertEquals(1, result.getVersion());
        assertEquals("Weekly Insight", result.getInsightTitle());
        assertEquals(monday, result.getReportDate());
        verify(ai).generateInsight(anyString(), eq(5L));
        verify(reports).save(any(UserReport.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateWeeklyInsightWithDailyReports() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        LocalDate monday = LocalDate.of(2026, 7, 20);

        UserReport dailyReport = new UserReport();
        dailyReport.setReportDate(LocalDate.of(2026, 7, 22));
        dailyReport.setInsightTitle("Daily Title");
        dailyReport.setInsightSummary("Daily Summary");

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Weekly Video");
        item.setWatchDurationSeconds(120);
        item.setNutritionProtein(60);
        item.setNutritionCarbs(20);
        item.setNutritionFats(20);

        when(reports.findByUserIdAndTypeAndReportDateBetween(eq(6L), eq(ReportType.DAILY), any(), any()))
                .thenReturn(List.of(dailyReport));
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(6L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(ai.generateInsight(anyString(), eq(6L)))
                .thenReturn("{\"title\":\"Weekly With Daily\",\"summary\":\"Summary\",\"fullText\":\"Full text\"}");
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(eq(6L), eq(ReportType.WEEKLY), eq(monday)))
                .thenReturn(Optional.empty());
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(6L, ReportType.WEEKLY, monday);

        // Then
        assertNotNull(result);
        assertEquals("Weekly With Daily", result.getInsightTitle());
        assertEquals(ReportType.WEEKLY, result.getType());
        verify(ai).generateInsight(anyString(), eq(6L));
    }

    @Test
    void generateWeeklyInsightThrowsWhenNoItems() throws Exception {
        // Given
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        InformationItemRepository items = mock(InformationItemRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "itemRepository", items);

        when(reports.findByUserIdAndTypeAndReportDateBetween(anyLong(), any(), any(), any()))
                .thenReturn(List.of());
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(anyLong(), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of());

        // When & Then
        Exception exception = assertThrows(Exception.class,
                () -> service.generateInsight(5L, ReportType.WEEKLY, LocalDate.of(2026, 7, 20)));
        assertTrue(exception.getMessage().contains("本周没有已分析的内容数据"));
    }

    @Test
    void generateWeeklyInsightBumpsVersionOnExistingReport() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        LocalDate monday = LocalDate.of(2026, 7, 20);

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Video");
        item.setWatchDurationSeconds(60);
        item.setNutritionProtein(50);
        item.setNutritionCarbs(50);

        UserReport existingReport = new UserReport();
        existingReport.setVersion(2);

        when(reports.findByUserIdAndTypeAndReportDateBetween(eq(7L), eq(ReportType.DAILY), any(), any()))
                .thenReturn(List.of());
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(7L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(ai.generateInsight(anyString(), eq(7L)))
                .thenReturn("{\"title\":\"Rebuilt Weekly\",\"summary\":\"Summary\",\"fullText\":\"Full\"}");
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(eq(7L), eq(ReportType.WEEKLY), eq(monday)))
                .thenReturn(Optional.of(existingReport));
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(7L, ReportType.WEEKLY, monday);

        // Then
        assertEquals(3, result.getVersion());
        assertEquals("Rebuilt Weekly", result.getInsightTitle());
    }

    // ========== getLatestInsight for WEEKLY type ==========

    @Test
    void getLatestInsightForWeeklyTypeNormalizesToMonday() {
        // Given
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);

        LocalDate wednesday = LocalDate.of(2026, 7, 22);
        LocalDate monday = LocalDate.of(2026, 7, 20);

        UserReport weeklyReport = new UserReport();
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                5L, ReportType.WEEKLY, monday))
                .thenReturn(Optional.of(weeklyReport));

        // When
        Optional<UserReport> result = service.getLatestInsight(5L, ReportType.WEEKLY, wednesday);

        // Then
        assertTrue(result.isPresent());
        assertSame(weeklyReport, result.get());
        verify(reports).findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                5L, ReportType.WEEKLY, monday);
    }

    // ========== calculateNutritionDistribution edge cases ==========

    @Test
    void calculateNutritionDistributionReturnsZerosForEmptyItems() throws Exception {
        // Given
        InsightService service = new InsightService();
        var method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class);
        method.setAccessible(true);

        // When
        @SuppressWarnings("unchecked")
        Map<String, Integer> result = (Map<String, Integer>) method.invoke(service, List.of());

        // Then
        assertEquals(0, result.get("protein"));
        assertEquals(0, result.get("carbs"));
        assertEquals(0, result.get("vitamins"));
        assertEquals(0, result.get("fats"));
        assertEquals(0, result.get("fiber"));
    }

    @Test
    void calculateNutritionDistributionUsesAverageWhenNoDuration() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        // Items with nutrition values but no duration info → totalSeconds == 0 → average path
        InformationItem item1 = new InformationItem();
        item1.setNutritionProtein(100);
        item1.setNutritionCarbs(0);
        item1.setNutritionVitamins(0);
        item1.setNutritionFats(0);
        item1.setNutritionFiber(0);

        InformationItem item2 = new InformationItem();
        item2.setNutritionProtein(0);
        item2.setNutritionCarbs(100);
        item2.setNutritionVitamins(0);
        item2.setNutritionFats(0);
        item2.setNutritionFiber(0);

        var method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class);
        method.setAccessible(true);

        // When
        @SuppressWarnings("unchecked")
        Map<String, Integer> result = (Map<String, Integer>) method.invoke(service, List.of(item1, item2));

        // Then: average of 100 and 0 = 50
        assertEquals(50, result.get("protein"));
        assertEquals(50, result.get("carbs"));
        assertEquals(0, result.get("vitamins"));
        assertEquals(0, result.get("fats"));
        assertEquals(0, result.get("fiber"));
    }

    // ========== parseInsightResponse edge cases ==========

    @Test
    void parseInsightResponseHandlesMarkdownPrefix() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        var method = InsightService.class.getDeclaredMethod("parseInsightResponse", String.class);
        method.setAccessible(true);

        String response = "```json\n{\"title\":\"Test\",\"summary\":\"Summary\",\"fullText\":\"Full\"}\n```";

        // When
        @SuppressWarnings("unchecked")
        Map<String, String> result = (Map<String, String>) method.invoke(service, response);

        // Then
        assertEquals("Test", result.get("title"));
        assertEquals("Summary", result.get("summary"));
        assertEquals("Full", result.get("fullText"));
    }

    @Test
    void parseInsightResponseThrowsForMissingFields() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        var method = InsightService.class.getDeclaredMethod("parseInsightResponse", String.class);
        method.setAccessible(true);

        String response = "{\"title\":\"Test\",\"summary\":\"Summary\"}";

        // When & Then
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            try {
                method.invoke(service, response);
            } catch (java.lang.reflect.InvocationTargetException e) {
                throw (RuntimeException) e.getCause();
            }
        });
        assertTrue(exception.getMessage().contains("JSON 格式不正确"));
        assertTrue(exception.getMessage().contains("必需字段"));
    }

    // ========== buildVideoList edge cases ==========

    @Test
    void buildVideoListLimitsToTenItems() throws Exception {
        // Given
        InsightService service = new InsightService();

        List<InformationItem> items = new ArrayList<>();
        for (int i = 0; i < 15; i++) {
            InformationItem item = new InformationItem();
            item.setPlatform("BILIBILI");
            item.setTitle("Video " + (i + 1));
            item.setWatchDurationSeconds(60);
            item.setNutritionProtein(100);
            item.setNutritionCarbs(0);
            item.setNutritionVitamins(0);
            item.setNutritionFats(0);
            item.setNutritionFiber(0);
            items.add(item);
        }

        var method = InsightService.class.getDeclaredMethod("buildVideoList", List.class);
        method.setAccessible(true);

        // When
        String result = (String) method.invoke(service, items);

        // Then
        assertTrue(result.contains("... 还有 5 个视频未列出"));
        assertTrue(result.contains("10. [BILIBILI] Video 10"));
        assertFalse(result.contains("11. [BILIBILI] Video 11"));
    }

    // ========== getHistoryInsights / getAllHistoryReports coverage ==========

    @Test
    void getHistoryInsightsDelegatesToRepository() {
        // Given
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);

        LocalDate date = LocalDate.of(2026, 7, 22);
        when(reports.findByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.WEEKLY, date))
                .thenReturn(List.of(new UserReport()));

        // When
        List<UserReport> result = service.getHistoryInsights(3L, ReportType.WEEKLY, date);

        // Then
        assertEquals(1, result.size());
        verify(reports).findByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.WEEKLY, date);
    }

    @Test
    void getAllHistoryReportsDelegatesToRepository() {
        // Given
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);

        when(reports.findLatestReportsByUserIdAndType(3L, ReportType.WEEKLY))
                .thenReturn(List.of(new UserReport()));

        // When
        List<UserReport> result = service.getAllHistoryReports(3L, ReportType.WEEKLY);

        // Then
        assertEquals(1, result.size());
        verify(reports).findLatestReportsByUserIdAndType(3L, ReportType.WEEKLY);
    }

    // ========== Additional parseInsightResponse tests ==========

    @Test
    void parseInsightResponseHandlesOnlyBacktickPrefix() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        var method = InsightService.class.getDeclaredMethod("parseInsightResponse", String.class);
        method.setAccessible(true);

        String response = "```\n{\"title\":\"Test\",\"summary\":\"Summary\",\"fullText\":\"Full\"}\n```";

        // When
        @SuppressWarnings("unchecked")
        Map<String, String> result = (Map<String, String>) method.invoke(service, response);

        // Then
        assertEquals("Test", result.get("title"));
        assertEquals("Summary", result.get("summary"));
        assertEquals("Full", result.get("fullText"));
    }

    @Test
    void parseInsightResponseThrowsForInvalidJson() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        var method = InsightService.class.getDeclaredMethod("parseInsightResponse", String.class);
        method.setAccessible(true);

        String response = "not json at all";

        // When & Then
        assertThrows(Exception.class, () -> {
            try {
                method.invoke(service, response);
            } catch (java.lang.reflect.InvocationTargetException e) {
                throw e.getCause();
            }
        });
    }

    // ========== buildVideoList additional tests ==========

    @Test
    void buildVideoListHandlesNullFields() throws Exception {
        // Given
        InsightService service = new InsightService();

        InformationItem item = new InformationItem();
        item.setPlatform(null);
        item.setTitle(null);
        item.setNutritionProtein(null);
        item.setNutritionCarbs(null);
        item.setNutritionVitamins(null);
        item.setNutritionFats(null);
        item.setNutritionFiber(null);
        item.setAiSummary(null);

        var method = InsightService.class.getDeclaredMethod("buildVideoList", List.class);
        method.setAccessible(true);

        // When
        String result = (String) method.invoke(service, List.of(item));

        // Then
        assertNotNull(result);
        assertTrue(result.contains("暂无摘要"));
    }

    @Test
    void buildVideoListWithFewerThanTenItems() throws Exception {
        // Given
        InsightService service = new InsightService();

        List<InformationItem> items = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            InformationItem item = new InformationItem();
            item.setPlatform("BILIBILI");
            item.setTitle("Video " + (i + 1));
            item.setWatchDurationSeconds(60);
            item.setNutritionProtein(100);
            items.add(item);
        }

        var method = InsightService.class.getDeclaredMethod("buildVideoList", List.class);
        method.setAccessible(true);

        // When
        String result = (String) method.invoke(service, items);

        // Then
        assertFalse(result.contains("... 还有"));
        assertTrue(result.contains("3. [BILIBILI] Video 3"));
    }

    // ========== calculateNutritionDistribution additional tests ==========

    @Test
    void calculateNutritionDistributionWithNullNutritionFields() throws Exception {
        // Given
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        InformationItem item = new InformationItem();
        item.setWatchDurationSeconds(60);
        // Only set protein, leave other nutrition fields null
        item.setNutritionProtein(100);

        var method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class);
        method.setAccessible(true);

        // When
        @SuppressWarnings("unchecked")
        Map<String, Integer> result = (Map<String, Integer>) method.invoke(service, List.of(item));

        // Then
        assertEquals(100, result.get("protein"));
        assertEquals(0, result.get("carbs"));
        assertEquals(0, result.get("vitamins"));
        assertEquals(0, result.get("fats"));
        assertEquals(0, result.get("fiber"));
    }

    // ========== getLatestInsight additional tests ==========

    @Test
    void getLatestInsightForDailyReturnsEmptyWhenItemsExistButNoReport() {
        // Given
        InsightService service = new InsightService();
        UserReportRepository reports = mock(UserReportRepository.class);
        InformationItemRepository items = mock(InformationItemRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "itemRepository", items);

        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(
                eq(3L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(new InformationItem()));
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                3L, ReportType.DAILY, date))
                .thenReturn(Optional.empty());

        // When
        Optional<UserReport> result = service.getLatestInsight(3L, ReportType.DAILY, date);

        // Then
        assertTrue(result.isEmpty());
    }

    // ========== generateWeeklyInsight with non-Monday date ==========

    @Test
    void generateWeeklyInsightWithWednesdayDate() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        LocalDate wednesday = LocalDate.of(2026, 7, 22);
        LocalDate monday = LocalDate.of(2026, 7, 20);

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Weekly Video");
        item.setWatchDurationSeconds(120);
        item.setNutritionProtein(60);
        item.setNutritionCarbs(20);
        item.setNutritionFats(20);

        when(reports.findByUserIdAndTypeAndReportDateBetween(eq(14L), eq(ReportType.DAILY), any(), any()))
                .thenReturn(List.of());
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(14L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(ai.generateInsight(anyString(), eq(14L)))
                .thenReturn("{\"title\":\"W\",\"summary\":\"S\",\"fullText\":\"F\"}");
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(eq(14L), eq(ReportType.WEEKLY), eq(monday)))
                .thenReturn(Optional.empty());
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(14L, ReportType.WEEKLY, wednesday);

        // Then
        assertEquals(monday, result.getReportDate());
        verify(reports).save(any(UserReport.class));
    }

    // ========== buildDailyInsightsSummary tests ==========

    @Test
    void buildDailyInsightsSummaryWithMultipleReports() throws Exception {
        // Given
        InsightService service = new InsightService();

        UserReport day1 = new UserReport();
        day1.setReportDate(LocalDate.of(2026, 7, 20));
        day1.setInsightTitle("Monday Insight");
        day1.setInsightSummary("Monday summary");

        UserReport day2 = new UserReport();
        day2.setReportDate(LocalDate.of(2026, 7, 21));
        day2.setInsightTitle("Tuesday Insight");
        day2.setInsightSummary("Tuesday summary");

        var method = InsightService.class.getDeclaredMethod("buildDailyInsightsSummary", List.class);
        method.setAccessible(true);

        // When
        String result = (String) method.invoke(service, List.of(day1, day2));

        // Then
        assertTrue(result.contains("Monday Insight"));
        assertTrue(result.contains("Tuesday summary"));
        assertTrue(result.contains("MONDAY"));
        assertTrue(result.contains("TUESDAY"));
    }

    // ========== generateDailyInsight with various AI response formats ==========

    @Test
    void generateDailyInsightWithOnlyBacktickPrefix() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Test");
        item.setWatchDurationSeconds(60);
        item.setNutritionProtein(40);
        item.setNutritionCarbs(20);
        item.setNutritionVitamins(10);
        item.setNutritionFats(10);
        item.setNutritionFiber(20);

        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(12L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(eq(12L), eq(ReportType.DAILY), eq(date)))
                .thenReturn(Optional.empty());
        when(ai.generateInsight(anyString(), eq(12L)))
                .thenReturn("```\n{\"title\":\"T\",\"summary\":\"S\",\"fullText\":\"F\"}\n```");
        when(reports.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        UserReport result = service.generateInsight(12L, ReportType.DAILY, date);

        // Then
        assertEquals("T", result.getInsightTitle());
    }

    @Test
    void generateDailyInsightWithInvalidJsonFromAi() throws Exception {
        // Given
        InsightService service = new InsightService();
        InformationItemRepository items = mock(InformationItemRepository.class);
        UserReportRepository reports = mock(UserReportRepository.class);
        AIService ai = mock(AIService.class);
        ReflectionTestUtils.setField(service, "itemRepository", items);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        ReflectionTestUtils.setField(service, "aiService", ai);
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());

        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setTitle("Test");
        item.setWatchDurationSeconds(60);
        item.setNutritionProtein(40);
        item.setNutritionCarbs(20);
        item.setNutritionVitamins(10);
        item.setNutritionFats(10);
        item.setNutritionFiber(20);

        LocalDate date = LocalDate.of(2026, 7, 22);
        when(items.findByUserIdAndProcessStatusAndCrawledAtBetween(eq(13L), eq("PROCESSED"), any(), any()))
                .thenReturn(List.of(item));
        when(ai.generateInsight(anyString(), eq(13L)))
                .thenReturn("This is not valid JSON");

        // When & Then
        assertThrows(Exception.class,
                () -> service.generateInsight(13L, ReportType.DAILY, date));
    }
}
