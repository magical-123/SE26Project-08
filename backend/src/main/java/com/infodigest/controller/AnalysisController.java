package com.infodigest.controller;

import com.infodigest.dto.AnalysisResponse;
import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserRepository;
import com.infodigest.scheduler.ContentAnalysisScheduler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/api/analysis")
@Slf4j
public class AnalysisController {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private UserRepository userRepository;

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

    /**
     * 获取用户的营养维度统计（用于饼状图）
     * 算法：所有已分析视频的五维度简单加和平均
     */
    @GetMapping("/nutrition-stats/{userId}")
    public ResponseEntity<?> getNutritionStats(@PathVariable Long userId) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(401).build();
            }
            Long currentUserId = userRepository.findByUsername(authentication.getName())
                    .orElseThrow(() -> new RuntimeException("User not found")).getId();
            if (!currentUserId.equals(userId)) {
                return ResponseEntity.status(403).body(Map.of("error", "只能查看自己的营养统计"));
            }
            // 获取该用户所有已分析的视频
            var processedItems = itemRepository.findByUserIdAndProcessStatus(userId, "PROCESSED");

            if (processedItems.isEmpty()) {
                // 如果没有已分析的视频，返回默认值
                Map<String, Object> emptyStats = new HashMap<>();
                emptyStats.put("count", 0);
                emptyStats.put("nutrition", Map.of(
                    "protein", 0,
                    "carbs", 0,
                    "vitamins", 0,
                    "fats", 0,
                    "fiber", 0
                ));
                emptyStats.put("message", "暂无已分析的视频");
                return ResponseEntity.ok(emptyStats);
            }

            // 计算五维度总和
            long proteinSum = 0;
            long carbsSum = 0;
            long vitaminsSum = 0;
            long fatsSum = 0;
            long fiberSum = 0;

            for (InformationItem item : processedItems) {
                if (item.getNutritionProtein() != null) proteinSum += item.getNutritionProtein();
                if (item.getNutritionCarbs() != null) carbsSum += item.getNutritionCarbs();
                if (item.getNutritionVitamins() != null) vitaminsSum += item.getNutritionVitamins();
                if (item.getNutritionFats() != null) fatsSum += item.getNutritionFats();
                if (item.getNutritionFiber() != null) fiberSum += item.getNutritionFiber();
            }

            int count = processedItems.size();

            // 计算平均值（简单加和后平均）
            int avgProtein = (int) (proteinSum / count);
            int avgCarbs = (int) (carbsSum / count);
            int avgVitamins = (int) (vitaminsSum / count);
            int avgFats = (int) (fatsSum / count);
            int avgFiber = (int) (fiberSum / count);

            // 归一化到 100%（因为每个视频的五维度总和是100，平均后也应该是100）
            int total = avgProtein + avgCarbs + avgVitamins + avgFats + avgFiber;
            if (total > 0) {
                avgProtein = (int) Math.round(avgProtein * 100.0 / total);
                avgCarbs = (int) Math.round(avgCarbs * 100.0 / total);
                avgVitamins = (int) Math.round(avgVitamins * 100.0 / total);
                avgFats = (int) Math.round(avgFats * 100.0 / total);
                avgFiber = 100 - avgProtein - avgCarbs - avgVitamins - avgFats; // 确保总和为100
            }

            Map<String, Object> nutritionStats = new HashMap<>();
            nutritionStats.put("count", count);
            nutritionStats.put("nutrition", Map.of(
                "protein", avgProtein,
                "carbs", avgCarbs,
                "vitamins", avgVitamins,
                "fats", avgFats,
                "fiber", avgFiber
            ));

            return ResponseEntity.ok(nutritionStats);

        } catch (Exception e) {
            log.error("Failed to get nutrition stats for user {}: {}", userId, e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "获取营养统计失败: " + e.getMessage()
            ));
        }
    }
}
