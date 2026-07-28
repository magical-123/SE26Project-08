package com.infodigest.controller;

import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.WordCloudService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wordcloud")
@RequiredArgsConstructor
@Slf4j
public class WordCloudController {

    private final WordCloudService wordCloudService;
    private final InformationItemRepository itemRepository;

    /**
     * 测试：查看已分析视频的日期分布
     */
    @GetMapping("/test/dates")
    public ResponseEntity<?> getAnalyzedVideoDates(@RequestParam Long userId) {
        try {
            List<InformationItem> items = itemRepository.findByUserIdAndProcessStatus(userId, "ANALYZED");

            if (items.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "没有已分析的视频",
                        "count", 0
                ));
            }

            // 统计每天的视频数量（使用crawledAt）
            Map<String, Long> dateCount = items.stream()
                    .filter(item -> item.getCrawledAt() != null)
                    .collect(Collectors.groupingBy(
                            item -> item.getCrawledAt().toLocalDate().toString(),
                            Collectors.counting()
                    ));

            // 统计analyzedAt
            Map<String, Long> analyzedDateCount = items.stream()
                    .filter(item -> item.getAnalyzedAt() != null)
                    .collect(Collectors.groupingBy(
                            item -> item.getAnalyzedAt().toLocalDate().toString(),
                            Collectors.counting()
                    ));

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "totalCount", items.size(),
                    "crawledAtDates", dateCount,
                    "analyzedAtDates", analyzedDateCount,
                    "hasAnalyzedAt", !analyzedDateCount.isEmpty()
            ));
        } catch (Exception e) {
            log.error("获取日期分布失败: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * 生成指定日期的词云数据
     */
    @PostMapping("/generate")
    public ResponseEntity<?> generateWordCloud(
            @RequestParam Long userId,
            @RequestParam(required = false) String date) {
        try {
            LocalDate reportDate = date != null ? LocalDate.parse(date) : LocalDate.now();

            var wordCloud = wordCloudService.generateWordCloud(userId, reportDate);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "词云生成成功",
                    "data", wordCloud
            ));
        } catch (Exception e) {
            log.error("生成词云失败: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * 获取指定日期的词云数据
     */
    @GetMapping("/daily")
    public ResponseEntity<?> getDailyWordCloud(
            @RequestParam Long userId,
            @RequestParam(required = false) String date) {
        try {
            LocalDate reportDate = date != null ? LocalDate.parse(date) : LocalDate.now();

            Map<String, Object> wordCloud = wordCloudService.getWordCloud(userId, reportDate);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", wordCloud
            ));
        } catch (Exception e) {
            log.error("获取词云失败: {}", e.getMessage());
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "error", e.getMessage(),
                    "hasData", false
            ));
        }
    }

    /**
     * 获取周词云数据（最近7天）
     */
    @GetMapping("/weekly")
    public ResponseEntity<?> getWeeklyWordClouds(
            @RequestParam Long userId,
            @RequestParam(required = false) String endDate) {
        try {
            LocalDate date = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();

            List<Map<String, Object>> wordClouds = wordCloudService.getWeeklyWordClouds(userId, date);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", wordClouds
            ));
        } catch (Exception e) {
            log.error("获取周词云失败: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
}
