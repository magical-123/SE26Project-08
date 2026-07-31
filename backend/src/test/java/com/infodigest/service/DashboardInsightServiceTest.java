package com.infodigest.service;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardInsightServiceTest {

    @Mock
    private UserReportRepository userReportRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AIService aiService;

    @InjectMocks
    private DashboardInsightService dashboardInsightService;

    @Captor
    private ArgumentCaptor<UserReport> reportCaptor;

    @Test
    void generateDashboardInsight_createsInsightSuccessfully() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();
        LocalDate threeDaysAgo = today.minusDays(3);

        UserReport recentReport = new UserReport();
        recentReport.setReportDate(threeDaysAgo);
        recentReport.setInsightTitle("昨日洞察");
        recentReport.setInsightSummary("用户近期关注AI领域");

        // 近3天有日报
        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(recentReport));

        String aiResponse = "{\"title\":\"AI洞察\",\"summary\":\"用户近期重点关注AI领域\",\"fullText\":\"用户在过去一周内大量观看了AI相关视频\"}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        when(userReportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(userReportRepository).save(reportCaptor.capture());
        UserReport saved = reportCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getInsightTitle()).isEqualTo("AI洞察");
        assertThat(saved.getInsightSummary()).isEqualTo("用户近期重点关注AI领域");
        assertThat(saved.getInsightFullText()).isEqualTo("用户在过去一周内大量观看了AI相关视频");
        assertThat(saved.getType()).isEqualTo(ReportType.DAILY);
        assertThat(saved.getReportDate()).isEqualTo(today);
        assertThat(saved.getVersion()).isEqualTo(1);
    }

    @Test
    void generateDashboardInsight_handlesExceptionGracefully() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport recentReport = new UserReport();
        recentReport.setReportDate(today.minusDays(3));
        recentReport.setInsightTitle("测试洞察");

        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(recentReport));

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenThrow(new RuntimeException("AI服务暂时不可用"));

        // When & Then
        try {
            dashboardInsightService.generateDashboardInsight(userId);
        } catch (RuntimeException e) {
            assertThat(e.getMessage()).contains("生成洞察失败");
        }

        verify(userReportRepository, never()).save(any());
    }

    @Test
    void generateDashboardInsight_fallsBackToSevenDays_whenThreeDaysEmpty() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        // 近3天无日报
        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), eq(today.minusDays(1))))
                .thenReturn(List.of());

        // 近7天有日报
        UserReport weekOldReport = new UserReport();
        weekOldReport.setReportDate(today.minusDays(5));
        weekOldReport.setInsightTitle("上周洞察");
        weekOldReport.setInsightSummary("上周关注分布式系统");
        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), eq(today.minusDays(7)), eq(today.minusDays(1))))
                .thenReturn(List.of(weekOldReport));

        String aiResponse = "{\"title\":\"延续关注\",\"summary\":\"用户持续关注分布式系统\",\"fullText\":\"用户在过去一周继续深入学习分布式系统相关知识\"}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        when(userReportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(userReportRepository).save(reportCaptor.capture());
        assertThat(reportCaptor.getValue().getInsightTitle()).isEqualTo("延续关注");
    }

    @Test
    void generateDashboardInsight_returnsSilently_whenNoReports() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        // 近3天和近7天均无日报
        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of());

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(aiService, never()).generateInsight(anyString(), anyLong());
        verify(userReportRepository, never()).save(any());
    }

    @Test
    void getInsights_returnsInsightList_whenTodayReportExists() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport todayReport = new UserReport();
        todayReport.setId(1L);
        todayReport.setUserId(userId);
        todayReport.setInsightTitle("今日洞察");
        todayReport.setInsightSummary("用户近期关注AI");
        todayReport.setInsightFullText("详细洞察内容");

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.of(todayReport));

        // When
        Map<String, Object> result = dashboardInsightService.getDashboardInsight(userId);

        // Then
        assertThat(result.get("summary")).isEqualTo("用户近期关注AI");
        assertThat(result.get("fullText")).isEqualTo("详细洞察内容");
        assertThat(result.get("hasData")).isEqualTo(true);
        verify(userReportRepository, never()).findTop1ByUserIdAndTypeOrderByReportDateDesc(anyLong(), any());
    }

    @Test
    void getInsights_returnsLatestReport_whenTodayNone() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        UserReport latestReport = new UserReport();
        latestReport.setId(2L);
        latestReport.setInsightSummary("最近一次洞察");
        latestReport.setInsightFullText("最近一次完整洞察内容");

        when(userReportRepository.findTop1ByUserIdAndTypeOrderByReportDateDesc(userId, ReportType.DAILY))
                .thenReturn(List.of(latestReport));

        // When
        Map<String, Object> result = dashboardInsightService.getDashboardInsight(userId);

        // Then
        assertThat(result.get("summary")).isEqualTo("最近一次洞察");
        assertThat(result.get("hasData")).isEqualTo(true);
    }

    @Test
    void generateDashboardInsight_updatesExistingReport() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport recentReport = new UserReport();
        recentReport.setReportDate(today.minusDays(1));
        recentReport.setInsightTitle("昨日洞察");
        recentReport.setInsightSummary("昨日摘要");

        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(recentReport));

        String aiResponse = "{\"title\":\"新洞察\",\"summary\":\"新摘要\",\"fullText\":\"新全文\"}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        UserReport existingTodayReport = new UserReport();
        existingTodayReport.setId(5L);
        existingTodayReport.setUserId(userId);
        existingTodayReport.setType(ReportType.DAILY);
        existingTodayReport.setReportDate(today);
        existingTodayReport.setVersion(2);
        existingTodayReport.setInsightTitle("旧洞察");

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.of(existingTodayReport));

        when(userReportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(userReportRepository).save(reportCaptor.capture());
        UserReport saved = reportCaptor.getValue();
        assertThat(saved.getInsightTitle()).isEqualTo("新洞察");
        assertThat(saved.getVersion()).isEqualTo(3); // 2 + 1
        assertThat(saved.getId()).isEqualTo(5L);
    }

    @Test
    void generateDashboardInsight_usesDefaults_whenJsonMissingFields() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport recentReport = new UserReport();
        recentReport.setReportDate(today.minusDays(1));
        recentReport.setInsightTitle("昨日洞察");
        recentReport.setInsightSummary("昨日摘要");

        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(recentReport));

        String aiResponse = "{\"otherField\":\"value\"}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        when(userReportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(userReportRepository).save(reportCaptor.capture());
        UserReport saved = reportCaptor.getValue();
        assertThat(saved.getInsightTitle()).isEqualTo("AI 洞察");
        assertThat(saved.getInsightSummary()).isEqualTo("");
        assertThat(saved.getInsightFullText()).isEqualTo(aiResponse);
    }

    @Test
    void generateDashboardInsight_handlesNullReportFields() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport recentReport = new UserReport();
        recentReport.setReportDate(today.minusDays(1));
        recentReport.setInsightTitle(null);
        recentReport.setInsightSummary(null);

        when(userReportRepository.findByUserIdAndTypeAndReportDateBetween(
                eq(userId), eq(ReportType.DAILY), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(recentReport));

        String aiResponse = "{\"title\":\"洞察\",\"summary\":\"摘要\",\"fullText\":\"全文\"}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        when(userReportRepository.save(any(UserReport.class))).thenAnswer(inv -> inv.getArgument(0));

        // When
        dashboardInsightService.generateDashboardInsight(userId);

        // Then
        verify(userReportRepository).save(reportCaptor.capture());
        assertThat(reportCaptor.getValue().getInsightTitle()).isEqualTo("洞察");
    }

    @Test
    void getDashboardInsight_returnsDefault_whenNoReports() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());
        when(userReportRepository.findTop1ByUserIdAndTypeOrderByReportDateDesc(userId, ReportType.DAILY))
                .thenReturn(List.of());

        // When
        Map<String, Object> result = dashboardInsightService.getDashboardInsight(userId);

        // Then
        assertThat(result.get("hasData")).isEqualTo(false);
        assertThat(result.get("summary")).isEqualTo("近期未有分析结果");
    }

    @Test
    void getDashboardInsight_returnsLatest_whenTodayReportHasNullSummary() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        UserReport todayReport = new UserReport();
        todayReport.setId(1L);
        todayReport.setInsightSummary(null);
        todayReport.setInsightFullText(null);

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.of(todayReport));

        UserReport latestReport = new UserReport();
        latestReport.setId(2L);
        latestReport.setInsightSummary("最近一次洞察");
        latestReport.setInsightFullText("最近一次完整洞察内容");

        when(userReportRepository.findTop1ByUserIdAndTypeOrderByReportDateDesc(userId, ReportType.DAILY))
                .thenReturn(List.of(latestReport));

        // When
        Map<String, Object> result = dashboardInsightService.getDashboardInsight(userId);

        // Then
        assertThat(result.get("summary")).isEqualTo("最近一次洞察");
        assertThat(result.get("hasData")).isEqualTo(true);
    }

    @Test
    void getDashboardInsight_returnsDefault_whenAllReportsHaveNullSummary() {
        // Given
        Long userId = 1L;
        LocalDate today = LocalDate.now();

        when(userReportRepository.findByUserIdAndTypeAndReportDate(userId, ReportType.DAILY, today))
                .thenReturn(Optional.empty());

        UserReport latestReport = new UserReport();
        latestReport.setId(2L);
        latestReport.setInsightSummary(null);
        latestReport.setInsightFullText(null);

        when(userReportRepository.findTop1ByUserIdAndTypeOrderByReportDateDesc(userId, ReportType.DAILY))
                .thenReturn(List.of(latestReport));

        // When
        Map<String, Object> result = dashboardInsightService.getDashboardInsight(userId);

        // Then
        assertThat(result.get("hasData")).isEqualTo(false);
        assertThat(result.get("summary")).isEqualTo("近期未有分析结果");
    }
}
