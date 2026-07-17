package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.User;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.ReviewCardRepository;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

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

    // ==================== 营养饼图 ====================

    /**
     * 返回 weeklyPieData 格式（前端 Dashboard 营养分析组件使用）
     * 当前返回 mock 数据，后续可从 UserReport 表中查询真实数据
     */
    @GetMapping("/nutrition")
    public ResponseEntity<List<Map<String, Object>>> getNutrition() {
        // TODO: 从 UserReport 表查询真实数据，当前返回 mock
        return ResponseEntity.ok(buildWeeklyPieData());
    }

    // ==================== 词云相关 ====================

    /**
     * 当前词云数据
     */
    @GetMapping("/wordcloud")
    public ResponseEntity<List<Map<String, Object>>> getWordCloud() {
        // TODO: 从 UserReport 表查询真实 wordCloudData
        return ResponseEntity.ok(buildMockWordCloudData());
    }

    /**
     * 历史词云数据（近7天）
     */
    @GetMapping("/wordcloud/history")
    public ResponseEntity<List<Map<String, Object>>> getWordCloudHistory() {
        // TODO: 从 UserReport 表查询历史 wordCloudData
        return ResponseEntity.ok(buildMockHistoricalWordCloudData());
    }

    /**
     * 词云中某关键词的溯源数据
     */
    @GetMapping("/wordcloud/{word}/sources")
    public ResponseEntity<List<Map<String, Object>>> getWordSources(@PathVariable String word) {
        // TODO: 从 information_items 表查询与 word 相关的源数据
        return ResponseEntity.ok(buildMockSources(word));
    }

    // ==================== AI 洞察 ====================

    /**
     * AI 洞察列表（aiQuotes 格式）
     */
    @GetMapping("/insights")
    public ResponseEntity<List<Map<String, Object>>> getInsights() {
        // TODO: 从 UserReport 表查询 insight 数据
        return ResponseEntity.ok(buildMockAiQuotes());
    }

    // ==================== 今日复习卡片 ====================

    /**
     * 今日复习卡片（reviewCards 格式）
     * 优先从 ReviewCard 表查询；表为空时返回 mock 数据
     */
    @GetMapping("/reviews/today")
    public ResponseEntity<List<Map<String, Object>>> getTodayReviews() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        List<com.infodigest.entity.ReviewCard> cards =
                reviewCardRepository.findByUserIdAndScheduledReviewDate(userId, today);

        if (!cards.isEmpty()) {
            List<Map<String, Object>> result = cards.stream().map(card -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("title", card.getTitle());
                map.put("content", card.getContent());
                map.put("source", card.getSourcePlatform());
                return map;
            }).collect(Collectors.toList());
            return ResponseEntity.ok(result);
        }

        // 数据库为空，返回 mock 数据
        return ResponseEntity.ok(buildMockReviewCards());
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
        list.add(buildPieItem(35, "深度知识", "#0EA5E9"));
        list.add(buildPieItem(45, "娱乐短剧", "#F43F5E"));
        list.add(buildPieItem(15, "行业资讯", "#F59E0B"));
        list.add(buildPieItem(5, "创意灵感", "#10B981"));
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
