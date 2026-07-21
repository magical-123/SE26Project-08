package com.infodigest.scheduler;

import com.infodigest.entity.InformationItem;
import com.infodigest.repository.AIConfigRepository;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.ContentAnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
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

    // 每 60 秒扫描一次，每次最多处理 10 条（异步并发）
    private static final int BATCH_SIZE = 10;

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

    @Scheduled(fixedRate = 60000)
    public void scanAndAnalyzeItems() {
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

        for (InformationItem item : itemsToProcess) {
            analyzeItemAsync(item.getId());
        }
    }

    @Async
    public void analyzeItemAsync(Long itemId) {
        try {
            log.info("Analyzing item {} in background", itemId);
            analysisService.analyzeItem(itemId);
        } catch (Exception e) {
            log.error("Failed to analyze item {}: {}", itemId, e.getMessage());
        }
    }
}
