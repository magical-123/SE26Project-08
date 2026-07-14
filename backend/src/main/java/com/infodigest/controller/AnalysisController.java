package com.infodigest.controller;

import com.infodigest.dto.AnalysisResponse;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.scheduler.ContentAnalysisScheduler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/analysis")
@Slf4j
public class AnalysisController {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private ContentAnalysisScheduler analysisScheduler;

    @PostMapping("/trigger/{itemId}")
    public ResponseEntity<?> triggerAnalysis(@PathVariable Long itemId) {
        try {
            InformationItem item = itemRepository.findById(itemId)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + itemId));

            if ("PROCESSED".equals(item.getProcessStatus())) {
                return ResponseEntity.ok(new AnalysisResponse(
                        itemId,
                        null,
                        null,
                        null,
                        "ALREADY_PROCESSED",
                        "该内容已经分析完成"
                ));
            }

            analysisScheduler.analyzeItemAsync(itemId);

            return ResponseEntity.ok(new AnalysisResponse(
                    itemId,
                    null,
                    null,
                    null,
                    "TRIGGERED",
                    "分析任务已触发，请稍后查看结果"
            ));

        } catch (Exception e) {
            log.error("Failed to trigger analysis for item {}: {}", itemId, e.getMessage());
            return ResponseEntity.badRequest().body(new AnalysisResponse(
                    itemId,
                    null,
                    null,
                    null,
                    "FAILED",
                    "触发分析失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status/{itemId}")
    public ResponseEntity<?> getAnalysisStatus(@PathVariable Long itemId) {
        try {
            InformationItem item = itemRepository.findById(itemId)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + itemId));

            Map<String, Object> status = new HashMap<>();
            status.put("itemId", itemId);
            status.put("processStatus", item.getProcessStatus());
            status.put("title", item.getTitle());

            return ResponseEntity.ok(status);

        } catch (Exception e) {
            log.error("Failed to get status for item {}: {}", itemId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "获取状态失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/result/{itemId}")
    public ResponseEntity<?> getAnalysisResult(@PathVariable Long itemId) {
        try {
            InformationItem item = itemRepository.findById(itemId)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + itemId));

            Map<String, Object> result = new HashMap<>();
            result.put("itemId", itemId);
            result.put("title", item.getTitle());
            result.put("platform", item.getPlatform());
            result.put("processStatus", item.getProcessStatus());

            // 营养成分
            Map<String, Integer> nutrition = new HashMap<>();
            nutrition.put("protein", item.getNutritionProtein());
            nutrition.put("carbs", item.getNutritionCarbs());
            nutrition.put("vitamins", item.getNutritionVitamins());
            nutrition.put("fats", item.getNutritionFats());
            nutrition.put("fiber", item.getNutritionFiber());
            result.put("nutrition", nutrition);

            result.put("nutritionReasoning", item.getNutritionReasoning());
            result.put("aiSummary", item.getAiSummary());
            result.put("analyzedAt", item.getAnalyzedAt());

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Failed to get analysis result for item {}: {}", itemId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "获取分析结果失败: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getAnalysisStats() {
        try {
            long totalItems = itemRepository.count();
            long unprocessedCount = itemRepository.findByProcessStatus("UNPROCESSED", null).size();
            long processedCount = itemRepository.findByProcessStatus("PROCESSED", null).size();
            long failedCount = itemRepository.findByProcessStatus("FAILED", null).size();

            Map<String, Object> stats = new HashMap<>();
            stats.put("total", totalItems);
            stats.put("unprocessed", unprocessedCount);
            stats.put("processed", processedCount);
            stats.put("failed", failedCount);

            return ResponseEntity.ok(stats);

        } catch (Exception e) {
            log.error("Failed to get analysis stats: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "获取统计数据失败: " + e.getMessage()
            ));
        }
    }
}
