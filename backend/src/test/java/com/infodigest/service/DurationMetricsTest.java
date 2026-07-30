package com.infodigest.service;

import com.infodigest.entity.InformationItem;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DurationMetricsTest {
    @Test
    void prefersRealWatchDurationAndFallsBackToDurationMinutes() {
        InformationItem item = new InformationItem();
        item.setDurationMinutes(30);
        assertEquals(1800, DurationMetrics.effectiveSeconds(item));

        item.setWatchDurationSeconds(125);
        assertEquals(125, DurationMetrics.effectiveSeconds(item));
    }

    @Test
    void ignoresNegativeDuration() {
        InformationItem item = new InformationItem();
        item.setWatchDurationSeconds(-1);
        assertEquals(0, DurationMetrics.effectiveSeconds(item));
    }
}
