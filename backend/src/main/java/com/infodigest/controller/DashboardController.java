package com.infodigest.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.infodigest.entity.ReportType;
import com.infodigest.entity.ReviewCard;
import com.infodigest.entity.UserReport;
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
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/report")
    public ResponseEntity<Map<String, Object>> getReport(
            @RequestParam String date,
            @RequestParam String type) {

        Long userId = getCurrentUserId();
        LocalDate reportDate = LocalDate.parse(date);
        ReportType reportType = ReportType.valueOf(type.toUpperCase());

        Optional<UserReport> reportOpt = userReportRepository.findByUserIdAndTypeAndReportDate(userId, reportType, reportDate);

        Map<String, Object> response = new LinkedHashMap<>();

        if (reportOpt.isPresent()) {
            UserReport report = reportOpt.get();

            // 解析 JSON 字段
            List<Map<String, Object>> nutritionData = parseJsonList(report.getNutritionData());
            List<Map<String, Object>> wordCloudData = parseJsonList(report.getWordCloudData());

            response.put("nutritionData", nutritionData);
            response.put("wordCloudData", wordCloudData);
            response.put("insightTitle", report.getInsightTitle());
            response.put("insightSummary", report.getInsightSummary());
            response.put("insightFullText", report.getInsightFullText());
        } else {
            // 没有数据时返回空结构
            response.put("nutritionData", Collections.emptyList());
            response.put("wordCloudData", Collections.emptyList());
            response.put("insightTitle", null);
            response.put("insightSummary", null);
            response.put("insightFullText", null);
        }

        // 话题聚类数据（后续 AI 跑批生成后填充）
        response.put("topicClusters", Collections.emptyList());

        // 历史词云数据（从 information_items 聚合，此处先返回空）
        response.put("historicalWordCloudData", Collections.emptyList());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/reviews/today")
    public ResponseEntity<List<Map<String, Object>>> getTodayReviews() {
        Long userId = getCurrentUserId();
        LocalDate today = LocalDate.now();

        List<ReviewCard> cards = reviewCardRepository.findByUserIdAndScheduledReviewDate(userId, today);

        List<Map<String, Object>> result = cards.stream().map(card -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", card.getId());
            map.put("title", card.getTitle());
            map.put("content", card.getContent());
            map.put("sourcePlatform", card.getSourcePlatform());
            map.put("scheduledReviewDate", card.getScheduledReviewDate().toString());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    private Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String username = authentication.getName();
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseJsonList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
