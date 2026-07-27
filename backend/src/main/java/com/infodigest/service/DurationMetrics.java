package com.infodigest.service;

import com.infodigest.entity.InformationItem;

/** Single source of truth for real user viewing duration. */
public final class DurationMetrics {
    private DurationMetrics() {}

    public static double effectiveSeconds(InformationItem item) {
        if (item == null || item.getWatchDurationSeconds() == null) return 0;
        return Math.max(0, item.getWatchDurationSeconds());
    }
}
