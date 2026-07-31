package com.infodigest.controller;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.User;
import com.infodigest.entity.UserReport;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.InsightService;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InsightControllerTest {

    @Mock
    private InsightService insightService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private InsightController controller;

    private final User currentUser = new User();

    @BeforeEach
    void setUp() {
        currentUser.setId(1L);
        currentUser.setUsername("testuser");
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.of(currentUser));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, java.util.List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @SuppressWarnings("unchecked")
    @Test
    void getLatestInsight_ReturnsInsights() {
        // Given
        UserReport report = new UserReport();
        report.setId(1L);
        report.setUserId(1L);
        report.setType(ReportType.DAILY);
        report.setReportDate(LocalDate.now());
        report.setInsightTitle("今日洞察");
        report.setInsightSummary("你今天的关注点在大模型架构");
        report.setInsightFullText("完整洞察内容...");
        report.setCreatedAt(LocalDateTime.now());
        report.setUpdatedAt(LocalDateTime.now());
        report.setVersion(1);

        when(insightService.getLatestInsight(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));

        // When
        ResponseEntity<?> response = controller.getLatestInsight("DAILY", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasReport"));
        assertNotNull(body.get("report"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getLatestInsight_ReturnsHasReportFalseWhenNoInsight() {
        // Given
        when(insightService.getLatestInsight(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        // When
        ResponseEntity<?> response = controller.getLatestInsight("DAILY", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("hasReport"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateInsight_RegeneratesInsight() throws Exception {
        // Given
        UserReport report = new UserReport();
        report.setId(1L);
        report.setUserId(1L);
        report.setType(ReportType.DAILY);
        report.setReportDate(LocalDate.now());
        report.setInsightTitle("新生成的洞察");
        report.setInsightSummary("新生成的洞察摘要");
        report.setVersion(1);

        when(insightService.generateInsight(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(report);

        // When
        ResponseEntity<?> response = controller.generateInsight("DAILY", null);

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertNotNull(body.get("report"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getHistoryInsights_ReturnsHistoryList() {
        // Given
        UserReport report1 = new UserReport();
        report1.setId(1L);
        report1.setUserId(1L);
        report1.setType(ReportType.DAILY);
        report1.setReportDate(LocalDate.now().minusDays(1));
        report1.setVersion(1);

        UserReport report2 = new UserReport();
        report2.setId(2L);
        report2.setUserId(1L);
        report2.setType(ReportType.DAILY);
        report2.setReportDate(LocalDate.now().minusDays(1));
        report2.setVersion(2);

        when(insightService.getHistoryInsights(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(List.of(report1, report2));

        // When
        ResponseEntity<?> response = controller.getHistoryInsights("DAILY", LocalDate.now().minusDays(1).toString());

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(2, body.get("count"));
        assertNotNull(body.get("reports"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getAllHistoryReports_ReturnsHistoryList() {
        // Given
        UserReport report1 = new UserReport();
        report1.setId(1L);
        report1.setUserId(1L);
        report1.setType(ReportType.DAILY);
        report1.setReportDate(LocalDate.now().minusDays(1));
        report1.setVersion(1);

        when(insightService.getAllHistoryReports(eq(1L), eq(ReportType.DAILY)))
                .thenReturn(List.of(report1));

        // When
        ResponseEntity<?> response = controller.getAllHistoryReports("DAILY");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(1, body.get("count"));
        assertNotNull(body.get("reports"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateInsight_Exception_ReturnsBadRequest() throws Exception {
        // Given
        when(insightService.generateInsight(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Generation error"));

        // When
        ResponseEntity<?> response = controller.generateInsight("DAILY", null);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("error")).contains("生成洞察失败"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getLatestInsight_Exception_ReturnsBadRequest() {
        // Given
        when(insightService.getLatestInsight(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Service error"));

        // When
        ResponseEntity<?> response = controller.getLatestInsight("DAILY", null);

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("error")).contains("获取洞察失败"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getHistoryInsights_Exception_ReturnsBadRequest() {
        // Given
        when(insightService.getHistoryInsights(eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenThrow(new RuntimeException("History error"));

        // When
        ResponseEntity<?> response = controller.getHistoryInsights("DAILY", LocalDate.now().minusDays(1).toString());

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("error")).contains("获取历史洞察失败"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getAllHistoryReports_Exception_ReturnsBadRequest() {
        // Given
        when(insightService.getAllHistoryReports(eq(1L), eq(ReportType.DAILY)))
                .thenThrow(new RuntimeException("All history error"));

        // When
        ResponseEntity<?> response = controller.getAllHistoryReports("DAILY");

        // Then
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("error")).contains("获取所有历史报告失败"));
    }
}
