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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 数字饮食报告接口。
 *
 * 所有统计均来自当前用户的 InformationItem / UserReport 数据，不提供演示用 Mock 数据。
 */
@Slf4j
@RestController
@RequestMapping("/api/report")
public class ReportController {

    private static final Map<String, String> NUTRITION_NAMES = Map.of(
            "protein", "蛋白质（深度知识）",
            "carbs", "碳水（实用技能）",
            "vitamins", "维生素（创意灵感）",
            "fats", "脂肪（纯娱乐）",
            "fiber", "纤维（哲思冥想）"
    );

    private static final Map<String, String> NUTRITION_COLORS = Map.of(
            "protein", "#0EA5E9",
            "carbs", "#F59E0B",
            "vitamins", "#10B981",
            "fats", "#F43F5E",
            "fiber", "#8B5CF6"
    );

    @Autowired
    private UserReportRepository userReportRepository;

    @Autowired
    private InformationItemRepository informationItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TopicClusterService topicClusterService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * 返回最近 7 天的真实摄入摘要。
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        Long userId = getCurrentUserId();
        LocalDateTime end = LocalDateTime.now();
        LocalDateTime start = end.minusDays(7);
        List<InformationItem> items = getProcessedItems(userId, start, end);

        double totalHours = items.stream()
                .mapToLong(this::getWatchSeconds)
                .sum() / 3600.0;
        String topTopic = items.stream()
                .map(InformationItem::getCategory)
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.groupingBy(value -> value, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("暂无数据");
        int efficiency = (int) Math.round(items.stream()
                .map(InformationItem::getKnowledgeScore)
                .filter(score -> score != null)
                .mapToInt(Integer::intValue)
                .average()
                .orElse(0));

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalHours", Math.round(totalHours * 100.0) / 100.0);
        summary.put("topTopic", topTopic);
        summary.put("efficiency", efficiency);
        summary.put("itemCount", items.size());
        return ResponseEntity.ok(summary);
    }

    /**
     * 返回最近 7 天每天的真实观看时长（小时）。
     */
    @GetMapping("/trend")
    public ResponseEntity<List<Map<String, Object>>> getTrend() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(6);
        List<InformationItem> items = getProcessedItems(
                userId, startDate.atStartOfDay(), today.plusDays(1).atStartOfDay());

        Map<LocalDate, Long> secondsByDate = items.stream()
                .filter(item -> item.getCrawledAt() != null)
                .collect(Collectors.groupingBy(
                        item -> item.getCrawledAt().toLocalDate(),
                        Collectors.summingLong(this::getWatchSeconds)));

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("M/d");
        List<Map<String, Object>> trend = new ArrayList<>();
        for (int offset = 0; offset < 7; offset++) {
            LocalDate date = startDate.plusDays(offset);
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", date.format(formatter));
            point.put("reportDate", date.toString());
            point.put("value", Math.round(secondsByDate.getOrDefault(date, 0L) / 36.0) / 100.0);
            trend.add(point);
        }
        return ResponseEntity.ok(trend);
    }

    @GetMapping("/topics")
    public ResponseEntity<List<Map<String, Object>>> getTopics(@RequestParam String type) {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            List<Map<String, Object>> clusters;
            if ("daily".equalsIgnoreCase(type)) {
                clusters = topicClusterService.getTopicClusters(userId, today, "daily");
            } else {
                clusters = topicClusterService.generateWeeklyTopicClusters(userId, today);
            }
            return ResponseEntity.ok(clusters != null ? clusters : new ArrayList<>());
        } catch (Exception e) {
            log.warn("获取话题聚类失败 (userId={}, type={}): {}", userId, type, e.getMessage());
            return ResponseEntity.ok(new ArrayList<>());
        }
    }

    @PostMapping("/topics/generate")
    public ResponseEntity<Map<String, Object>> generateTopics(@RequestParam String type) {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        try {
            List<Map<String, Object>> clusters = "daily".equalsIgnoreCase(type)
                    ? topicClusterService.generateDailyTopicClusters(userId, today)
                    : topicClusterService.generateWeeklyTopicClusters(userId, today);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "话题聚类生成成功",
                    "data", clusters != null ? clusters : List.of()
            ));
        } catch (Exception e) {
            log.error("生成话题聚类失败 (userId={}, type={}): {}", userId, type, e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "生成失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 返回当前日报/周报保存的五维营养数据。
     */
    @GetMapping("/nutrition")
    public ResponseEntity<List<Map<String, Object>>> getNutrition(
            @RequestParam(defaultValue = "weekly") String type) {
        Long userId = getCurrentUserId();
        ReportType reportType = parseReportType(type);
        LocalDate reportDate = normalizeReportDate(reportType, LocalDate.now());
        Optional<UserReport> report = userReportRepository
                .findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(userId, reportType, reportDate);

        Map<String, Integer> nutrition = report
                .map(UserReport::getNutritionData)
                .map(this::parseNutrition)
                .orElseGet(Map::of);

        return ResponseEntity.ok(buildNutritionResponse(nutrition));
    }

    /**
     * 返回当前日报/周报的真实 AI 洞察；没有报告时明确返回 hasReport=false。
     */
    @GetMapping("/insight")
    public ResponseEntity<Map<String, Object>> getInsight(
            @RequestParam(defaultValue = "weekly") String type) {
        Long userId = getCurrentUserId();
        ReportType reportType = parseReportType(type);
        LocalDate reportDate = normalizeReportDate(reportType, LocalDate.now());
        Optional<UserReport> report = userReportRepository
                .findFirstByUserIdAndTypeAndReportDateOrderByVersionDesc(userId, reportType, reportDate);

        if (report.isEmpty()) {
            return ResponseEntity.ok(Map.of("hasReport", false));
        }

        UserReport value = report.get();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("hasReport", true);
        response.put("title", value.getInsightTitle());
        response.put("summary", value.getInsightSummary());
        response.put("fullText", value.getInsightFullText());
        response.put("reportDate", value.getReportDate());
        response.put("version", value.getVersion());
        return ResponseEntity.ok(response);
    }

    private List<InformationItem> getProcessedItems(Long userId, LocalDateTime start, LocalDateTime end) {
        return informationItemRepository
                .findByUserIdAndProcessStatusAndCrawledAtBetween(userId, "PROCESSED", start, end);
    }

    private long getWatchSeconds(InformationItem item) {
        if (item.getWatchDurationSeconds() != null && item.getWatchDurationSeconds() > 0) {
            return item.getWatchDurationSeconds();
        }
        if (item.getDurationMinutes() != null && item.getDurationMinutes() > 0) {
            return item.getDurationMinutes() * 60L;
        }
        return 0;
    }

    private ReportType parseReportType(String type) {
        return "daily".equalsIgnoreCase(type) ? ReportType.DAILY : ReportType.WEEKLY;
    }

    private LocalDate normalizeReportDate(ReportType type, LocalDate date) {
        return type == ReportType.WEEKLY ? date.with(DayOfWeek.MONDAY) : date;
    }

    private Map<String, Integer> parseNutrition(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("报告营养数据 JSON 无法解析: {}", e.getMessage());
            return Map.of();
        }
    }

    private List<Map<String, Object>> buildNutritionResponse(Map<String, Integer> nutrition) {
        return List.of("protein", "carbs", "vitamins", "fats", "fiber").stream()
                .map(key -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("value", nutrition.getOrDefault(key, 0));
                    item.put("name", NUTRITION_NAMES.get(key));
                    item.put("itemStyle", Map.of("color", NUTRITION_COLORS.get(key)));
                    return item;
                })
                .toList();
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
}
