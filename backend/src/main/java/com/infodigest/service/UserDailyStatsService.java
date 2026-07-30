package com.infodigest.service;

import com.infodigest.entity.InformationItem;
import com.infodigest.entity.UserDailyStats;
import com.infodigest.repository.InformationItemRepository;
import com.infodigest.repository.UserDailyStatsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 用户每日统计服务
 *
 * 用于增量维护每日浏览时长和营养成分数据，加速 Dashboard 查询
 */
@Service
@Slf4j
public class UserDailyStatsService {

    @Autowired
    private UserDailyStatsRepository statsRepository;

    @Autowired
    private InformationItemRepository itemRepository;

    /**
     * 更新用户指定日期的统计数据
     * 当有新的 item 被分析完成时调用
     */
    @Transactional
    public void updateDailyStats(Long userId, InformationItem item) {
        if (item.getCrawledAt() == null) {
            log.warn("Item {} has no crawledAt date, skipping stats update", item.getId());
            return;
        }

        LocalDate itemDate = item.getCrawledAt().toLocalDate();

        // 查找或创建该日期的统计记录
        UserDailyStats stats = statsRepository.findByUserIdAndStatDate(userId, itemDate)
                .orElseGet(() -> {
                    UserDailyStats newStats = new UserDailyStats();
                    newStats.setUserId(userId);
                    newStats.setStatDate(itemDate);
                    return newStats;
                });

        // 计算该 item 的有效时长
        double itemSeconds = DurationMetrics.effectiveSeconds(item);

        // 累加总时长
        stats.setTotalSeconds(stats.getTotalSeconds() + itemSeconds);

        // 累加各营养成分的加权时长
        if (item.getNutritionProtein() != null) {
            stats.setProteinSeconds(stats.getProteinSeconds() + itemSeconds * (item.getNutritionProtein() / 100.0));
        }
        if (item.getNutritionCarbs() != null) {
            stats.setCarbsSeconds(stats.getCarbsSeconds() + itemSeconds * (item.getNutritionCarbs() / 100.0));
        }
        if (item.getNutritionVitamins() != null) {
            stats.setVitaminsSeconds(stats.getVitaminsSeconds() + itemSeconds * (item.getNutritionVitamins() / 100.0));
        }
        if (item.getNutritionFats() != null) {
            stats.setFatsSeconds(stats.getFatsSeconds() + itemSeconds * (item.getNutritionFats() / 100.0));
        }
        if (item.getNutritionFiber() != null) {
            stats.setFiberSeconds(stats.getFiberSeconds() + itemSeconds * (item.getNutritionFiber() / 100.0));
        }

        // 累加分析数量
        stats.setAnalyzedCount(stats.getAnalyzedCount() + 1);

        statsRepository.save(stats);
        log.debug("Updated daily stats for user {} on {}: +{}s", userId, itemDate, itemSeconds);
    }

    /**
     * 获取用户所有历史数据的累计统计（不包括今日）
     */
    public HistoricalStats getHistoricalStats(Long userId, LocalDate today) {
        Object[] result = statsRepository.getHistoricalSums(userId, today);

        log.info("[UserDailyStatsService] getHistoricalStats: userId={}, today={}, resultType={}, resultLength={}",
                 userId, today,
                 result != null ? result.getClass().getName() : "null",
                 result != null ? result.length : 0);

        if (result == null) {
            log.warn("[UserDailyStatsService] Result is null, returning empty");
            return new HistoricalStats();
        }

        // 检查是否是嵌套数组
        if (result.length > 0 && result[0] != null && result[0].getClass().isArray()) {
            log.info("[UserDailyStatsService] Detected nested array, unwrapping...");
            result = (Object[]) result[0];
        }

        if (result.length < 6) {
            log.warn("[UserDailyStatsService] Result length < 6, returning empty. Length={}", result.length);
            return new HistoricalStats();
        }

        HistoricalStats stats = new HistoricalStats();
        stats.totalSeconds = result[0] != null ? ((Number) result[0]).doubleValue() : 0.0;
        stats.proteinSeconds = result[1] != null ? ((Number) result[1]).doubleValue() : 0.0;
        stats.carbsSeconds = result[2] != null ? ((Number) result[2]).doubleValue() : 0.0;
        stats.vitaminsSeconds = result[3] != null ? ((Number) result[3]).doubleValue() : 0.0;
        stats.fatsSeconds = result[4] != null ? ((Number) result[4]).doubleValue() : 0.0;
        stats.fiberSeconds = result[5] != null ? ((Number) result[5]).doubleValue() : 0.0;

        log.info("[UserDailyStatsService] Historical stats loaded: total={}s, protein={}s",
                 stats.totalSeconds, stats.proteinSeconds);

        return stats;
    }

    /**
     * 重建用户所有历史统计数据（用于迁移或修复）
     */
    @Transactional
    public void rebuildAllStats(Long userId) {
        log.info("Rebuilding all stats for user {}", userId);

        // 清空现有统计
        List<UserDailyStats> existingStats = statsRepository.findByUserId(userId);
        if (!existingStats.isEmpty()) {
            statsRepository.deleteAll(existingStats);
            log.info("Deleted {} existing stats records", existingStats.size());
        }

        // 查询所有已分析的 items
        List<InformationItem> analyzedItems = itemRepository.findByUserIdAndProcessStatus(userId, "PROCESSED");
        log.info("Found {} analyzed items for user {}", analyzedItems.size(), userId);

        // 按日期分组并重建统计
        for (InformationItem item : analyzedItems) {
            if (item.getCrawledAt() != null) {
                updateDailyStats(userId, item);
            }
        }

        log.info("Rebuild completed for user {}", userId);
    }

    public static class HistoricalStats {
        public double totalSeconds = 0.0;
        public double proteinSeconds = 0.0;
        public double carbsSeconds = 0.0;
        public double vitaminsSeconds = 0.0;
        public double fatsSeconds = 0.0;
        public double fiberSeconds = 0.0;
    }
}
