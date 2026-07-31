package com.infodigest.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserTopicCluster;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserTopicClusterRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 话题聚类服务
 * 基于视频标题和摘要，使用AI进行话题聚类分析
 */
@Service
@Slf4j
public class TopicClusterService {

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserTopicClusterRepository topicClusterRepository;

    @Autowired
    private AIService aiService;

    @Autowired
    private ObjectMapper objectMapper;

    private static final String TOPIC_CLUSTER_PROMPT = """
            你是一个信息分析专家。请分析用户观看的视频内容，进行话题聚类。

            视频列表：
            %s

            请将这些视频按照主题进行聚类，输出格式为JSON：
            {
              "clusters": [
                {
                  "name": "话题名称",
                  "count": 视频数量,
                  "tags": ["标签1", "标签2", "标签3"],
                  "videoIds": [视频ID列表]
                }
              ]
            }

            要求：
            1. 聚类数量控制在3-8个之间
            2. 每个聚类的标签不超过3个
            3. 话题名称要简洁有力（2-6个字）
            4. 按视频数量从多到少排序
            5. 标签要体现该话题的核心特征

            只返回JSON，不要有其他内容。
            """;

    /**
     * 获取指定日期的话题聚类数据（优先从数据库读取）
     */
    public List<Map<String, Object>> getTopicClusters(Long userId, LocalDate reportDate) throws Exception {
        Optional<UserTopicCluster> topicClusterOpt = topicClusterRepository
                .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, reportDate);

        if (topicClusterOpt.isPresent()) {
            UserTopicCluster topicCluster = topicClusterOpt.get();
            try {
                List<Map<String, Object>> clusters = objectMapper.readValue(
                        topicCluster.getClusters(),
                        new TypeReference<List<Map<String, Object>>>() {});
                log.info("从数据库读取用户 {} 日期 {} 的话题聚类", userId, reportDate);
                return clusters;
            } catch (Exception e) {
                log.error("解析话题聚类数据失败", e);
                throw new Exception("解析话题聚类数据失败: " + e.getMessage());
            }
        }

