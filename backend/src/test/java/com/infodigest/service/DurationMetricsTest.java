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

    @Test
    void usesDurationMinutesWhenNoWatchDurationSeconds() {
        InformationItem item = new InformationItem();
        item.setDurationMinutes(5);
        assertEquals(300.0, DurationMetrics.effectiveSeconds(item), 0.001);
    }

    @Test
    void handlesZeroValuesCorrectly() {
        InformationItem item = new InformationItem();
        item.setWatchDurationSeconds(0);
        item.setDurationMinutes(0);
        assertEquals(0, DurationMetrics.effectiveSeconds(item));
    }

    @Test
    void prefersWatchDurationOverDurationMinutes() {
        InformationItem item = new InformationItem();
        item.setWatchDurationSeconds(200);
        item.setDurationMinutes(10);
        assertEquals(200, DurationMetrics.effectiveSeconds(item));
    }

    @Test
    void returnsZeroForNullItem() {
        assertEquals(0, DurationMetrics.effectiveSeconds(null));
    }
}
