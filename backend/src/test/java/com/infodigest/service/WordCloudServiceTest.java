package com.infodigest.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserWordCloud;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserWordCloudRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * WordCloudService 单元测试
 * 使用 Mockito 模拟依赖项，测试业务逻辑
 */
@ExtendWith(MockitoExtension.class)
class WordCloudServiceTest {

    @Mock
    private InformationItemRepository itemRepository;

    @Mock
    private UserWordCloudRepository wordCloudRepository;

    @Mock
    private AIService aiService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private WordCloudService wordCloudService;

    private Long userId;
    private LocalDate reportDate;
    private List<InformationItem> mockItems;
    private UserWordCloud mockWordCloud;

    @BeforeEach
    void setUp() {
        userId = 1L;
        reportDate = LocalDate.of(2026, 7, 27);

        // 准备 Mock 数据
        mockItems = createMockInformationItems();
        mockWordCloud = createMockWordCloud();
    }

    // ==================== 测试：生成词云 - 成功场景 ====================

    @Test
    void testGenerateWordCloud_Success() throws Exception {
        // Given: 准备测试数据
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "机器学习", "videoIds": [1, 2]},
                    {"keyword": "深度学习", "videoIds": [2, 3]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw1 = new HashMap<>();
        kw1.put("keyword", "机器学习");
        kw1.put("videoIds", Arrays.asList(1, 2));
        Map<String, Object> kw2 = new HashMap<>();
        kw2.put("keyword", "深度学习");
        kw2.put("videoIds", Arrays.asList(2, 3));
        keywords.add(kw1);
        keywords.add(kw2);
        aiParsedData.put("keywords", keywords);

        // Mock 依赖行为
        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"机器学习\",\"value\":20}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When: 执行测试方法
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then: 验证结果
        assertNotNull(result);
        assertEquals(userId, result.getUserId());
        assertEquals(reportDate, result.getReportDate());

        // 验证 Mock 调用
        verify(itemRepository, times(1)).findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay);
        verify(aiService, times(1)).generateInsight(anyString(), eq(userId));
        verify(wordCloudRepository, times(1)).save(any(UserWordCloud.class));
    }

    // ==================== 测试：生成词云 - 无数据 ====================

    @Test
    void testGenerateWordCloud_NoData() {
        // Given: 没有已分析的视频
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(Collections.emptyList());

        when(itemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(Collections.emptyList());

        // When & Then: 应该抛出异常
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.generateWordCloud(userId, reportDate)
        );

        assertTrue(exception.getMessage().contains("没有已分析的视频数据"));
        verify(itemRepository, times(1)).findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay);
        verify(itemRepository, times(1)).findByUserIdAndProcessStatusAndCrawledAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay);
    }

    // ==================== 测试：生成词云 - AI 提取失败 ====================

    @Test
    void testGenerateWordCloud_AIExtractionFailed() throws Exception {
        // Given
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenThrow(new RuntimeException("AI服务异常"));

        // When & Then: 应该抛出异常
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.generateWordCloud(userId, reportDate)
        );

        verify(aiService, times(1)).generateInsight(anyString(), eq(userId));
    }

    // ==================== 测试：获取词云数据 - 成功 ====================

    @Test
    void testGetWordCloud_Success() throws Exception {
        // Given
        String keywordsJson = "[{\"word\":\"机器学习\",\"value\":20},{\"word\":\"深度学习\",\"value\":15}]";
        mockWordCloud.setKeywords(keywordsJson);

        List<Map<String, Object>> parsedKeywords = new ArrayList<>();
        Map<String, Object> kw1 = new HashMap<>();
        kw1.put("word", "机器学习");
        kw1.put("value", 20);
        parsedKeywords.add(kw1);

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.of(mockWordCloud));

        when(objectMapper.readValue(eq(keywordsJson), any(TypeReference.class)))
                .thenReturn(parsedKeywords);

        // When
        Map<String, Object> result = wordCloudService.getWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
        assertEquals(reportDate, result.get("reportDate"));
        assertNotNull(result.get("keywords"));

        verify(wordCloudRepository, times(1)).findByUserIdAndReportDate(userId, reportDate);
        verify(objectMapper, times(1)).readValue(eq(keywordsJson), any(TypeReference.class));
    }

    // ==================== 测试：获取词云数据 - 数据不存在 ====================

    @Test
    void testGetWordCloud_NotFound() {
        // Given: 数据库中没有该日期的词云
        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        // When & Then: 应该抛出异常
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.getWordCloud(userId, reportDate)
        );

        assertTrue(exception.getMessage().contains("未找到该日期的词云数据"));
        verify(wordCloudRepository, times(1)).findByUserIdAndReportDate(userId, reportDate);
    }

    // ==================== 测试：获取周词云数据 ====================

    @Test
    void testGetWeeklyWordClouds_Success() throws Exception {
        // Given
        LocalDate endDate = LocalDate.of(2026, 7, 27);
        LocalDate startDate = endDate.minusDays(6);

        List<UserWordCloud> weeklyData = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            UserWordCloud wc = new UserWordCloud();
            wc.setUserId(userId);
            wc.setReportDate(startDate.plusDays(i));
            wc.setKeywords("[{\"word\":\"关键词" + i + "\",\"value\":10}]");
            weeklyData.add(wc);
        }

        when(wordCloudRepository.findByUserIdAndReportDateBetweenOrderByReportDateDesc(
                userId, startDate, endDate))
                .thenReturn(weeklyData);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenAnswer(invocation -> {
                    List<Map<String, Object>> keywords = new ArrayList<>();
                    Map<String, Object> kw = new HashMap<>();
                    kw.put("word", "关键词");
                    kw.put("value", 10);
                    keywords.add(kw);
                    return keywords;
                });

        // When
        List<Map<String, Object>> result = wordCloudService.getWeeklyWordClouds(userId, endDate);

        // Then
        assertNotNull(result);
        assertEquals(7, result.size());

        verify(wordCloudRepository, times(1))
                .findByUserIdAndReportDateBetweenOrderByReportDateDesc(userId, startDate, endDate);
    }

    // ==================== 测试：获取周词云数据 - 空数据 ====================

    @Test
    void testGetWeeklyWordClouds_EmptyData() {
        // Given
        LocalDate endDate = LocalDate.of(2026, 7, 27);
        LocalDate startDate = endDate.minusDays(6);

        when(wordCloudRepository.findByUserIdAndReportDateBetweenOrderByReportDateDesc(
                userId, startDate, endDate))
                .thenReturn(Collections.emptyList());

        // When
        List<Map<String, Object>> result = wordCloudService.getWeeklyWordClouds(userId, endDate);

        // Then
        assertNotNull(result);
        assertTrue(result.isEmpty());

        verify(wordCloudRepository, times(1))
                .findByUserIdAndReportDateBetweenOrderByReportDateDesc(userId, startDate, endDate);
    }

    // ==================== 测试：边界情况 - 不同时间段的权重计算 ====================

    @Test
    void testGenerateWordCloud_WithDifferentTimeWeights() throws Exception {
        // Given: 准备不同时间段的视频数据
        List<InformationItem> items = new ArrayList<>();

        // 早上时段 (6-12)
        InformationItem morningItem = new InformationItem();
        morningItem.setId(1L);
        morningItem.setUserId(userId);
        morningItem.setTitle("早上观看的视频");
        morningItem.setAiSummary("早上内容");
        morningItem.setCompletionRate(0.8);
        morningItem.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 8, 30));
        morningItem.setProcessStatus("PROCESSED");
        items.add(morningItem);

        // 深夜时段 (0-6)
        InformationItem lateNightItem = new InformationItem();
        lateNightItem.setId(2L);
        lateNightItem.setUserId(userId);
        lateNightItem.setTitle("深夜观看的视频");
        lateNightItem.setAiSummary("深夜内容");
        lateNightItem.setCompletionRate(0.9);
        lateNightItem.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 2, 15));
        lateNightItem.setProcessStatus("PROCESSED");
        items.add(lateNightItem);

        // 晚上时段 (18-24)
        InformationItem eveningItem = new InformationItem();
        eveningItem.setId(3L);
        eveningItem.setUserId(userId);
        eveningItem.setTitle("晚上观看的视频");
        eveningItem.setAiSummary("晚上内容");
        eveningItem.setCompletionRate(0.95);
        eveningItem.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 20, 0));
        eveningItem.setProcessStatus("PROCESSED");
        items.add(eveningItem);

        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "测试关键词", "videoIds": [1, 2, 3]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "测试关键词");
        kw.put("videoIds", Arrays.asList(1, 2, 3));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(items);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"测试关键词\",\"value\":30}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
        verify(wordCloudRepository, times(1)).save(any(UserWordCloud.class));
    }

    // ==================== 测试：边界情况 - 无完播率数据 ====================

    @Test
    void testGenerateWordCloud_WithNoCompletionRate() throws Exception {
        // Given: 视频没有完播率数据
        List<InformationItem> items = new ArrayList<>();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(userId);
        item.setTitle("无完播率视频");
        item.setAiSummary("测试内容");
        item.setCompletionRate(null); // 无完播率
        item.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 14, 30));
        item.setProcessStatus("PROCESSED");
        items.add(item);

        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "关键词", "videoIds": [1]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "关键词");
        kw.put("videoIds", Arrays.asList(1));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(items);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"关键词\",\"value\":10}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
        verify(wordCloudRepository, times(1)).save(any(UserWordCloud.class));
    }

    // ==================== 测试：边界情况 - 关键词数据为空或null ====================

    @Test
    void testGenerateWordCloud_WithNullKeyword() throws Exception {
        // Given: AI返回的关键词包含null或空数据
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": null, "videoIds": [1]},
                    {"keyword": "有效关键词", "videoIds": []},
                    {"keyword": "正常关键词", "videoIds": [1, 2]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();

        Map<String, Object> kw1 = new HashMap<>();
        kw1.put("keyword", null);
        kw1.put("videoIds", Arrays.asList(1));
        keywords.add(kw1);

        Map<String, Object> kw2 = new HashMap<>();
        kw2.put("keyword", "有效关键词");
        kw2.put("videoIds", Collections.emptyList());
        keywords.add(kw2);

        Map<String, Object> kw3 = new HashMap<>();
        kw3.put("keyword", "正常关键词");
        kw3.put("videoIds", Arrays.asList(1, 2));
        keywords.add(kw3);

        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"正常关键词\",\"value\":20}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
        verify(wordCloudRepository, times(1)).save(any(UserWordCloud.class));
    }

    // ==================== 测试：使用 crawledAt 查询的回退逻辑 ====================

    @Test
    void testGenerateWordCloud_FallbackToCrawledAt() throws Exception {
        // Given: analyzedAt 无数据，回退到 crawledAt
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "关键词", "videoIds": [1]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "关键词");
        kw.put("videoIds", Arrays.asList(1));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        // analyzedAt 查询返回空
        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(Collections.emptyList());

        // crawledAt 查询返回数据
        when(itemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"关键词\",\"value\":10}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
        verify(itemRepository, times(1)).findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay);
        verify(itemRepository, times(1)).findByUserIdAndProcessStatusAndCrawledAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay);
    }

    // ==================== 测试：JSON 解析异常 - 清理 markdown 代码块 ====================

    @Test
    void testGenerateWordCloud_WithMarkdownCodeBlock() throws Exception {
        // Given: AI 返回包含 markdown 代码块的响应
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                ```json
                {
                  "keywords": [
                    {"keyword": "测试", "videoIds": [1]}
                  ]
                }
                ```
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "测试");
        kw.put("videoIds", Arrays.asList(1));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"测试\",\"value\":10}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
    }

    // ==================== 测试：JSON 解析异常 ====================

    @Test
    void testGenerateWordCloud_JSONParseException() throws Exception {
        // Given: ObjectMapper 抛出解析异常
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn("{invalid json}");

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenThrow(new RuntimeException("JSON解析失败"));

        // When & Then
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.generateWordCloud(userId, reportDate)
        );

        assertTrue(exception.getMessage().contains("解析关键词数据失败"));
    }

    // ==================== 测试：保存词云失败 ====================

    @Test
    void testGenerateWordCloud_SaveFailed() throws Exception {
        // Given
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "关键词", "videoIds": [1]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "关键词");
        kw.put("videoIds", Arrays.asList(1));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(mockItems);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenThrow(new RuntimeException("序列化失败"));

        // When & Then
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.generateWordCloud(userId, reportDate)
        );

        assertTrue(exception.getMessage().contains("保存词云数据失败"));
    }

    // ==================== 测试：获取词云 - JSON 解析失败 ====================

    @Test
    void testGetWordCloud_ParseException() throws Exception {
        // Given
        String invalidJson = "invalid json";
        mockWordCloud.setKeywords(invalidJson);

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.of(mockWordCloud));

        when(objectMapper.readValue(eq(invalidJson), any(TypeReference.class)))
                .thenThrow(new RuntimeException("解析失败"));

        // When & Then
        Exception exception = assertThrows(Exception.class, () ->
                wordCloudService.getWordCloud(userId, reportDate)
        );

        assertTrue(exception.getMessage().contains("解析词云数据失败"));
    }

    // ==================== 测试：周词云 - 包含解析失败的数据 ====================

    @Test
    void testGetWeeklyWordClouds_WithParseError() throws Exception {
        // Given
        LocalDate endDate = LocalDate.of(2026, 7, 27);
        LocalDate startDate = endDate.minusDays(6);

        List<UserWordCloud> weeklyData = new ArrayList<>();

        // 第一条数据正常
        UserWordCloud wc1 = new UserWordCloud();
        wc1.setUserId(userId);
        wc1.setReportDate(startDate);
        wc1.setKeywords("[{\"word\":\"关键词1\",\"value\":10}]");
        weeklyData.add(wc1);

        // 第二条数据解析失败
        UserWordCloud wc2 = new UserWordCloud();
        wc2.setUserId(userId);
        wc2.setReportDate(startDate.plusDays(1));
        wc2.setKeywords("invalid json");
        weeklyData.add(wc2);

        when(wordCloudRepository.findByUserIdAndReportDateBetweenOrderByReportDateDesc(
                userId, startDate, endDate))
                .thenReturn(weeklyData);

        // 第一次调用成功，第二次失败
        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenAnswer(invocation -> {
                    String json = invocation.getArgument(0);
                    if (json.contains("invalid")) {
                        throw new RuntimeException("解析失败");
                    }
                    List<Map<String, Object>> keywords = new ArrayList<>();
                    Map<String, Object> kw = new HashMap<>();
                    kw.put("word", "关键词1");
                    kw.put("value", 10);
                    keywords.add(kw);
                    return keywords;
                });

        // When
        List<Map<String, Object>> result = wordCloudService.getWeeklyWordClouds(userId, endDate);

        // Then: 只返回成功解析的数据
        assertNotNull(result);
        assertEquals(1, result.size()); // 只有1条成功
    }

    // ==================== 测试：视频没有 analyzedAt 时间 ====================

    @Test
    void testGenerateWordCloud_WithNullAnalyzedAt() throws Exception {
        // Given: 视频的 analyzedAt 为 null
        List<InformationItem> items = new ArrayList<>();

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(userId);
        item.setTitle("测试视频");
        item.setAiSummary("测试内容");
        item.setCompletionRate(0.8);
        item.setAnalyzedAt(null); // 无分析时间
        item.setProcessStatus("PROCESSED");
        items.add(item);

        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        String aiResponse = """
                {
                  "keywords": [
                    {"keyword": "关键词", "videoIds": [1]}
                  ]
                }
                """;

        Map<String, Object> aiParsedData = new HashMap<>();
        List<Map<String, Object>> keywords = new ArrayList<>();
        Map<String, Object> kw = new HashMap<>();
        kw.put("keyword", "关键词");
        kw.put("videoIds", Arrays.asList(1));
        keywords.add(kw);
        aiParsedData.put("keywords", keywords);

        when(itemRepository.findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                userId, "PROCESSED", startOfDay, endOfDay))
                .thenReturn(items);

        when(aiService.generateInsight(anyString(), eq(userId)))
                .thenReturn(aiResponse);

        when(objectMapper.readValue(anyString(), any(TypeReference.class)))
                .thenReturn(aiParsedData);

        when(objectMapper.writeValueAsString(anyList()))
                .thenReturn("[{\"word\":\"关键词\",\"value\":10}]");

        when(wordCloudRepository.findByUserIdAndReportDate(userId, reportDate))
                .thenReturn(Optional.empty());

        when(wordCloudRepository.save(any(UserWordCloud.class)))
                .thenReturn(mockWordCloud);

        // When
        UserWordCloud result = wordCloudService.generateWordCloud(userId, reportDate);

        // Then
        assertNotNull(result);
    }

    // ==================== 辅助方法：创建 Mock 数据 ====================

    private List<InformationItem> createMockInformationItems() {
        List<InformationItem> items = new ArrayList<>();

        InformationItem item1 = new InformationItem();
        item1.setId(1L);
        item1.setUserId(userId);
        item1.setTitle("机器学习入门教程");
        item1.setAiSummary("这是一个关于机器学习基础的教程");
        item1.setCompletionRate(0.8);
        item1.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 14, 30));
        item1.setProcessStatus("PROCESSED");
        items.add(item1);

        InformationItem item2 = new InformationItem();
        item2.setId(2L);
        item2.setUserId(userId);
        item2.setTitle("深度学习实战");
        item2.setAiSummary("深度学习的实际应用案例");
        item2.setCompletionRate(0.9);
        item2.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 15, 45));
        item2.setProcessStatus("PROCESSED");
        items.add(item2);

        InformationItem item3 = new InformationItem();
        item3.setId(3L);
        item3.setUserId(userId);
        item3.setTitle("神经网络原理");
        item3.setAiSummary("神经网络的基本原理讲解");
        item3.setCompletionRate(0.7);
        item3.setAnalyzedAt(LocalDateTime.of(2026, 7, 27, 20, 15));
        item3.setProcessStatus("PROCESSED");
        items.add(item3);

        return items;
    }

    private UserWordCloud createMockWordCloud() {
        UserWordCloud wordCloud = new UserWordCloud();
        wordCloud.setId(1L);
        wordCloud.setUserId(userId);
        wordCloud.setReportDate(reportDate);
        wordCloud.setKeywords("[{\"word\":\"机器学习\",\"value\":20}]");
        wordCloud.setUpdatedAt(LocalDateTime.now());
        return wordCloud;
    }
}
