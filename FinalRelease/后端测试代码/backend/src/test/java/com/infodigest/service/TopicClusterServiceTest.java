package com.infodigest.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserTopicCluster;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserTopicClusterRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TopicClusterServiceTest {

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private UserTopicClusterRepository topicClusterRepository;

    @Mock
    private AIService aiService;

    @InjectMocks
    private TopicClusterService topicClusterService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Inject ObjectMapper since it's autowired
        ReflectionTestUtils.setField(topicClusterService, "objectMapper", objectMapper);
    }

    @Test
    void getTopicClusters_returnsClustersForUser() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        String clustersJson = objectMapper.writeValueAsString(List.of(
                Map.of("name", "AI", "count", 3, "tags", List.of("人工智能", "大模型"), "videoIds", List.of(1, 2, 3)),
                Map.of("name", "后端", "count", 2, "tags", List.of("Java", "微服务"), "videoIds", List.of(4, 5))
        ));

        UserTopicCluster topicCluster = new UserTopicCluster();
        topicCluster.setUserId(userId);
        topicCluster.setReportDate(date);
        topicCluster.setClusters(clustersJson);

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.of(topicCluster));

        // When
        List<Map<String, Object>> result = topicClusterService.getTopicClusters(userId, date);

        // Then
        assertThat(result).hasSize(2);
        assertThat(result.get(0).get("name")).isEqualTo("AI");
        assertThat(result.get(1).get("name")).isEqualTo("后端");
    }

    @Test
    void getTopicClusters_throwsException_whenNotFound() {
        // Given
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> topicClusterService.getTopicClusters(userId, date))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("未找到该日期的话题聚类数据");
    }

    @Test
    void generateDailyTopicClusters_createsClustersSuccessfully() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setTitle("AI入门教程");
        item1.setPlatform("BILIBILI");
        item1.setAiSummary("人工智能基础概念介绍");
        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setTitle("Spring Boot实战");
        item2.setPlatform("ZHIHU");
        item2.setAiSummary("微服务架构实践指南");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item1, item2));

        String aiResponse = "{\"clusters\":[{\"name\":\"AI\",\"count\":1,\"tags\":[\"人工智能\"],\"videoIds\":[1]},{\"name\":\"后端\",\"count\":1,\"tags\":[\"微服务\"],\"videoIds\":[2]}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.empty());
        when(topicClusterRepository.save(any(UserTopicCluster.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then
        assertThat(result).hasSize(2);
        assertThat(result.get(0).get("name")).isEqualTo("AI");
        assertThat(result.get(1).get("name")).isEqualTo("后端");
        verify(topicClusterRepository).save(any(UserTopicCluster.class));
    }

    @Test
    void generateDailyTopicClusters_handlesEmptyData() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then
        assertThat(result).isEmpty();
        verify(aiService, never()).generateInsight(anyString(), anyLong());
        verify(topicClusterRepository, never()).save(any());
    }

    @Test
    void generateWeeklyTopicClusters_createsWeeklyClusters() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate endDate = LocalDate.now();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("Kubernetes入门");
        item.setPlatform("BILIBILI");
        item.setAiSummary("容器编排工具Kubernetes基础");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"clusters\":[{\"name\":\"云原生\",\"count\":1,\"tags\":[\"K8s\"],\"videoIds\":[1]}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        LocalDate monday = endDate.with(java.time.DayOfWeek.MONDAY);
        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, monday))
                .thenReturn(Optional.empty());
        when(topicClusterRepository.save(any(UserTopicCluster.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        List<Map<String, Object>> result = topicClusterService.generateWeeklyTopicClusters(userId, endDate);

        // Then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("name")).isEqualTo("云原生");
        verify(topicClusterRepository).save(any(UserTopicCluster.class));
    }

    @Test
    void generateWeeklyTopicClusters_handlesEmptyData() throws Exception {
        // Given
        Long userId = 1L;
        LocalDate endDate = LocalDate.now();

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        // When
        List<Map<String, Object>> result = topicClusterService.generateWeeklyTopicClusters(userId, endDate);

        // Then
        assertThat(result).isEmpty();
        verify(aiService, never()).generateInsight(anyString(), anyLong());
        verify(topicClusterRepository, never()).save(any());
    }

    // ========== Additional edge-case tests ==========

    @Test
    void getTopicClusters_handlesJsonParseException() {
        // Given — stored clusters JSON is invalid
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        UserTopicCluster topicCluster = new UserTopicCluster();
        topicCluster.setUserId(userId);
        topicCluster.setReportDate(date);
        topicCluster.setClusters("这不是有效的JSON");

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.of(topicCluster));

        // When & Then
        assertThatThrownBy(() -> topicClusterService.getTopicClusters(userId, date))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("解析话题聚类数据失败");
    }

    @Test
    void generateDailyTopicClusters_deletesExistingWhenEmptyData() throws Exception {
        // Given — items empty, but existing cluster present
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        UserTopicCluster existingCluster = new UserTopicCluster();
        existingCluster.setUserId(userId);
        existingCluster.setReportDate(date);
        existingCluster.setClusters("[]");
        lenient().when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.of(existingCluster));

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then — existing cluster is deleted
        assertThat(result).isEmpty();
        verify(topicClusterRepository).delete(existingCluster);
        verify(aiService, never()).generateInsight(anyString(), anyLong());
        verify(topicClusterRepository, never()).save(any());
    }

    @Test
    void generateDailyTopicClusters_handlesNullClusters() throws Exception {
        // Given — AI returns clusters=null
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("测试");
        item.setPlatform("BILIBILI");
        item.setAiSummary("摘要");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        // AI returns with null clusters
        String aiResponse = "{\"clusters\": null}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then
        assertThat(result).isEmpty();
        // saveTopicClusters should NOT be called since clusters is null/empty
        verify(topicClusterRepository, never()).save(any());
    }

    @Test
    void generateDailyTopicClusters_handlesEmptyClusters() throws Exception {
        // Given — AI returns empty clusters array
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("测试");
        item.setPlatform("BILIBILI");
        item.setAiSummary("摘要");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"clusters\": []}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then
        assertThat(result).isEmpty();
        verify(topicClusterRepository, never()).save(any());
    }

    @Test
    void generateDailyTopicClusters_handlesMarkdownResponse() throws Exception {
        // Given — AI wraps response in ```json code block
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("AI入门教程");
        item.setPlatform("BILIBILI");
        item.setAiSummary("人工智能基础概念介绍");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "```json\n{\"clusters\":[{\"name\":\"AI\",\"count\":1,\"tags\":[\"人工智能\"],\"videoIds\":[1]}]}\n```";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.empty());
        when(topicClusterRepository.save(any(UserTopicCluster.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        List<Map<String, Object>> result = topicClusterService.generateDailyTopicClusters(userId, date);

        // Then — markdown is stripped, clusters are parsed
        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("name")).isEqualTo("AI");
        verify(topicClusterRepository).save(any(UserTopicCluster.class));
    }

    @Test
    void generateDailyTopicClusters_handlesSaveException() throws Exception {
        // Given — repository save throws
        Long userId = 1L;
        LocalDate date = LocalDate.now();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("测试");
        item.setPlatform("BILIBILI");
        item.setAiSummary("摘要");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"clusters\":[{\"name\":\"AI\",\"count\":1,\"tags\":[\"人工智能\"],\"videoIds\":[1]}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        lenient().when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, date))
                .thenReturn(Optional.empty());
        when(topicClusterRepository.save(any(UserTopicCluster.class)))
                .thenThrow(new RuntimeException("DB error"));

        // When & Then
        assertThatThrownBy(() -> topicClusterService.generateDailyTopicClusters(userId, date))
                .isInstanceOf(Exception.class)
                .hasMessageContaining("保存话题聚类数据失败");
    }

    @Test
    void generateWeeklyTopicClusters_withMidWeekEndDate() throws Exception {
        // Given — end date is Wednesday (mid-week)
        Long userId = 1L;
        // Use a Wednesday
        LocalDate wednesday = LocalDate.of(2026, 7, 29);
        LocalDate monday = wednesday.with(java.time.DayOfWeek.MONDAY);

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setTitle("周中测试");
        item.setPlatform("BILIBILI");
        item.setAiSummary("周中内容");

        when(informationItemRepository.findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(
                eq(userId), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(item));

        String aiResponse = "{\"clusters\":[{\"name\":\"周中话题\",\"count\":1,\"tags\":[\"测试\"],\"videoIds\":[1]}]}";
        when(aiService.generateInsight(anyString(), eq(userId))).thenReturn(aiResponse);

        when(topicClusterRepository.findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, monday))
                .thenReturn(Optional.empty());
        when(topicClusterRepository.save(any(UserTopicCluster.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // When
        List<Map<String, Object>> result = topicClusterService.generateWeeklyTopicClusters(userId, wednesday);

        // Then — should use Monday as report date key
        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("name")).isEqualTo("周中话题");
        verify(topicClusterRepository).save(any(UserTopicCluster.class));
    }
}
