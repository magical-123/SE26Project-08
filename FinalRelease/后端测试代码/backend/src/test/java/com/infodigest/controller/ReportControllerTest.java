package com.infodigest.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.ReportType;
import com.infodigest.entity.User;
import com.infodigest.entity.UserReport;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.TopicClusterService;
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
class ReportControllerTest {

    @Mock
    private UserReportRepository userReportRepository;

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TopicClusterService topicClusterService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ReportController controller;

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

    @Test
    void getInsight_ReturnsReportForDate() {
        // Given
        UserReport report = new UserReport();
        report.setId(1L);
        report.setUserId(1L);
        report.setType(ReportType.WEEKLY);
        report.setReportDate(LocalDate.now().with(java.time.DayOfWeek.MONDAY));
        report.setInsightTitle("本周摄入分析");
        report.setInsightSummary("你本周关注了前端架构相关内容");
        report.setInsightFullText("完整洞察内容...");
        report.setVersion(1);

        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.WEEKLY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInsight("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasReport"));
        assertEquals("本周摄入分析", body.get("title"));
    }

    @Test
    void getInsight_ReturnsNoReportWhenNoneExists() {
        // Given
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.WEEKLY), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInsight("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("hasReport"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getSummary_ReturnsSummary() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setCategory("深度知识");
        item.setKnowledgeScore(85);
        item.setWatchDurationSeconds(3600);
        item.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getSummary();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("totalHours"));
        assertNotNull(body.get("topTopic"));
        assertNotNull(body.get("efficiency"));
        assertNotNull(body.get("itemCount"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTrend_ReturnsTrendList() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setWatchDurationSeconds(1800);
        item.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTrend();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(7, body.size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTopics_Daily_ReturnsClusters() throws Exception {
        // Given
        Map<String, Object> cluster = Map.of("topic", "AI", "count", 5);
        List<Map<String, Object>> clusters = List.of(cluster);
        when(topicClusterService.getTopicClusters(eq(1L), any(LocalDate.class)))
                .thenReturn(clusters);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTopics("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("AI", body.get(0).get("topic"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTopics_Weekly_ReturnsClusters() throws Exception {
        // Given
        Map<String, Object> cluster = Map.of("topic", "Architecture", "count", 3);
        List<Map<String, Object>> clusters = List.of(cluster);
        when(topicClusterService.getTopicClusters(eq(1L), any(LocalDate.class)))
                .thenReturn(clusters);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTopics("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(1, body.size());
        assertEquals("Architecture", body.get(0).get("topic"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateTopics_Daily_Succeeds() throws Exception {
        // Given
        Map<String, Object> cluster = Map.of("topic", "Java", "count", 10);
        List<Map<String, Object>> clusters = List.of(cluster);
        when(topicClusterService.generateDailyTopicClusters(eq(1L), any(LocalDate.class)))
                .thenReturn(clusters);

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateTopics("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertNotNull(body.get("data"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateTopics_Weekly_Succeeds() throws Exception {
        // Given
        Map<String, Object> cluster = Map.of("topic", "Spring", "count", 7);
        List<Map<String, Object>> clusters = List.of(cluster);
        when(topicClusterService.generateWeeklyTopicClusters(eq(1L), any(LocalDate.class)))
                .thenReturn(clusters);

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateTopics("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("success"));
        assertNotNull(body.get("data"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutrition_Daily_ReturnsNutrition() throws Exception {
        // Given
        UserReport report = new UserReport();
        report.setNutritionData("{\"protein\":30,\"carbs\":25,\"vitamins\":20,\"fats\":15,\"fiber\":10}");
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));
        Map<String, Integer> nutritionMap = Map.of(
                "protein", 30, "carbs", 25, "vitamins", 20, "fats", 15, "fiber", 10);
        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(nutritionMap);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getNutrition("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(5, body.size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutrition_Weekly_ReturnsNutrition() throws Exception {
        // Given
        UserReport report = new UserReport();
        report.setNutritionData("{\"protein\":30,\"carbs\":25,\"vitamins\":20,\"fats\":15,\"fiber\":10}");
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.WEEKLY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));
        Map<String, Integer> nutritionMap = Map.of(
                "protein", 30, "carbs", 25, "vitamins", 20, "fats", 15, "fiber", 10);
        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(nutritionMap);

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getNutrition("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(5, body.size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTopics_Daily_CacheMiss_ReturnsEmptyList() throws Exception {
        // Given
        when(topicClusterService.getTopicClusters(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Cache miss"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTopics("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTopics_Weekly_CacheMiss_ReturnsEmptyList() throws Exception {
        // Given
        when(topicClusterService.getTopicClusters(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Cache miss"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTopics("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertTrue(body.isEmpty());
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateTopics_Exception_ReturnsErrorResponse() throws Exception {
        // Given
        when(topicClusterService.generateDailyTopicClusters(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Generation failed"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateTopics("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("生成失败"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void generateTopics_Weekly_Exception_ReturnsErrorResponse() throws Exception {
        // Given
        when(topicClusterService.generateWeeklyTopicClusters(eq(1L), any(LocalDate.class)))
                .thenThrow(new RuntimeException("Weekly generation failed"));

        // When
        ResponseEntity<Map<String, Object>> response = controller.generateTopics("weekly");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertFalse((Boolean) body.get("success"));
        assertTrue(((String) body.get("message")).contains("生成失败"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getInsight_Daily_ReturnsReport() {
        // Given
        UserReport report = new UserReport();
        report.setId(1L);
        report.setUserId(1L);
        report.setType(ReportType.DAILY);
        report.setReportDate(LocalDate.now());
        report.setInsightTitle("今日摄入分析");
        report.setInsightSummary("你今天关注了前端相关内容");
        report.setInsightFullText("完整洞察内容...");
        report.setVersion(1);

        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));

        // When
        ResponseEntity<Map<String, Object>> response = controller.getInsight("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertTrue((Boolean) body.get("hasReport"));
        assertEquals("今日摄入分析", body.get("title"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutrition_NoReport_ReturnsDefaultValues() {
        // Given
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.empty());

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getNutrition("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(5, body.size());
        for (Map<String, Object> item : body) {
            assertEquals(0, item.get("value"));
        }
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutrition_NullNutritionData_ReturnsDefaultValues() throws Exception {
        // Given
        UserReport report = new UserReport();
        report.setNutritionData(null);
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getNutrition("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(5, body.size());
        for (Map<String, Object> item : body) {
            assertEquals(0, item.get("value"));
        }
    }

    @SuppressWarnings("unchecked")
    @Test
    void getNutrition_ParseNutritionException_ReturnsDefaultValues() throws Exception {
        // Given
        UserReport report = new UserReport();
        report.setNutritionData("invalid json");
        when(userReportRepository.findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(
                eq(1L), eq(ReportType.DAILY), any(LocalDate.class)))
                .thenReturn(Optional.of(report));
        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenThrow(new RuntimeException("JSON parse error"));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getNutrition("daily");

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(5, body.size());
        for (Map<String, Object> item : body) {
            assertEquals(0, item.get("value"));
        }
    }

    @SuppressWarnings("unchecked")
    @Test
    void getSummary_EmptyItems_ReturnsZeroValues() {
        // Given
        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        // When
        ResponseEntity<Map<String, Object>> response = controller.getSummary();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(0.0, body.get("totalHours"));
        assertEquals("暂无数据", body.get("topTopic"));
        assertEquals(0, body.get("efficiency"));
        assertEquals(0, body.get("itemCount"));
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTrend_WithDurationMinutes_CalculatesCorrectly() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setWatchDurationSeconds(0);
        item.setDurationMinutes(30);
        item.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTrend();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(7, body.size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void getTrend_WithZeroDuration_ReturnsZeroValues() {
        // Given
        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(1L);
        item.setWatchDurationSeconds(0);
        item.setDurationMinutes(0);
        item.setCrawledAt(LocalDateTime.now());

        when(informationItemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                anyLong(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // When
        ResponseEntity<List<Map<String, Object>>> response = controller.getTrend();

        // Then
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<Map<String, Object>> body = response.getBody();
        assertNotNull(body);
        assertEquals(7, body.size());
    }
}
