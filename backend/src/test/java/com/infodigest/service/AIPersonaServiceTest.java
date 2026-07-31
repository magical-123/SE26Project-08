package com.infodigest.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserTopicCluster;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserTopicClusterRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AIPersonaServiceTest {

    @Mock
    private InformationItemRepository informationItemRepository;

    @Mock
    private UserTopicClusterRepository topicClusterRepository;

    @Mock
    private AIService aiService;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private RedissonClient redissonClient;

    @Mock
    private RBucket<String> bucket;

    @InjectMocks
    private AIPersonaService service;

    private static final Long USER_ID = 1L;
    private static final String CACHE_KEY = "persona:1";

    private Map<String, Object> persona() {
        Map<String, Object> persona = new HashMap<>();
        persona.put("personaTitle", "系统边界的探索者");
        persona.put("coreTraits", List.of("#硬核求知"));
        return persona;
    }

    private List<InformationItem> premiumItems(int count) {
        List<InformationItem> items = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            InformationItem item = new InformationItem();
            item.setId((long) i);
            item.setUserId(USER_ID);
            item.setTitle("标题" + i);
            item.setContentRaw("文稿内容" + i);
            items.add(item);
        }
        return items;
    }

    // ==================== 缓存命中 ====================

    @Test
    void generatePersona_ReturnsCachedPersona() throws Exception {
        // Given
        Map<String, Object> cached = persona();
        String cachedJson = "cached-json";
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(bucket.isExists()).thenReturn(true);
        when(bucket.get()).thenReturn(cachedJson);
        when(objectMapper.readValue(eq(cachedJson), any(TypeReference.class))).thenReturn(cached);

        // When
        Map<String, Object> result = service.generatePersona(USER_ID, false);

        // Then
        assertEquals(cached, result);
        verify(bucket, never()).set(anyString(), anyLong(), any(TimeUnit.class));
        verifyNoInteractions(informationItemRepository, topicClusterRepository, aiService);
    }

    @Test
    void generatePersona_CacheParseFailure_Regenerates() throws Exception {
        // Given
        String badJson = "bad-json";
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(bucket.isExists()).thenReturn(true);
        when(bucket.get()).thenReturn(badJson);
        when(objectMapper.readValue(eq(badJson), any(TypeReference.class)))
                .thenThrow(new JsonProcessingException("parse error") {});

        // 落入重新生成流程
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "{\"personaTitle\":\"t\"}";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("persona-json");

        // When
        Map<String, Object> result = service.generatePersona(USER_ID, false);

        // Then
        assertEquals(persona, result);
        verify(bucket).set("persona-json", 24, TimeUnit.HOURS);
    }

    // ==================== 无数据 ====================

    @Test
    void generatePersona_NoPremiumItems_Throws() {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(List.of());

        // When & Then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.generatePersona(USER_ID, true));
        assertTrue(exception.getMessage().contains("无足够的优质信息源"));
    }

    // ==================== 全局底色标签 ====================

    @Test
    void generatePersona_NoClusters_TagsDefaultsToNoTags() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then: prompt 中包含默认标签
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("暂无标签")), eq(USER_ID));
    }

    @Test
    void generatePersona_WithClusters_BuildsTagsFromClusters() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);

        UserTopicCluster cluster = new UserTopicCluster();
        cluster.setClusters("[{\"name\":\"机器学习\",\"count\":5}]");
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of(cluster));

        List<Map<String, Object>> clusterList = new ArrayList<>();
        Map<String, Object> clusterData = new HashMap<>();
        clusterData.put("name", "机器学习");
        clusterData.put("count", 5);
        clusterList.add(clusterData);
        when(objectMapper.readValue(contains("机器学习"), any(TypeReference.class))).thenReturn(clusterList);

        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("机器学习(5)")), eq(USER_ID));
    }

    @Test
    void generatePersona_ClustersJsonBlank_SkipsTags() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);

        UserTopicCluster cluster = new UserTopicCluster();
        cluster.setClusters("   ");
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of(cluster));

        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then: 保持默认标签
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("暂无标签")), eq(USER_ID));
    }

    @Test
    void generatePersona_ClustersParseFailure_FallsBackToDefaultTags() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);

        UserTopicCluster cluster = new UserTopicCluster();
        cluster.setClusters("invalid-json");
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of(cluster));
        when(objectMapper.readValue(contains("invalid-json"), any(TypeReference.class)))
                .thenThrow(new JsonProcessingException("bad") {});

        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("暂无标签")), eq(USER_ID));
    }

    // ==================== AI 响应处理 ====================

    @Test
    void generatePersona_AiReturnsMarkdownJson_StripsWrapper() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String markdownJson = "```json\n{\"personaTitle\":\"t\"}\n```";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(markdownJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(contains("personaTitle"), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        Map<String, Object> result = service.generatePersona(USER_ID, true);

        // Then
        assertEquals(persona, result);
        verify(bucket).set("json", 24, TimeUnit.HOURS);
    }

    @Test
    void generatePersona_AiResponseParseFailure_ThrowsFormatException() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        String aiJson = "not-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        when(objectMapper.readValue(contains("not-json"), any(TypeReference.class)))
                .thenThrow(new JsonProcessingException("bad") {});

        // When & Then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.generatePersona(USER_ID, true));
        assertTrue(exception.getMessage().contains("AI 返回格式异常"));
    }

    @Test
    void generatePersona_AiServiceThrows_WrapsException() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());
        List<InformationItem> items = premiumItems(1);
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(items);
        when(aiService.generateInsight(anyString(), eq(USER_ID)))
                .thenThrow(new RuntimeException("AI 服务超时"));

        // When & Then
        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> service.generatePersona(USER_ID, true));
        assertTrue(exception.getMessage().contains("AI 服务超时"));
    }

    // ==================== 内容构建细节 ====================

    @Test
    void generatePersona_WithUserNote_IncludesNoteInPrompt() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(USER_ID);
        item.setTitle("有笔记的内容");
        item.setContentRaw("正文");
        item.setUserNote("我的思考笔记");
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(List.of(item));

        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("【用户个人笔记】: 我的思考笔记")), eq(USER_ID));
    }

    @Test
    void generatePersona_ContentTruncated_WhenOver20000Chars() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(USER_ID);
        item.setTitle("超长内容");
        item.setContentRaw("A".repeat(30000));
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(List.of(item));

        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then: prompt 中应包含截断标记，且不含完整超长内容
        verify(aiService).generateInsight(
                argThat(prompt -> prompt.contains("...(截断)") && !prompt.contains("A".repeat(30000))),
                eq(USER_ID));
    }

    @Test
    void generatePersona_NoContentRaw_FallsBackToAiSummary() throws Exception {
        // Given
        when(redissonClient.<String>getBucket(CACHE_KEY)).thenReturn(bucket);
        when(topicClusterRepository.findByUserIdOrderByReportDateDesc(USER_ID)).thenReturn(List.of());

        InformationItem item = new InformationItem();
        item.setId(1L);
        item.setUserId(USER_ID);
        item.setTitle("只有摘要的内容");
        item.setContentRaw(null);
        item.setAiSummary("AI 摘要内容");
        when(informationItemRepository.findTop10ByUserIdAndIsPremiumTrueOrderByCrawledAtDesc(USER_ID))
                .thenReturn(List.of(item));

        String aiJson = "ai-json";
        when(aiService.generateInsight(anyString(), eq(USER_ID))).thenReturn(aiJson);
        Map<String, Object> persona = persona();
        when(objectMapper.readValue(eq(aiJson), any(TypeReference.class))).thenReturn(persona);
        when(objectMapper.writeValueAsString(persona)).thenReturn("json");

        // When
        service.generatePersona(USER_ID, true);

        // Then
        verify(aiService).generateInsight(argThat(prompt -> prompt.contains("AI 摘要内容")), eq(USER_ID));
    }
}
