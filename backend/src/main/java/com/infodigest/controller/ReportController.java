package com.infodigest.controller;

import com.infodigest.entity.User;
import com.infodigest.repository.UserReportRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.service.TopicClusterService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/report")
public class ReportController {

    @Autowired
    private UserReportRepository userReportRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TopicClusterService topicClusterService;

    // ==================== 报告摘要 ====================

    /**
     * 返回报告摘要：总时长、热门话题、效率评分
     * 当前返回 mock 数据，后续可从 UserReport 表查询
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        getCurrentUserId(); // 仅用于鉴权
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalHours", 12.5);
        summary.put("topTopic", "前端架构");
        summary.put("efficiency", 85);
        return ResponseEntity.ok(summary);
    }

    // ==================== 7天趋势 ====================

    /**
     * 返回 7 天趋势数据
     */
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> getTrend() {
        getCurrentUserId(); // 仅用于鉴权
        return ResponseEntity.ok(buildTrend());
    }

    // ==================== 话题聚类 ====================

    /**
     * 返回话题聚类数据
     * @param type weekly 或 daily
     */
    @GetMapping("/topics")
    public ResponseEntity<List<Map<String, Object>>> getTopics(@RequestParam String type) {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            List<Map<String, Object>> clusters;
            if ("daily".equalsIgnoreCase(type)) {
                log.info("获取用户 {} 的日报话题聚类", userId);
                // 日报：优先从数据库读取
                try {
                    clusters = topicClusterService.getTopicClusters(userId, today);
                } catch (Exception e) {
                    // 数据库中没有，返回空列表（前端显示"暂无数据"）
                    log.warn("用户 {} 今日话题聚类数据不存在: {}", userId, e.getMessage());
                    return ResponseEntity.ok(new ArrayList<>());
                }
            } else {
                // 周报：实时生成
                log.info("获取用户 {} 的周报话题聚类", userId);
                clusters = topicClusterService.generateWeeklyTopicClusters(userId, today);
            }
            return ResponseEntity.ok(clusters != null ? clusters : new ArrayList<>());
        } catch (Exception e) {
            log.error("获取话题聚类失败 (type={}): {}", type, e.getMessage());
            // 返回空列表而不是错误，前端显示"暂无数据"
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    /**
     * 手动触发话题聚类生成
     * @param type weekly 或 daily
     */
    @PostMapping("/topics/generate")
    public ResponseEntity<Map<String, Object>> generateTopics(@RequestParam String type) {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            List<Map<String, Object>> clusters;
            if ("daily".equalsIgnoreCase(type)) {
                log.info("手动生成用户 {} 的日报话题聚类", userId);
                clusters = topicClusterService.generateDailyTopicClusters(userId, today);
            } else {
                log.info("手动生成用户 {} 的周报话题聚类", userId);
                clusters = topicClusterService.generateWeeklyTopicClusters(userId, today);
            }

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "话题聚类生成成功");
            response.put("data", clusters);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("生成话题聚类失败 (type={}): {}", type, e.getMessage());
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", "生成失败: " + e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    // ==================== 营养饼图 ====================

    /**
     * 返回营养饼图数据
     * @param type weekly（默认）或 daily
     */
    @GetMapping("/nutrition")
    public ResponseEntity<List<Map<String, Object>>> getNutrition(
            @RequestParam(defaultValue = "weekly") String type) {
        getCurrentUserId(); // 仅用于鉴权
        if ("daily".equalsIgnoreCase(type)) {
            return ResponseEntity.ok(buildDailyPieData());
        }
        return ResponseEntity.ok(buildWeeklyPieData());
    }

    // ==================== AI 洞察 ====================

    /**
     * 返回 AI 洞察
     * @param type weekly（默认）或 daily
     */
    @GetMapping("/insight")
    public ResponseEntity<Map<String, Object>> getInsight(
            @RequestParam(defaultValue = "weekly") String type) {
        getCurrentUserId(); // 仅用于鉴权
        if ("daily".equalsIgnoreCase(type)) {
            return ResponseEntity.ok(buildDailyAiInsight());
        }
        return ResponseEntity.ok(buildWeeklyAiInsight());
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

    private List<Map<String, Object>> buildTrend() {
        String[] dates = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
        int[] values = {3, 4, 6, 5, 7, 4, 5};
        List<Map<String, Object>> list = new ArrayList<>();
        for (int i = 0; i < dates.length; i++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", dates[i]);
            item.put("value", values[i]);
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> buildWeeklyTopicClusters() {
        List<Map<String, Object>> list = new ArrayList<>();

        Map<String, Object> t1 = new LinkedHashMap<>();
        t1.put("name", "前端动画工程");
        t1.put("count", 12);
        t1.put("tags", List.of("React", "WebGL", "Framer"));
        list.add(t1);

        Map<String, Object> t2 = new LinkedHashMap<>();
        t2.put("name", "大模型应用");
        t2.put("count", 8);
        t2.put("tags", List.of("LLM", "Agent", "RAG"));
        list.add(t2);

        Map<String, Object> t3 = new LinkedHashMap<>();
        t3.put("name", "效率工具");
        t3.put("count", 5);
        t3.put("tags", List.of("Notion", "知识图谱", "PKM"));
        list.add(t3);

        return list;
    }

    private List<Map<String, Object>> buildDailyTopicClusters() {
        List<Map<String, Object>> list = new ArrayList<>();

        Map<String, Object> t1 = new LinkedHashMap<>();
        t1.put("name", "个人知识管理体系");
        t1.put("count", 4);
        t1.put("tags", List.of("PKM", "Zettelkasten", "笔记法"));
        list.add(t1);

        Map<String, Object> t2 = new LinkedHashMap<>();
        t2.put("name", "前沿渲染技术");
        t2.put("count", 3);
        t2.put("tags", List.of("WebGL", "Three.js"));
        list.add(t2);

        return list;
    }

    private List<Map<String, Object>> buildWeeklyPieData() {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(buildPieItem(35, "深度知识", "#0EA5E9"));
        list.add(buildPieItem(45, "娱乐短剧", "#F43F5E"));
        list.add(buildPieItem(15, "行业资讯", "#F59E0B"));
        list.add(buildPieItem(5, "创意灵感", "#10B981"));
        return list;
    }

    private List<Map<String, Object>> buildDailyPieData() {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(buildPieItem(60, "深度知识", "#0EA5E9"));
        list.add(buildPieItem(10, "娱乐短剧", "#F43F5E"));
        list.add(buildPieItem(20, "行业资讯", "#F59E0B"));
        list.add(buildPieItem(10, "创意灵感", "#10B981"));
        return list;
    }

    private Map<String, Object> buildPieItem(int value, String name, String color) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("value", value);
        item.put("name", name);
        item.put("itemStyle", Map.of("color", color));
        return item;
    }

    private Map<String, Object> buildWeeklyAiInsight() {
        Map<String, Object> insight = new LinkedHashMap<>();
        insight.put("title", "本周数字饮食洞察");
        insight.put("summary", "本周您在「娱乐短剧」上耗费了45%的时间，呈现出明显的**多巴胺代偿期**特征。但值得肯定的是，周三和周四对「大模型架构」与「前端动画」的集中攻坚，为您挽回了整体的营养价值。建议下周适当控制碎片化娱乐，将更多时间倾斜至您重点关注的「知识管理体系」。");
        return insight;
    }

    private Map<String, Object> buildDailyAiInsight() {
        Map<String, Object> insight = new LinkedHashMap<>();
        insight.put("title", "今日数字饮食洞察");
        insight.put("summary", "今天您的信息摄入极为**聚焦且硬核**！高达60%的深度知识摄入（主要集中在「个人知识管理」与「WebGL」），表明您正处于极佳的深度工作流中。今天几乎完全隔离了短视频干扰，这种\"低多巴胺、高内聚\"的摄入模式非常有助于长期记忆的构建，请继续保持！");
        return insight;
    }
}
