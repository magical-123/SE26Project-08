package com.infodigest.service;

import com.infodigest.entity.InformationItem;

/** Single source of truth for real user viewing duration. */
public final class DurationMetrics {
    private DurationMetrics() {}

    /**
     * 获取有效观看/阅读时长（秒）
     * 优先使用实际观看时长，回退到视频总时长/文章阅读时长
     * 如果文章还没有计算阅读时长，尝试即时计算
     */
    public static double effectiveSeconds(InformationItem item) {
        if (item == null) return 0;

        // 优先使用实际观看时长
        if (item.getWatchDurationSeconds() != null && item.getWatchDurationSeconds() > 0) {
            return item.getWatchDurationSeconds();
        }

        // 回退到视频总时长/文章阅读时长（转换为秒）
        if (item.getDurationMinutes() != null && item.getDurationMinutes() > 0) {
            return item.getDurationMinutes() * 60.0;
        }

        // 冗余计算：如果文本平台还没有阅读时长，即时计算（但不保存到数据库）
        Integer calculatedDuration = ReadingDurationCalculator.calculateReadingDuration(item);
        if (calculatedDuration != null && calculatedDuration > 0) {
            return calculatedDuration * 60.0;
        }

        return 0;
    }
}
