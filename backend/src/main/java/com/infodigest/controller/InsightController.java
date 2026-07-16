package com.infodigest.controller;

import com.infodigest.entity.ReportType;
import com.infodigest.entity.UserReport;
import com.infodigest.service.InsightService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 洞察报告控制器
 */
@RestController
@RequestMapping("/api/insights")
@Slf4j
public class InsightController {

    @Autowired
    private InsightService insightService;

    /**
     * 生成或重新生成洞察
     */
    @PostMapping("/generate")
    public ResponseEntity<?> generateInsight(
            @RequestParam Long userId,
            @RequestParam String type, // "DAILY" or "WEEKLY"
            @RequestParam(required = false) String date // 格式: "2026-07-16"，不传则使用今天
    ) {
        try {
            ReportType reportType = ReportType.valueOf(type.toUpperCase());
            LocalDate reportDate = date != null ? LocalDate.parse(date) : LocalDate.now();

            log.info("开始生成洞察：userId={}, type={}, date={}", userId, reportType, reportDate);

            UserReport report = insightService.generateInsight(userId, reportType, reportDate);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "洞察生成成功");
            result.put("report", buildReportResponse(report));

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("生成洞察失败：{}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "生成洞察失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取最新洞察
     */
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestInsight(
            @RequestParam Long userId,
            @RequestParam String type,
            @RequestParam(required = false) String date
    ) {
        try {
            ReportType reportType = ReportType.valueOf(type.toUpperCase());
            LocalDate reportDate = date != null ? LocalDate.parse(date) : LocalDate.now();

            Optional<UserReport> reportOpt = insightService.getLatestInsight(userId, reportType, reportDate);

            if (reportOpt.isPresent()) {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "hasReport", true,
                        "report", buildReportResponse(reportOpt.get())
                ));
            } else {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "hasReport", false,
                        "message", "还未有洞察，快去生成吧"
                ));
            }

        } catch (Exception e) {
            log.error("获取洞察失败：{}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "获取洞察失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取历史洞察列表（同一天的所有版本）
     */
    @GetMapping("/history")
    public ResponseEntity<?> getHistoryInsights(
            @RequestParam Long userId,
            @RequestParam String type,
            @RequestParam String date
    ) {
        try {
            ReportType reportType = ReportType.valueOf(type.toUpperCase());
            LocalDate reportDate = LocalDate.parse(date);

            List<UserReport> reports = insightService.getHistoryInsights(userId, reportType, reportDate);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "count", reports.size(),
                    "reports", reports.stream().map(this::buildReportResponse).toList()
            ));

        } catch (Exception e) {
            log.error("获取历史洞察失败：{}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "获取历史洞察失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取所有历史报告（每个日期只返回最新版本）
     */
    @GetMapping("/all-history")
    public ResponseEntity<?> getAllHistoryReports(
            @RequestParam Long userId,
            @RequestParam String type
    ) {
        try {
            ReportType reportType = ReportType.valueOf(type.toUpperCase());

            List<UserReport> reports = insightService.getAllHistoryReports(userId, reportType);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "count", reports.size(),
                    "reports", reports.stream().map(this::buildReportResponse).toList()
            ));

        } catch (Exception e) {
            log.error("获取所有历史报告失败：{}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "获取所有历史报告失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 构建报告响应对象
     */
    private Map<String, Object> buildReportResponse(UserReport report) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", report.getId());
        result.put("userId", report.getUserId());
        result.put("type", report.getType());
        result.put("reportDate", report.getReportDate().toString());
        result.put("insightTitle", report.getInsightTitle());
        result.put("insightSummary", report.getInsightSummary());
        result.put("insightFullText", report.getInsightFullText());
        result.put("nutritionData", report.getNutritionData());
        result.put("version", report.getVersion());
        result.put("createdAt", report.getCreatedAt());
        result.put("updatedAt", report.getUpdatedAt());
        return result;
    }
}