        throw new Exception("未找到该日期的话题聚类数据");
    }

    /**
     * 生成日报话题聚类
     */
    public List<Map<String, Object>> generateDailyTopicClusters(Long userId, LocalDate reportDate) throws Exception {
        log.info("开始生成用户 {} 的日报话题聚类 ({})", userId, reportDate);

        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        List<InformationItem> items = informationItemRepository
                .findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(userId, startOfDay, endOfDay);

        if (items.isEmpty()) {
            log.warn("用户 {} 在 {} 没有已分析的视频", userId, reportDate);

            // 如果本日没有已分析内容，删除已存在的日报话题聚类数据
            try {
                Optional<UserTopicCluster> existingCluster = topicClusterRepository
                        .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, reportDate);
                if (existingCluster.isPresent()) {
                    topicClusterRepository.delete(existingCluster.get());
                    log.info("已删除用户 {} 在 {} 的旧话题聚类数据（因无已分析内容）", userId, reportDate);
                }
            } catch (Exception e) {
                log.error("删除旧话题聚类数据失败", e);
            }

            return Collections.emptyList();
        }

        List<Map<String, Object>> clusters = clusterTopics(items, userId);

        // 仅当聚类结果非空时才保存到数据库
        if (clusters != null && !clusters.isEmpty()) {
            saveTopicClusters(userId, reportDate, clusters);
        }

        return clusters;
    }

    /**
     * 生成周报话题聚类（强制重新生成，覆盖已有缓存）
     */
    public List<Map<String, Object>> generateWeeklyTopicClusters(Long userId, LocalDate endDate) throws Exception {
        log.info("开始生成用户 {} 的周报话题聚类 (截止{})", userId, endDate);

        // 使用严格的自然周（周一到周日）
        LocalDate monday = endDate.with(DayOfWeek.MONDAY);
        LocalDate sunday = endDate.with(DayOfWeek.SUNDAY);

        LocalDateTime startTime = monday.atStartOfDay();
        LocalDateTime endTime = sunday.atTime(23, 59, 59);

        List<InformationItem> items = informationItemRepository
                .findByUserIdAndAnalyzedAtBetweenOrderByAnalyzedAtDesc(userId, startTime, endTime);

        if (items.isEmpty()) {
            log.warn("用户 {} 在 {} 到 {} 没有已分析的视频", userId, monday, sunday);

            // 如果本周没有已分析内容，删除已存在的周报话题聚类数据
            try {
                Optional<UserTopicCluster> existingCluster = topicClusterRepository
                        .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, monday);
                if (existingCluster.isPresent()) {
                    topicClusterRepository.delete(existingCluster.get());
                    log.info("已删除用户 {} 本周 {} 的旧话题聚类数据（因无已分析内容）", userId, monday);
                }
            } catch (Exception e) {
                log.error("删除旧话题聚类数据失败", e);
            }

            return Collections.emptyList();
        }

        List<Map<String, Object>> clusters = clusterTopics(items, userId);

        // 仅当聚类结果非空时才保存周报缓存（使用周一作为key，覆盖已有数据）
        if (clusters != null && !clusters.isEmpty()) {
            saveTopicClusters(userId, monday, clusters);
        }

        log.info("周报话题聚类生成完成，共 {} 个话题", clusters.size());
        return clusters;
    }

    /**
     * 保存话题聚类到数据库
     */
    private void saveTopicClusters(Long userId, LocalDate reportDate, List<Map<String, Object>> clusters) throws Exception {
        try {
            String clustersJson = objectMapper.writeValueAsString(clusters);

            UserTopicCluster topicCluster = topicClusterRepository
                    .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, reportDate)
                    .orElse(new UserTopicCluster());

            topicCluster.setUserId(userId);
            topicCluster.setReportDate(reportDate);
            topicCluster.setClusters(clustersJson);

            topicClusterRepository.save(topicCluster);
            log.info("话题聚类数据已保存到数据库");
        } catch (Exception e) {
            log.error("保存话题聚类数据失败", e);
            throw new Exception("保存话题聚类数据失败: " + e.getMessage());
        }
    }

    /**
     * 调用AI进行话题聚类
     */
    private List<Map<String, Object>> clusterTopics(List<InformationItem> items, Long userId) throws Exception {
        // 构建视频列表文本
        StringBuilder videoListBuilder = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            InformationItem item = items.get(i);
            videoListBuilder.append(String.format(
                    "视频%d (ID: %d):\n标题: %s\n摘要: %s\n平台: %s\n\n",
                    i + 1,
                    item.getId(),
                    item.getTitle(),
                    item.getAiSummary() != null ? item.getAiSummary() : "无摘要",
                    item.getPlatform()
            ));
        }

        String prompt = String.format(TOPIC_CLUSTER_PROMPT, videoListBuilder.toString());

        // 调用AI
        String aiResponse = aiService.generateInsight(prompt, userId);

        // 解析JSON响应
        try {
            // 清理可能的markdown代码块标记
            String cleanedResponse = aiResponse.trim();
            if (cleanedResponse.startsWith("```json")) {
                cleanedResponse = cleanedResponse.substring(7);
            }
            if (cleanedResponse.startsWith("```")) {
                cleanedResponse = cleanedResponse.substring(3);
            }
            if (cleanedResponse.endsWith("```")) {
                cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length() - 3);
            }
            cleanedResponse = cleanedResponse.trim();

            Map<String, Object> result = objectMapper.readValue(cleanedResponse, new TypeReference<Map<String, Object>>() {});
            List<Map<String, Object>> clusters = (List<Map<String, Object>>) result.get("clusters");

            if (clusters == null || clusters.isEmpty()) {
                log.warn("AI未返回话题聚类数据");
                return Collections.emptyList();
            }

            log.info("成功生成 {} 个话题聚类", clusters.size());
            return clusters;

        } catch (Exception e) {
            log.error("解析AI返回的话题聚类JSON失败: {}", aiResponse, e);
            throw new Exception("解析AI响应失败: " + e.getMessage());
        }
    }
}
