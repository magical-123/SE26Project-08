package com.infodigest.scheduler;

import com.infodigest.entity.InformationItem;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.service.ContentAnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
public class ContentAnalysisScheduler {

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private ContentAnalysisService analysisService;

    private static final int BATCH_SIZE = 10;

    @Scheduled(fixedRate = 60000)
    public void scanAndAnalyzeItems() {
        log.debug("Starting scheduled content analysis scan");

        List<InformationItem> unprocessedItems = itemRepository.findByProcessStatus(
                "UNPROCESSED",
                PageRequest.of(0, BATCH_SIZE)
        );

        if (unprocessedItems.isEmpty()) {
            log.debug("No unprocessed items found");
            return;
        }

        log.info("Found {} unprocessed items, starting analysis", unprocessedItems.size());

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
