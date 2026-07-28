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
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InsightServiceTest {
    @Test
    void nutritionDistributionUsesRealViewingDurationOnly() throws Exception {
        InsightService service = new InsightService();
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        InformationItem watched = new InformationItem(); watched.setWatchDurationSeconds(100); watched.setDurationMinutes(60); watched.setNutritionProtein(50); watched.setNutritionFats(50);
        InformationItem estimateOnly = new InformationItem(); estimateOnly.setDurationMinutes(60); estimateOnly.setNutritionProtein(100);
        var method = InsightService.class.getDeclaredMethod("calculateNutritionDistribution", List.class); method.setAccessible(true);
        @SuppressWarnings("unchecked") Map<String,Integer> result = (Map<String,Integer>) method.invoke(service, List.of(watched, estimateOnly));
        assertEquals(50, result.get("protein")); assertEquals(50, result.get("fats")); assertEquals(0, result.get("carbs"));
    }

    @Test
    void readsHistoryAndNormalizesWeeklyDate() {
        InsightService service = new InsightService(); UserReportRepository reports = mock(UserReportRepository.class);
        ReflectionTestUtils.setField(service, "reportRepository", reports);
        LocalDate date = LocalDate.of(2026, 7, 22); UserReport report = new UserReport();
        when(reports.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.WEEKLY, LocalDate.of(2026, 7, 20))).thenReturn(Optional.of(report));
        assertTrue(service.getLatestInsight(3L, ReportType.WEEKLY, date).isPresent());
        service.getLatestInsight(3L, ReportType.DAILY, date); service.getHistoryInsights(3L, ReportType.DAILY, date); service.getAllHistoryReports(3L, ReportType.DAILY);
        verify(reports).findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.DAILY, date);
        verify(reports).findByUserIdAndTypeAndReportDateOrderByVersionDesc(3L, ReportType.DAILY, date);
        verify(reports).findLatestReportsByUserIdAndType(3L, ReportType.DAILY);
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
}
