package com.infodigest.scheduler;

import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.QuoteExtractRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 数据保留定时清理任务
 * <p>
 * 每天凌晨 3:00 执行一次，清理超过 14 天且未标记为优质信息源（isPremium）的条目。
 * 同时清理这些条目对应的金句（quote_extracts）。
 */
@Component
@Slf4j
public class DataRetentionScheduler {

    /** 保留天数 */
    private static final int RETENTION_DAYS = 14;

    @Autowired
    private InformationItemRepository itemRepository;

    @Autowired
    private QuoteExtractRepository quoteExtractRepository;

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanExpiredItems() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        log.info("[数据保留] 开始清理 {} 天前的非优质信息源数据（截止时间: {}）", RETENTION_DAYS, cutoff);

        List<Long> expiredIds = itemRepository.findExpiredNonPremiumItemIds(cutoff);
        if (expiredIds.isEmpty()) {
            log.info("[数据保留] 没有需要清理的数据");
            return;
        }

        // 先清理关联的金句
        quoteExtractRepository.deleteByItemIdIn(expiredIds);
        log.info("[数据保留] 已清理关联金句");

        // 批量删除过期条目
        itemRepository.deleteAllByIdInBatch(expiredIds);

        log.info("[数据保留] 清理完成: 共删除 {} 条过期条目（保留 {} 条优质信息源）",
                expiredIds.size(), itemRepository.countByIsPremiumTrue());
    }
}
