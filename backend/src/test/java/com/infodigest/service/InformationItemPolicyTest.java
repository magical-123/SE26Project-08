package com.infodigest.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class InformationItemPolicyTest {
    @Test
    void acceptsNormalTitle() {
        assertTrue(InformationItemPolicy.isValidTitle("如何学习结构化思维"));
    }

    @Test
    void rejectsBlankAndMetadataTitles() {
        assertFalse(InformationItemPolicy.isValidTitle(null));
        assertFalse(InformationItemPolicy.isValidTitle("   "));
        assertFalse(InformationItemPolicy.isValidTitle("发布于 2026-07-27"));
        assertFalse(InformationItemPolicy.isValidTitle("??2026-07-20 12:11"));
    }
}
