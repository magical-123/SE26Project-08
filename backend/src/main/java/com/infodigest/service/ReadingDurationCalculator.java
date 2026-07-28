package com.infodigest.service;

import com.infodigest.entity.InformationItem;

/**
 * 文章阅读时长计算工具
 * 根据字数折算阅读时长，仅用于 GitHub 等无法获取实际阅读时长的平台
 * 注意：知乎、小红书、B站等平台由浏览器插件直接上报时长，不需要计算
 */
public final class ReadingDurationCalculator {
    private ReadingDurationCalculator() {}

    /**
     * 计算文章阅读时长（分钟）
     *
     * @param item 信息项
     * @return 阅读时长（分钟），如果不适用则返回 null
     */
    public static Integer calculateReadingDuration(InformationItem item) {
        if (item == null) {
            return null;
        }

        String platform = item.getPlatform();
        String content = item.getContentRaw();

        // 只为 GitHub 等无法获取实际阅读时长的文本平台计算阅读时长
        if (platform == null || content == null || content.isEmpty()) {
            return null;
        }

        // 仅 GitHub 需要字数转时长（技术文档，阅读速度 350字/分钟）
        if ("GITHUB".equalsIgnoreCase(platform)) {
            int wordCount = content.length();
            int wordsPerMinute = 350;

            // 至少1分钟
            return Math.max(1, (int) Math.ceil((double) wordCount / wordsPerMinute));
        }

        return null;
    }

    /**
     * 确保 item 有有效的 duration_minutes，如果没有则计算并更新
     *
     * @param item 信息项
     * @return 是否计算并更新了时长
     */
    public static boolean ensureDurationMinutes(InformationItem item) {
        if (item == null) {
            return false;
        }

        // 如果已经有时长，不需要计算
        if (item.getDurationMinutes() != null && item.getDurationMinutes() > 0) {
            return false;
        }

        // 计算阅读时长
        Integer duration = calculateReadingDuration(item);
        if (duration != null && duration > 0) {
            item.setDurationMinutes(duration);
            return true;
        }

        return false;
    }
}
