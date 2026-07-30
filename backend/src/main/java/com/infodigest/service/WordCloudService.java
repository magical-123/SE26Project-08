package com.infodigest.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserWordCloud;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserWordCloudRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WordCloudService {

    private final InformationItemRepository itemRepository;
    private final UserWordCloudRepository wordCloudRepository;
    private final AIService aiService;
    private final ObjectMapper objectMapper;

    private static final String KEYWORD_EXTRACTION_PROMPT = """
            请从以下视频列表中提取最重要的主题关键词。每个视频提取3-5个关键词。

            视频列表：
            %s

            要求：
            1. 提取名词、领域、概念形式的关键词（避免动词和形容词）
            2. 自动合并同义词和相关概念（如"人工智能"和"AI"、"编程"和"代码"）
            3. 过滤无意义的词（如"视频"、"内容"、"分享"、"推荐"等）
            4. 关键词应该是实质性主题（如"机器学习"、"健康饮食"、"投资理财"）

            返回JSON格式（严格遵守格式，不要添加任何其他文字）：
            {
              "keywords": [
                {
                  "keyword": "关键词",
                  "videoIds": [视频ID列表]
                }
              ]
            }
            """;

    /**
     * 生成指定日期的词云数据
     */
    @Transactional
    public UserWordCloud generateWordCloud(Long userId, LocalDate reportDate) throws Exception {
        log.info("开始生成词云数据 - userId: {}, date: {}", userId, reportDate);

        // 1. 获取当天所有已分析的视频
        LocalDateTime startOfDay = reportDate.atStartOfDay();
        LocalDateTime endOfDay = reportDate.plusDays(1).atStartOfDay();

        // 先尝试使用analyzedAt查询
        List<InformationItem> items = itemRepository
                .findByUserIdAndProcessStatusAndAnalyzedAtBetween(
                        userId, "PROCESSED", startOfDay, endOfDay);

        // 如果没有数据，尝试使用crawledAt查询
        if (items.isEmpty()) {
            log.info("analyzedAt字段无数据，尝试使用crawledAt查询");
            items = itemRepository.findByUserIdAndProcessStatusAndCrawledAtBetween(
                    userId, "PROCESSED", startOfDay, endOfDay);
        }

        if (items.isEmpty()) {
            log.warn("没有找到已分析的视频数据 - userId: {}, date: {}", userId, reportDate);
            throw new Exception("当天没有已分析的视频数据");
        }

        log.info("找到 {} 个已分析视频", items.size());

        // 2. 调用AI提取关键词
        Map<String, Object> extractedData = extractKeywordsWithAI(items);
        List<Map<String, Object>> keywordList = (List<Map<String, Object>>) extractedData.get("keywords");

        if (keywordList == null || keywordList.isEmpty()) {
            log.warn("AI未提取到任何关键词");
            throw new Exception("未能提取到关键词");
        }

        // 3. 计算权重
        List<Map<String, Object>> weightedKeywords = calculateWeights(keywordList, items);

        // 4. 保存到数据库
        UserWordCloud wordCloud = saveWordCloud(userId, reportDate, weightedKeywords);

        log.info("词云数据生成成功 - {} 个关键词", weightedKeywords.size());
        return wordCloud;
    }

    /**
     * 调用AI提取关键词
     */
    private Map<String, Object> extractKeywordsWithAI(List<InformationItem> items) throws Exception {
        // 构建视频列表文本
        StringBuilder videoListBuilder = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            InformationItem item = items.get(i);
            videoListBuilder.append(String.format(
                    "视频%d (ID: %d):\n标题: %s\n摘要: %s\n\n",
                    i + 1,
                    item.getId(),
                    item.getTitle(),
                    item.getAiSummary() != null ? item.getAiSummary() : "无摘要"
            ));
        }

        String prompt = String.format(KEYWORD_EXTRACTION_PROMPT, videoListBuilder.toString());

        // 调用AI
        Long userId = items.get(0).getUserId();
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

            return objectMapper.readValue(cleanedResponse, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("解析AI响应失败: {}", aiResponse, e);
            throw new Exception("解析关键词数据失败: " + e.getMessage());
        }
    }

    /**
     * 计算关键词权重
     * 权重 = 基础权重 × 完播率加成 × 时间权重
     */
    private List<Map<String, Object>> calculateWeights(
            List<Map<String, Object>> keywordList,
            List<InformationItem> allItems) {

        // 构建视频ID到视频对象的映射
        Map<Long, InformationItem> itemMap = allItems.stream()
                .collect(Collectors.toMap(InformationItem::getId, item -> item));

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> keywordData : keywordList) {
            String keyword = (String) keywordData.get("keyword");
            List<Integer> videoIds = (List<Integer>) keywordData.get("videoIds");

            if (keyword == null || videoIds == null || videoIds.isEmpty()) {
                continue;
            }

            // 1. 基础权重 = 关联视频数量
            double baseWeight = videoIds.size();

            // 2. 计算平均完播率
            double totalCompletionRate = 0;
            int validCompletionCount = 0;
            List<Long> relatedVideoIds = new ArrayList<>();

            for (Integer videoId : videoIds) {
                Long id = videoId.longValue();
                InformationItem item = itemMap.get(id);
                
                // Fallback: 如果 AI 返回的是序号（1, 2, ...）而不是真实的ID
                if (item == null && id > 0 && id <= allItems.size()) {
                    item = allItems.get((int)(id - 1));
                    id = item.getId();
                }
                
                if (item != null) {
                    relatedVideoIds.add(id);
                    if (item.getCompletionRate() != null) {
                        totalCompletionRate += item.getCompletionRate();
                        validCompletionCount++;
                    }
                }
            }

            double avgCompletionRate = validCompletionCount > 0
                    ? totalCompletionRate / validCompletionCount
                    : 0.5; // 默认完播率50%

            // 完播率加成 = 1 + (平均完播率 × 0.5)
            double completionBonus = 1 + (avgCompletionRate * 0.5);

            // 3. 计算时间权重（根据观看时间段）
            double timeWeight = calculateTimeWeight(relatedVideoIds, itemMap);

            // 4. 最终权重
            double finalWeight = baseWeight * completionBonus * timeWeight;

            // 构建结果
            Map<String, Object> weightedKeyword = new HashMap<>();
            weightedKeyword.put("word", keyword);
            weightedKeyword.put("value", Math.round(finalWeight * 10)); // 放大10倍便于展示
            weightedKeyword.put("relatedVideos", relatedVideoIds);
            List<Map<String, Object>> relatedSources = relatedVideoIds.stream()
                    .map(itemMap::get)
                    .filter(Objects::nonNull)
                    .map(item -> {
                        Map<String, Object> source = new LinkedHashMap<>();
                        source.put("itemId", item.getId());
                        source.put("title", item.getTitle());
                        source.put("platform", item.getPlatform());
                        source.put("url", item.getUrl());
                        source.put("author", item.getAuthor());
                        source.put("summary", item.getAiSummary());
                        return source;
                    })
                    .collect(Collectors.toList());
            weightedKeyword.put("relatedSources", relatedSources);

            result.add(weightedKeyword);
        }

        // 按权重排序
        result.sort((a, b) -> {
            Long valueA = (Long) a.get("value");
            Long valueB = (Long) b.get("value");
            return valueB.compareTo(valueA);
        });

        return result;
    }

    /**
     * 计算时间权重
     * 根据视频分析时间（代表观看时间）计算权重
     * 早上(6-12): 0.9, 下午(12-18): 1.0, 晚上(18-24): 1.2, 深夜(0-6): 1.1
     */
    private double calculateTimeWeight(List<Long> videoIds, Map<Long, InformationItem> itemMap) {
        if (videoIds.isEmpty()) {
            return 1.0;
        }

        double totalWeight = 0;
        for (Long videoId : videoIds) {
            InformationItem item = itemMap.get(videoId);
            if (item != null && item.getAnalyzedAt() != null) {
                int hour = item.getAnalyzedAt().getHour();

                double weight;
                if (hour >= 6 && hour < 12) {
                    weight = 0.9; // 早上
                } else if (hour >= 12 && hour < 18) {
                    weight = 1.0; // 下午
                } else if (hour >= 18 && hour < 24) {
                    weight = 1.2; // 晚上（黄金时间）
                } else {
                    weight = 1.1; // 深夜
                }

                totalWeight += weight;
            } else {
                totalWeight += 1.0; // 默认权重
            }
        }

        return totalWeight / videoIds.size();
    }

    /**
     * 保存词云数据
     */
    private UserWordCloud saveWordCloud(Long userId, LocalDate reportDate,
                                        List<Map<String, Object>> keywords) throws Exception {
        try {
            String keywordsJson = objectMapper.writeValueAsString(keywords);

            UserWordCloud wordCloud = wordCloudRepository
                    .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, reportDate)
                    .orElse(new UserWordCloud());

            wordCloud.setUserId(userId);
            wordCloud.setReportDate(reportDate);
            wordCloud.setKeywords(keywordsJson);

            return wordCloudRepository.save(wordCloud);
        } catch (Exception e) {
            log.error("保存词云数据失败", e);
            throw new Exception("保存词云数据失败: " + e.getMessage());
        }
    }

    /**
     * 获取指定日期的词云数据
     */
    public Map<String, Object> getWordCloud(Long userId, LocalDate reportDate) throws Exception {
        Optional<UserWordCloud> wordCloudOpt = wordCloudRepository
                .findFirstByUserIdAndReportDateOrderByCreatedAtDesc(userId, reportDate);

        if (wordCloudOpt.isEmpty()) {
            throw new Exception("未找到该日期的词云数据");
        }

        UserWordCloud wordCloud = wordCloudOpt.get();

        try {
            List<Map<String, Object>> keywords = objectMapper.readValue(
                    wordCloud.getKeywords(),
                    new TypeReference<List<Map<String, Object>>>() {});

            Map<String, Object> result = new HashMap<>();
            result.put("reportDate", wordCloud.getReportDate());
            result.put("keywords", keywords);
            result.put("updatedAt", wordCloud.getUpdatedAt());

            return result;
        } catch (Exception e) {
            log.error("解析词云数据失败", e);
            throw new Exception("解析词云数据失败: " + e.getMessage());
        }
    }

    /**
     * 获取周词云数据（严格的自然周：周一到周日）
     */
    public List<Map<String, Object>> getWeeklyWordClouds(Long userId, LocalDate endDate) {
        LocalDate monday = endDate.with(DayOfWeek.MONDAY);
        LocalDate sunday = endDate.with(DayOfWeek.SUNDAY);

        List<UserWordCloud> wordClouds = wordCloudRepository
                .findByUserIdAndReportDateBetweenOrderByReportDateDescCreatedAtDesc(userId, monday, sunday);

        // Deduplicate by reportDate, keeping the latest one
        Map<LocalDate, UserWordCloud> deduplicated = new LinkedHashMap<>();
        for (UserWordCloud wc : wordClouds) {
            if (!deduplicated.containsKey(wc.getReportDate())) {
                deduplicated.put(wc.getReportDate(), wc);
            }
        }

        return deduplicated.values().stream().map(wc -> {
            try {
                List<Map<String, Object>> keywords = objectMapper.readValue(
                        wc.getKeywords(),
                        new TypeReference<List<Map<String, Object>>>() {});

                Map<String, Object> result = new HashMap<>();
                result.put("reportDate", wc.getReportDate());
                result.put("keywords", keywords);

                return result;
            } catch (Exception e) {
                log.error("解析词云数据失败", e);
                return null;
            }
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }
}
