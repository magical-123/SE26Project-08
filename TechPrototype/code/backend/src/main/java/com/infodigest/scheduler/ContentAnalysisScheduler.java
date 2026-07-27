package com.infodigest.scheduler;

import com.infodigest.entity.InformationItem;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.ContentAnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.annotation.PostConstruct;

@Component
@Slf4j
public class ContentAnalysisScheduler {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private ContentAnalysisService analysisService;

    @Autowired
    private AIConfigRepository aiConfigRepository;

    // 每次最多处理 10 条
    private static final int BATCH_SIZE = 10;
    // 每条分析之间的间隔（毫秒），防止触发 API 速率限制
    private static final long INTER_ITEM_DELAY_MS = 3000;

    @PostConstruct
    public void logDiagnosticStats() {
        try {
            List<Long> allUserIds = aiConfigRepository.findAll().stream()
                    .map(c -> c.getUserId()).distinct().collect(Collectors.toList());

            for (Long uid : allUserIds) {
                List<InformationItem> userItems = itemRepository.findByUserId(uid);
                long total = userItems.size();
                long withSummary = userItems.stream()
                        .filter(i -> i.getAiSummary() != null && !i.getAiSummary().isEmpty())
                        .count();
                long unprocessed = userItems.stream()
                        .filter(i -> "UNPROCESSED".equals(i.getProcessStatus()))
                        .count();
                long failed = userItems.stream()
                        .filter(i -> "FAILED".equals(i.getProcessStatus()))
                        .count();
                long processed = userItems.stream()
                        .filter(i -> "PROCESSED".equals(i.getProcessStatus()))
                        .count();
                long processedNoSummary = userItems.stream()
                        .filter(i -> "PROCESSED".equals(i.getProcessStatus()) &&
                                (i.getAiSummary() == null || i.getAiSummary().isEmpty()))
                        .count();
                long unprocessedWithSummary = userItems.stream()
                        .filter(i -> "UNPROCESSED".equals(i.getProcessStatus()) &&
                                i.getAiSummary() != null && !i.getAiSummary().isEmpty())
                        .count();

                log.info("===== [诊断] 用户 {} 数据统计 =====", uid);
                log.info("  总条目: {}", total);
                log.info("  有AI摘要: {} / 无AI摘要: {}", withSummary, total - withSummary);
                log.info("  UNPROCESSED: {} (其中已有摘要: {})", unprocessed, unprocessedWithSummary);
                log.info("  FAILED: {}", failed);
                log.info("  PROCESSED: {} (其中无摘要: {})", processed, processedNoSummary);
                log.info("===================================");
            }
        } catch (Exception e) {
            log.warn("诊断统计执行异常: {}", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 300000) // 5分钟一次，作为兜底
    public void scanAndAnalyzeItems() {
        try {
            doScanAndAnalyze();
        } catch (Exception e) {
            // 最外层兜底：无论发生什么异常，调度器本身绝不崩溃
            log.error("[Scheduler] 调度器执行异常（已安全捕获，不影响下次调度）: {}", e.getMessage());
        }
    }

    private void doScanAndAnalyze() {
        log.debug("Starting scheduled content analysis scan");

        // 只处理有 AI 配置的用户的数据
        Set<Long> usersWithConfig = aiConfigRepository.findAll().stream()
                .map(config -> config.getUserId())
                .collect(Collectors.toSet());

        if (usersWithConfig.isEmpty()) {
            log.debug("No users with AI config found, skipping analysis");
            return;
        }

        // 优先处理缺少 AI 摘要的条目，非娱乐内容排前面
        List<InformationItem> itemsWithoutSummary = itemRepository
                .findWithoutSummaryPriorityNonEntertainment(
                        List.of("UNPROCESSED", "FAILED", "PROCESSED", "ANALYZED"),
                        usersWithConfig,
                        PageRequest.of(0, BATCH_SIZE));

        List<InformationItem> itemsToProcess = new ArrayList<>(itemsWithoutSummary);

        // 如果缺少摘要的条目不足 BATCH_SIZE，再补充 UNPROCESSED（已有摘要的）做营养分析
        if (itemsToProcess.size() < BATCH_SIZE) {
            List<InformationItem> unprocessedItems = itemRepository.findByProcessStatusAndUserIdIn(
                    "UNPROCESSED", usersWithConfig,
                    PageRequest.of(0, BATCH_SIZE - itemsToProcess.size()));
            for (InformationItem item : unprocessedItems) {
                if (itemsToProcess.stream().noneMatch(i -> i.getId().equals(item.getId()))) {
                    itemsToProcess.add(item);
                }
            }
        }

        if (itemsToProcess.isEmpty()) {
            log.debug("No items to analyze");
            return;
        }

        log.info("Found {} items to analyze", itemsToProcess.size());

        int successCount = 0;
        int failCount = 0;
        int rateLimitCount = 0;

        for (InformationItem item : itemsToProcess) {
            try {
                log.info("Analyzing item {} in background", item.getId());
                analysisService.analyzeItem(item.getId());
                successCount++;

                // 每条分析之间等待一段时间，防止触发 API 速率限制
                if (INTER_ITEM_DELAY_MS > 0) {
                    Thread.sleep(INTER_ITEM_DELAY_MS);
                }
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "";
                if (msg.contains("429") || msg.toLowerCase().contains("rate limit")) {
                    rateLimitCount++;
                    log.warn("[Scheduler] ⚠️ API 速率限制，跳过本批次剩余 {} 条任务",
                            itemsToProcess.size() - successCount - failCount - rateLimitCount);
                    // 遇到速率限制，立刻停止本轮，等下一轮调度
                    break;
                } else {
                    failCount++;
                    log.error("[Scheduler] 分析 item {} 失败: {}", item.getId(), msg);
                }
            }
        }

        log.info("[Scheduler] 本轮完成: 成功={}, 失败={}, 速率限制={}", successCount, failCount, rateLimitCount);
    }

    /**
     * 供外部 Controller 调用的异步分析入口（如手动触发按钮）
     */
    public void analyzeItemAsync(Long itemId) {
        try {
            log.info("[Scheduler] 手动触发分析 item {}", itemId);
            analysisService.analyzeItem(itemId);
        } catch (Exception e) {
            log.error("[Scheduler] 手动分析 item {} 失败: {}", itemId, e.getMessage());
        }
    }
}
