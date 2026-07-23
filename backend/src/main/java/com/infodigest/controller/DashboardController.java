package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.DashboardInsightService;
import com.infodigest.service.ReviewCardGenerationService;
import com.infodigest.service.WordCloudService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private UserReportRepository userReportRepository;

    @Autowired
    private ReviewCardRepository reviewCardRepository;

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AIConfigRepository aiConfigRepository;

    @Autowired
    private DashboardInsightService dashboardInsightService;

    @Autowired
    private ReviewCardGenerationService reviewCardGenerationService;

    @Autowired
    private WordCloudService wordCloudService;

    // ==================== 营养饼图 ====================

    /**
     * 返回 weeklyPieData 格式（前端 Dashboard 营养分析组件使用）
     * 从已分析的视频中统计真实营养成分数据
     */
    @GetMapping("/nutrition")
    public ResponseEntity<Map<String, Object>> getNutrition() {
        Long userId = getCurrentUserId();

        // 查询已分析的视频（process_status = 'PROCESSED'）
        List<InformationItem> analyzedItems = informationItemRepository.findByUserIdAndProcessStatus(userId, "PROCESSED");

        if (analyzedItems.isEmpty()) {
            // 没有已分析的数据，返回空数组或 mock 数据
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", buildWeeklyPieData());
            response.put("totalHours", 0.0);
            return ResponseEntity.ok(response);
        }

        // 计算各营养成分的总和
        int totalProtein = 0;
        int totalCarbs = 0;
        int totalVitamins = 0;
        int totalFats = 0;
        int totalFiber = 0;

        for (InformationItem item : analyzedItems) {
            if (item.getNutritionProtein() != null) totalProtein += item.getNutritionProtein();
            if (item.getNutritionCarbs() != null) totalCarbs += item.getNutritionCarbs();
            if (item.getNutritionVitamins() != null) totalVitamins += item.getNutritionVitamins();
            if (item.getNutritionFats() != null) totalFats += item.getNutritionFats();
            if (item.getNutritionFiber() != null) totalFiber += item.getNutritionFiber();
        }

        int total = totalProtein + totalCarbs + totalVitamins + totalFats + totalFiber;

        if (total == 0) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("data", buildWeeklyPieData());
            response.put("totalHours", 0.0);
            return ResponseEntity.ok(response);
        }

        // 计算百分比（保持总和为100）
        int proteinPercent = Math.round((float) totalProtein * 100 / total);
        int carbsPercent = Math.round((float) totalCarbs * 100 / total);
        int vitaminsPercent = Math.round((float) totalVitamins * 100 / total);
        int fatsPercent = Math.round((float) totalFats * 100 / total);
        int fiberPercent = Math.round((float) totalFiber * 100 / total);

        // 计算总时长（小时，保留两位小数）
        double totalHours = analyzedItems.stream()
                .filter(item -> item.getDurationMinutes() != null)
                .mapToInt(InformationItem::getDurationMinutes)
                .sum() / 60.0;
        totalHours = Math.round(totalHours * 100.0) / 100.0;

        // 构建返回数据（名称需要包含关键词以便前端解析）
        List<Map<String, Object>> nutritionData = new ArrayList<>();
        nutritionData.add(buildPieItem(proteinPercent, "蛋白质（深度知识）", "#0EA5E9"));
        nutritionData.add(buildPieItem(carbsPercent, "碳水（实用技能）", "#F59E0B"));
        nutritionData.add(buildPieItem(vitaminsPercent, "维生素（创意灵感）", "#10B981"));
        nutritionData.add(buildPieItem(fatsPercent, "脂肪（纯娱乐）", "#F43F5E"));
        nutritionData.add(buildPieItem(fiberPercent, "纤维（哲思冥想）", "#8B5CF6"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("data", nutritionData);
        response.put("totalHours", totalHours);

        return ResponseEntity.ok(response);
    }

    // ==================== 词云相关 ====================

    /**
     * 当前词云数据（今日词云，与日报相同）
     */
    @GetMapping("/wordcloud")
    public ResponseEntity<List<Map<String, Object>>> getWordCloud() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            Map<String, Object> wordCloudData = wordCloudService.getWordCloud(userId, today);
            List<Map<String, Object>> keywords = (List<Map<String, Object>>) wordCloudData.get("keywords");
            return ResponseEntity.ok(keywords != null ? keywords : new ArrayList<>());
        } catch (Exception e) {
            log.warn("获取今日词云失败: {}", e.getMessage());
            // 返回空列表而不是错误，前端会显示"暂无数据"
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * 历史词云数据（近7天，用于周报滑动查看）
     */
    @GetMapping("/wordcloud/history")
    public ResponseEntity<List<Map<String, Object>>> getWordCloudHistory() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            List<Map<String, Object>> weeklyData = wordCloudService.getWeeklyWordClouds(userId, today);
            return ResponseEntity.ok(weeklyData);
        } catch (Exception e) {
            log.error("获取历史词云失败: {}", e.getMessage());
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * 词云中某关键词的溯源数据
     */
    @GetMapping("/wordcloud/{word}/sources")
    public ResponseEntity<List<Map<String, Object>>> getWordSources(
            @PathVariable String word,
            @RequestParam(required = false) String date) {
        try {
            Long userId = getCurrentUserId();
            LocalDate queryDate = date != null ? LocalDate.parse(date) : LocalDate.now();

            log.info("[溯源API] 查询词汇: {}, 用户ID: {}, 日期: {}", word, userId, queryDate);

            // 获取指定日期的词云数据
            Map<String, Object> wordCloudData = wordCloudService.getWordCloud(userId, queryDate);
            List<Map<String, Object>> keywords = (List<Map<String, Object>>) wordCloudData.get("keywords");

            log.info("[溯源API] 词云数据包含 {} 个关键词", keywords != null ? keywords.size() : 0);

            if (keywords == null) {
                log.warn("[溯源API] keywords为null");
                return ResponseEntity.ok(new ArrayList<>());
            }

            // 查找指定关键词的相关视频ID
            List<Long> relatedVideoIds = null;
            for (Map<String, Object> keyword : keywords) {
                String keywordWord = (String) keyword.get("word");
                log.debug("[溯源API] 检查关键词: {}", keywordWord);
                if (word.equals(keywordWord)) {
                    Object relatedVideosObj = keyword.get("relatedVideos");
                    log.info("[溯源API] 找到匹配关键词: {}, relatedVideos对象: {}, 类型: {}",
                            word, relatedVideosObj, relatedVideosObj != null ? relatedVideosObj.getClass() : "null");

                    // 转换为List<Long>，处理Integer类型
                    if (relatedVideosObj instanceof List) {
                        List<?> rawList = (List<?>) relatedVideosObj;
                        relatedVideoIds = rawList.stream()
                                .map(obj -> {
                                    if (obj instanceof Number) {
                                        return ((Number) obj).longValue();
                                    }
                                    return null;
                                })
                                .filter(Objects::nonNull)
                                .collect(Collectors.toList());
                    }
                    log.info("[溯源API] 转换后的视频IDs: {}", relatedVideoIds);
                    break;
                }
            }

            if (relatedVideoIds == null || relatedVideoIds.isEmpty()) {
                log.warn("[溯源API] 未找到关键词 '{}' 的相关视频", word);
                return ResponseEntity.ok(new ArrayList<>());
            }

            // 查询相关视频的详细信息
            List<Map<String, Object>> sources = new ArrayList<>();
            for (Long videoId : relatedVideoIds) {
                informationItemRepository.findById(videoId).ifPresent(item -> {
                    Map<String, Object> source = new LinkedHashMap<>();
                    source.put("id", item.getId());
                    source.put("title", item.getTitle());
                    source.put("platform", item.getPlatform());
                    source.put("link", item.getUrl());
                    source.put("summary", item.getAiSummary());
                    source.put("completionRate", item.getCompletionRate());
                    sources.add(source);
                });
            }

            log.info("[溯源API] 返回 {} 条溯源记录", sources.size());
            return ResponseEntity.ok(sources);
        } catch (Exception e) {
            log.error("获取词云溯源数据失败: {}", e.getMessage(), e);
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * 手动触发生成今日词云
     */
    @PostMapping("/wordcloud/generate")
    public ResponseEntity<Map<String, Object>> generateWordCloud() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            log.info("开始为用户 {} 生成词云数据 ({})", userId, today);
            wordCloudService.generateWordCloud(userId, today);
            log.info("用户 {} 词云生成成功", userId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "词云生成成功");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("用户 {} 词云生成失败: {}", userId, e.getMessage(), e);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "词云生成失败: " + e.getMessage());
            // 返回200状态码，让前端根据success字段判断，避免被当作网络错误
            return ResponseEntity.ok(result);
        }
    }

    // ==================== AI 洞察 ====================

    /**
     * AI 洞察列表（aiQuotes 格式）
     * 从 UserReport 表查询真实洞察数据
     */
    @GetMapping("/insights")
    public ResponseEntity<List<Map<String, Object>>> getInsights() {
        Long userId = getCurrentUserId();
        Map<String, Object> insight = dashboardInsightService.getDashboardInsight(userId);

        // 返回单个洞察的列表格式（前端期望数组）
        return ResponseEntity.ok(List.of(insight));
    }

    /**
     * 手动触发生成仪表盘洞察
     */
    @PostMapping("/insights/generate")
    public ResponseEntity<Map<String, Object>> generateInsight() {
        Long userId = getCurrentUserId();

        try {
            dashboardInsightService.generateDashboardInsight(userId);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "洞察生成成功");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "洞察生成失败: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }
    }

    // ==================== 今日复习卡片 ====================

    /**
     * 今日复习卡片（reviewCards 格式）
     * 从 ReviewCardGenerationService 获取真实数据，返回1-5张卡片
     */
    @GetMapping("/reviews/today")
    public ResponseEntity<List<Map<String, Object>>> getTodayReviews() {
        Long userId = getCurrentUserId();
        List<Map<String, Object>> reviewCards = reviewCardGenerationService.getTodayReviewCards(userId);
        return ResponseEntity.ok(reviewCards);
    }

    /**
     * 处理复习卡片的反馈 (记住了/忘记了)
     */
    @PostMapping("/reviews/{cardId}/feedback")
    public ResponseEntity<Map<String, Object>> handleReviewFeedback(@PathVariable Long cardId, @RequestBody Map<String, Boolean> payload) {
        Long userId = getCurrentUserId();
        Boolean remembered = payload.get("remembered");
        
        if (remembered == null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "Missing 'remembered' field in request body");
            return ResponseEntity.badRequest().body(result);
        }

        try {
            reviewCardGenerationService.processFeedback(cardId, userId, remembered);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "Feedback processed successfully");
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException | SecurityException e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(result);
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "Failed to process feedback: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 删除复习卡片 (不再复习)
     */
    @DeleteMapping("/reviews/{cardId}")
    public ResponseEntity<Map<String, Object>> deleteReviewCard(@PathVariable Long cardId) {
        Long userId = getCurrentUserId();
        try {
            reviewCardRepository.findById(cardId).ifPresent(card -> {
                if (card.getUserId().equals(userId)) {
                    reviewCardRepository.deleteById(cardId);
                }
            });
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "Card deleted successfully");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "Failed to delete card: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }
    }

    /**
     * 手动触发生成今日复习卡片
     */
    @PostMapping("/reviews/generate")
    public ResponseEntity<Map<String, Object>> generateReviewCard() {
        Long userId = getCurrentUserId();

        try {
            reviewCardGenerationService.generateTodayReviewCard(userId);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", true);
            result.put("message", "复习卡片生成成功");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("success", false);
            result.put("message", "复习卡片生成失败: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }
    }

    // ==================== 今日统计摘要 ====================

    /**
     * 今日统计：浏览总量、优质信息源数、沉浸时长（小时）
     * 从 information_items 表实时计算
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);

        int todayViews = items.size();
        int premiumCount = (int) items.stream()
                .filter(InformationItem::getHasNote)
                .count();
        double immersionHours = items.stream()
                .filter(item -> item.getDurationMinutes() != null)
                .mapToInt(InformationItem::getDurationMinutes)
                .sum() / 60.0;

        // 保留最多两位小数
        immersionHours = Math.round(immersionHours * 100.0) / 100.0;

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("todayViews", todayViews);
        summary.put("premiumCount", premiumCount);
        summary.put("immersionHours", immersionHours);

        return ResponseEntity.ok(summary);
    }

    // ==================== 清理重复数据 ====================

    /**
     * 清理当前用户的重复信息项（基于 url + platform 去重，保留最新的一条）
     */
    @PostMapping("/cleanup-duplicates")
    public ResponseEntity<Map<String, Object>> cleanupDuplicates() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);

        Map<String, InformationItem> seen = new LinkedHashMap<>();
        List<Long> toDelete = new ArrayList<>();

        items.sort((a, b) -> b.getCrawledAt().compareTo(a.getCrawledAt()));

        for (InformationItem item : items) {
            String key = (item.getUrl() != null ? item.getUrl() : "") + "|" + (item.getPlatform() != null ? item.getPlatform() : "");
            if (seen.containsKey(key)) {
                toDelete.add(item.getId());
            } else {
                seen.put(key, item);
            }
        }

        for (Long id : toDelete) {
            informationItemRepository.deleteById(id);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("deletedCount", toDelete.size());
        result.put("remainingCount", seen.size());
        result.put("message", "已删除 " + toDelete.size() + " 条重复数据，保留 " + seen.size() + " 条");
        return ResponseEntity.ok(result);
    }

    /**
     * 基于标题去重：同一平台下标题相同的只保留最新一条
     */
    @PostMapping("/cleanup-title-duplicates")
    public ResponseEntity<Map<String, Object>> cleanupTitleDuplicates() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);

        Map<String, InformationItem> seen = new LinkedHashMap<>();
        List<Long> toDelete = new ArrayList<>();

        items.sort((a, b) -> b.getCrawledAt().compareTo(a.getCrawledAt()));

        for (InformationItem item : items) {
            String key = (item.getTitle() != null ? item.getTitle() : "") + "|" + (item.getPlatform() != null ? item.getPlatform() : "");
            if (seen.containsKey(key)) {
                toDelete.add(item.getId());
            } else {
                seen.put(key, item);
            }
        }

        for (Long id : toDelete) {
            informationItemRepository.deleteById(id);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("deletedCount", toDelete.size());
        result.put("remainingCount", seen.size());
        result.put("message", "已删除 " + toDelete.size() + " 条标题重复数据，保留 " + seen.size() + " 条");
        return ResponseEntity.ok(result);
    }

    // ==================== 迁移旧优质数据 ====================

    /**
     * 重置所有 isPremium 为 false（修复 Hibernate 自动建列时的默认值问题）
     */
    @PostMapping("/reset-premium")
    public ResponseEntity<Map<String, Object>> resetPremium() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);

        int reset = 0;
        for (InformationItem item : items) {
            if (Boolean.TRUE.equals(item.getIsPremium())) {
                item.setIsPremium(false);
                informationItemRepository.save(item);
                reset++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("resetCount", reset);
        result.put("message", "已将 " + reset + " 条数据的 isPremium 重置为 false");
        return ResponseEntity.ok(result);
    }

    /**
     * 清理 B 站错误字幕导致的「AI 摘要与内容不符」条目
     * 仅针对 BILIBILI（错误字幕只可能出现在 B 站字幕抓取环节；
     * 知乎问答/GitHub 的摘要天然不含标题关键词，属于正常情况，不能误清）。
     * 两种情况判定为脏数据：
     * 1. contentRaw 非空且与标题完全不相关 → 错误字幕
     * 2. contentRaw 为空/等于标题，但已有摘要与标题完全不相关 → 基于已丢失的错误内容生成的孤儿摘要
     */
    @PostMapping("/cleanup-mismatched-content")
    public ResponseEntity<Map<String, Object>> cleanupMismatchedContent() {
        Long userId = getCurrentUserId();
        List<InformationItem> items = informationItemRepository.findByUserId(userId);

        int fixed = 0;
        List<String> fixedTitles = new ArrayList<>();
        for (InformationItem item : items) {
            if (!"BILIBILI".equalsIgnoreCase(item.getPlatform())) continue;
            String title = item.getTitle();
            if (title == null || title.isEmpty()) continue;

            String content = item.getContentRaw();
            String summary = item.getAiSummary();

            boolean hasRealContent = content != null && !content.isEmpty() && !content.equals(title);
            // 情况1：字幕内容与标题完全无关（错误字幕）
            boolean contentBad = hasRealContent && !isTextRelevant(title, content);
            // 情况2：无有效内容但摘要与标题完全无关（孤儿摘要）
            boolean orphanSummary = !hasRealContent && summary != null && !summary.isEmpty()
                    && !isTextRelevant(title, summary);

            if (contentBad || orphanSummary) {
                item.setContentRaw(title); // 用标题作为内容，供 AI 重新分析
                item.setAiSummary(null);
                item.setNutritionProtein(null);
                item.setNutritionCarbs(null);
                item.setNutritionVitamins(null);
                item.setNutritionFats(null);
                item.setNutritionFiber(null);
                item.setNutritionReasoning(null);
                item.setKnowledgeScore(null);
                item.setScoreReasoning(null);
                item.setAnalyzedAt(null);
                item.setProcessStatus("UNPROCESSED"); // 让定时任务重新分析
                informationItemRepository.save(item);
                fixed++;
                String shortTitle = title.substring(0, Math.min(30, title.length()));
                fixedTitles.add(shortTitle);
                System.out.println("[Cleanup] 修复不匹配条目(" + (contentBad ? "错误字幕" : "孤儿摘要") + "): " + shortTitle);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("fixedCount", fixed);
        result.put("fixedTitles", fixedTitles);
        result.put("message", "已修复 " + fixed + " 条内容不匹配的条目，等待 AI 重新生成摘要");
        return ResponseEntity.ok(result);
    }

    /**
     * bigram 相关性检查：标题切成2字滑动窗口 + 英文单词(>=3字母)，
     * 文本中命中任意一个非停用 gram 即视为相关
     */
    private boolean isTextRelevant(String title, String text) {
        java.util.Set<String> stopGrams = java.util.Set.of(
                "视频", "内容", "文章", "介绍", "分享", "讲解", "分析", "什么", "怎么", "为什", "么样", "如何",
                "一个", "这个", "那个", "可以", "不能", "不是", "就是", "还是", "没有", "有没", "其实", "真的",
                "到底", "是不", "大家", "我们", "你们", "他们", "自己", "觉得", "知道", "应该", "时候", "现在",
                "问题", "东西", "事情", "感觉", "看到", "出现", "进行", "使用", "需要", "带你", "教程");

        List<String> grams = new ArrayList<>();
        java.util.regex.Matcher cnSeg = java.util.regex.Pattern.compile("[\\u4e00-\\u9fa5]+").matcher(title);
        while (cnSeg.find()) {
            String seg = cnSeg.group();
            for (int i = 0; i + 2 <= seg.length(); i++) {
                String g = seg.substring(i, i + 2);
                if (!stopGrams.contains(g)) grams.add(g);
            }
        }
        java.util.regex.Matcher enWord = java.util.regex.Pattern.compile("[a-zA-Z]{3,}").matcher(title);
        while (enWord.find()) grams.add(enWord.group().toLowerCase());

        if (grams.isEmpty()) return true; // 无法提取关键词时放行

        String lower = text.toLowerCase();
        for (String g : grams) {
            if (lower.contains(g)) return true;
        }
        return false;
    }

    /**
     * 诊断端点：返回各用户卡片的 AI 摘要状态统计及 AI 配置摘要
     */
    @GetMapping("/diagnostic")
    public ResponseEntity<List<Map<String, Object>>> getDiagnostic() {
        List<Map<String, Object>> result = new ArrayList<>();

        try {
            // 对所有有数据的用户生成统计
            List<User> allUsers = userRepository.findAll();
            for (User user : allUsers) {
                Map<String, Object> userStats = buildUserStats(user.getId());
                userStats.put("username", user.getUsername());
                result.add(userStats);
            }
        } catch (Exception e) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", e.getMessage());
            result.add(error);
        }

        return ResponseEntity.ok(result);
    }

    private Map<String, Object> buildUserStats(Long userId) {
        List<InformationItem> allItems = informationItemRepository.findByUserId(userId);

        Map<String, Long> statusCounts = allItems.stream()
                .collect(Collectors.groupingBy(InformationItem::getProcessStatus, Collectors.counting()));

        long withSummary = allItems.stream()
                .filter(i -> i.getAiSummary() != null && !i.getAiSummary().isEmpty())
                .count();
        long withoutSummary = allItems.size() - withSummary;

        long unprocessedWithSummary = allItems.stream()
                .filter(i -> "UNPROCESSED".equals(i.getProcessStatus()) && i.getAiSummary() != null && !i.getAiSummary().isEmpty())
                .count();
        long processedWithoutSummary = allItems.stream()
                .filter(i -> "PROCESSED".equals(i.getProcessStatus()) && (i.getAiSummary() == null || i.getAiSummary().isEmpty()))
                .count();
        long failedWithSummary = allItems.stream()
                .filter(i -> "FAILED".equals(i.getProcessStatus()) && i.getAiSummary() != null && !i.getAiSummary().isEmpty())
                .count();
        long failedWithoutSummary = allItems.stream()
                .filter(i -> "FAILED".equals(i.getProcessStatus()) && (i.getAiSummary() == null || i.getAiSummary().isEmpty()))
                .count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("userId", userId);
        stats.put("totalItems", (long) allItems.size());
        stats.put("withAiSummary", withSummary);
        stats.put("withoutAiSummary", withoutSummary);
        stats.put("unprocessedWithSummary", unprocessedWithSummary);
        stats.put("processedWithoutSummary", processedWithoutSummary);
        stats.put("failedWithSummary", failedWithSummary);
        stats.put("failedWithoutSummary", failedWithoutSummary);
        stats.put("statusCounts", statusCounts);

        // 添加 AI 配置信息
        var aiConfig = aiConfigRepository.findByUserId(userId);
        Map<String, Object> aiConfigInfo = new LinkedHashMap<>();
        if (aiConfig.isPresent()) {
            var config = aiConfig.get();
            aiConfigInfo.put("configured", true);
            aiConfigInfo.put("model", config.getCustomModelName() != null ? config.getCustomModelName() : "default");
            String endpoint = config.getApiEndpoint();
            if (endpoint != null && endpoint.length() > 30) {
                endpoint = endpoint.substring(0, 27) + "...";
            }
            aiConfigInfo.put("endpoint", endpoint != null ? endpoint : "default");
            aiConfigInfo.put("hasApiKey", config.getApiKey() != null && !config.getApiKey().isEmpty());
            // 安全展示 ApiKey 的前后几位
            if (config.getApiKey() != null && config.getApiKey().length() > 8) {
                String key = config.getApiKey();
                aiConfigInfo.put("apiKeyPreview", key.substring(0, 4) + "..." + key.substring(key.length() - 4));
            }
        } else {
            aiConfigInfo.put("configured", false);
        }
        stats.put("aiConfig", aiConfigInfo);

        return stats;
    }

    // ==================== 鉴权辅助 ====================

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // ==================== Mock 数据构建 ====================

    private List<Map<String, Object>> buildWeeklyPieData() {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(buildPieItem(0, "蛋白质（深度知识）", "#0EA5E9"));
        list.add(buildPieItem(0, "碳水（实用技能）", "#F59E0B"));
        list.add(buildPieItem(0, "维生素（创意灵感）", "#10B981"));
        list.add(buildPieItem(0, "脂肪（纯娱乐）", "#F43F5E"));
        list.add(buildPieItem(0, "纤维（哲思冥想）", "#8B5CF6"));
        return list;
    }

    private Map<String, Object> buildPieItem(int value, String name, String color) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("value", value);
        item.put("name", name);
        item.put("itemStyle", Map.of("color", color));
        return item;
    }

    private List<Map<String, Object>> buildMockWordCloudData() {
        return buildWordCloudList(
                new String[]{"大模型架构", "React 19", "Framer Motion", "UI 设计心理学", "独立开发",
                             "个人知识管理", "WebGL 渲染", "播客访谈", "数字饮食", "微前端"},
                new int[]{15000, 10081, 9386, 8500, 6000, 5500, 4200, 3800, 3200, 2500}
        );
    }

    private List<Map<String, Object>> buildWordCloudList(String[] names, int[] values) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", names[i]);
            item.put("value", values[i]);
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> buildMockHistoricalWordCloudData() {
        List<Map<String, Object>> history = new ArrayList<>();

        history.add(buildHistoryEntry("6天前", new String[]{"个人知识管理", "WebGL 渲染", "React 19", "播客访谈", "UI 设计心理学"},
                new int[]{14000, 9000, 8000, 5000, 4000}));
        history.add(buildHistoryEntry("5天前", new String[]{"个人知识管理", "WebGL 渲染", "React 19", "独立开发", "数字饮食"},
                new int[]{11000, 10000, 9000, 7000, 4500}));
        history.add(buildHistoryEntry("4天前", new String[]{"WebGL 渲染", "微前端", "React 19", "独立开发", "大模型架构"},
                new int[]{13000, 9500, 9000, 8000, 5000}));
        history.add(buildHistoryEntry("3天前", new String[]{"微前端", "React 19", "独立开发", "UI 设计心理学", "大模型架构"},
                new int[]{12000, 11000, 8000, 6000, 4000}));
        history.add(buildHistoryEntry("2天前", new String[]{"React 19", "大模型架构", "Framer Motion", "微前端", "UI 设计心理学"},
                new int[]{13000, 8000, 7500, 7000, 6500}));
        history.add(buildHistoryEntry("昨天", new String[]{"大模型架构", "Framer Motion", "React 19", "UI 设计心理学", "个人知识管理"},
                new int[]{12000, 11000, 9000, 8000, 5000}));
        history.add(buildHistoryEntry("今天", new String[]{"大模型架构", "React 19", "Framer Motion", "UI 设计心理学", "独立开发",
                        "个人知识管理", "WebGL 渲染", "播客访谈", "数字饮食", "微前端"},
                new int[]{15000, 10081, 9386, 8500, 6000, 5500, 4200, 3800, 3200, 2500}));

        return history;
    }

    private Map<String, Object> buildHistoryEntry(String date, String[] names, int[] values) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("date", date);
        entry.put("data", buildWordCloudList(names, values));
        return entry;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> buildMockSources(String word) {
        Map<String, List<Map<String, Object>>> sourceMapping = new LinkedHashMap<>();

        sourceMapping.put("大模型架构", buildSourceList(
                new String[]{"【深度】AI 时代的前端架构演进", "深入理解 MoE 混合专家模型"},
                new String[]{"BILIBILI", "ZHIHU"},
                new String[]{"2小时前", "昨天"},
                new String[]{"深度知识", "深度知识"}
        ));

        sourceMapping.put("React 19", buildSourceList(
                new String[]{"React 19 新特性完全解析"},
                new String[]{"BILIBILI"},
                new String[]{"3小时前"},
                new String[]{"行业资讯"}
        ));

        sourceMapping.put("Framer Motion", buildSourceList(
                new String[]{"Framer Motion 布局动画实战", "React 动画终极指南"},
                new String[]{"Bilibili", "掘金"},
                new String[]{"11:45", "09:20"},
                new String[]{"视频", "文章"}
        ));

        return sourceMapping.getOrDefault(word, Collections.emptyList());
    }

    private List<Map<String, Object>> buildSourceList(String[] titles, String[] platforms,
                                                       String[] times, String[] categories) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < titles.length; i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("title", titles[i]);
            item.put("platform", platforms[i]);
            item.put("time", times[i]);
            item.put("category", categories[i]);
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> buildMockAiQuotes() {
        List<Map<String, Object>> quotes = new ArrayList<>();

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("id", 1);
        q1.put("summary", "你最近对「大模型架构」的关注度显著上升...");
        q1.put("fullText", "你最近对「大模型架构」的关注度显著上升，这与你上个月研究的「Transformer 机制」形成了很好的知识闭环。建议你可以继续深入了解 MoE (Mixture of Experts) 的混合专家架构，以拓展你对参数扩展的理解边界。");
        q1.put("sourcePlatform", "B站 · 深度技术解析");
        q1.put("sourceLink", "https://bilibili.com/video/xxx");
        q1.put("tags", List.of("大模型", "Transformer", "MoE"));
        quotes.add(q1);

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("id", 2);
        q2.put("summary", "昨天晚上你浏览了高密度的哲学内容...");
        q2.put("fullText", "昨天晚上你花了两小时浏览了高密度的哲学内容，这是很好的深度思考时刻。在碎片化时代，能够保持长达两小时的心流状态是非常难得的「数字冥想」。");
        q2.put("sourcePlatform", "知乎 · 哲学板块");
        q2.put("sourceLink", "https://zhihu.com/xxx");
        q2.put("tags", List.of("哲学", "心流", "深度思考"));
        quotes.add(q2);

        return quotes;
    }

    private List<Map<String, Object>> buildMockReviewCards() {
        List<Map<String, Object>> cards = new ArrayList<>();

        Map<String, Object> c1 = new LinkedHashMap<>();
        c1.put("title", "什么是 LoRA?");
        c1.put("content", "一种微调大模型的高效技术，通过冻结预训练权重，在每一层注入可训练的秩分解矩阵。");
        c1.put("source", "知乎 · AI 算法工程师");
        cards.add(c1);

        Map<String, Object> c2 = new LinkedHashMap<>();
        c2.put("title", "设计心理学：锚定效应");
        c2.put("content", "人们在做决策时，过度依赖最初获得的信息（即「锚」）。在UI设计中常用于价格方案的高对比呈现。");
        c2.put("source", "B站 · 交互设计");
        cards.add(c2);

        return cards;
    }
}
