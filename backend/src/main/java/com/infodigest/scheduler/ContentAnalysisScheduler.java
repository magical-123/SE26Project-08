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

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Slf4j
public class ContentAnalysisScheduler {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private ContentAnalysisService analysisService;

    @Autowired
    private AIConfigRepository aiConfigRepository;

    // 每 30 秒扫描一次，每次最多处理 20 条（异步并发）
    private static final int BATCH_SIZE = 20;

    @Scheduled(fixedRate = 30000)
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

        List<InformationItem> unprocessedItems = itemRepository.findByProcessStatusAndUserIdIn(
                "UNPROCESSED",
                usersWithConfig,
                PageRequest.of(0, BATCH_SIZE)
        );

        if (unprocessedItems.isEmpty()) {
            log.debug("No unprocessed items found for users with AI config");
            return;
        }

        log.info("Found {} unprocessed items for users with AI config, starting analysis", unprocessedItems.size());

        for (InformationItem item : unprocessedItems) {
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
