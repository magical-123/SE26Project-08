package com.infodigest.service;

import com.infodigest.entity.InformationItem;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ReadingDurationCalculatorTest {

    @Test
    void returnsNullForNullItem() {
        assertNull(ReadingDurationCalculator.calculateReadingDuration(null));
    }

    @Test
    void returnsNullForNonGitHubPlatform() {
        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setContentRaw("Some content here");
        assertNull(ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void returnsNullForNullPlatform() {
        InformationItem item = new InformationItem();
        item.setContentRaw("Some content");
        assertNull(ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void returnsNullForEmptyContent() {
        InformationItem item = new InformationItem();
        item.setPlatform("GITHUB");
        item.setContentRaw("");
        assertNull(ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void calculatesDurationForGitHubContent() {
        InformationItem item = new InformationItem();
        item.setPlatform("GITHUB");
        // 350 chars = 1 minute (350/350)
        String content = "a".repeat(350);
        item.setContentRaw(content);
        assertEquals(1, ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void calculatesDurationRoundingUp() {
        InformationItem item = new InformationItem();
        item.setPlatform("GITHUB");
        // 351 chars -> ceil(351/350) = 2 minutes
        String content = "a".repeat(351);
        item.setContentRaw(content);
        assertEquals(2, ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void returnsAtLeastOneMinute() {
        InformationItem item = new InformationItem();
        item.setPlatform("GITHUB");
        item.setContentRaw("Short content");
        assertEquals(1, ReadingDurationCalculator.calculateReadingDuration(item));
    }

    @Test
    void ensureDurationMinutesReturnsFalseForNullItem() {
        assertFalse(ReadingDurationCalculator.ensureDurationMinutes(null));
    }

    @Test
    void ensureDurationMinutesReturnsFalseWhenDurationAlreadySet() {
        InformationItem item = new InformationItem();
        item.setDurationMinutes(10);
        assertFalse(ReadingDurationCalculator.ensureDurationMinutes(item));
    }

    @Test
    void ensureDurationMinutesSetsDurationForGitHub() {
        InformationItem item = new InformationItem();
        item.setPlatform("GITHUB");
        item.setContentRaw("a".repeat(700));
        assertTrue(ReadingDurationCalculator.ensureDurationMinutes(item));
        assertEquals(2, item.getDurationMinutes());
    }

    @Test
    void ensureDurationMinutesReturnsFalseForNonGitHub() {
        InformationItem item = new InformationItem();
        item.setPlatform("BILIBILI");
        item.setContentRaw("Some content");
        assertFalse(ReadingDurationCalculator.ensureDurationMinutes(item));
    }

    @Test
    void isCaseInsensitiveForGitHub() {
        InformationItem item = new InformationItem();
        item.setPlatform("github");
        item.setContentRaw("a".repeat(350));
        assertEquals(1, ReadingDurationCalculator.calculateReadingDuration(item));
    }
}
