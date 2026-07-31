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

    @Test
    void rejectsTitlesThatAreJustDates() {
        assertFalse(InformationItemPolicy.isValidTitle("??2026-07-20"));
        assertFalse(InformationItemPolicy.isValidTitle("？？2025年12月"));
        assertFalse(InformationItemPolicy.isValidTitle("?? 2026-01-15"));
    }

    @Test
    void rejectsVeryShortMetadataTitles() {
        assertFalse(InformationItemPolicy.isValidTitle("??2026-07"));
        assertTrue(InformationItemPolicy.isValidTitle("？？2025"));
    }

    @Test
    void acceptsTitlesWithChineseCharacters() {
        assertTrue(InformationItemPolicy.isValidTitle("深度学习入门指南"));
        assertTrue(InformationItemPolicy.isValidTitle("如何用 Python 进行数据分析"));
        assertTrue(InformationItemPolicy.isValidTitle("React 18 新特性详解"));
        assertTrue(InformationItemPolicy.isValidTitle("Go 语言并发编程实战"));
    }

    @Test
    void rejectsVariousMetadataPrefixes() {
        assertFalse(InformationItemPolicy.isValidTitle("发表于 2026-01-01"));
        assertFalse(InformationItemPolicy.isValidTitle("编辑于 2026-01-01"));
        assertFalse(InformationItemPolicy.isValidTitle("更新于 2026-01-01"));
        assertFalse(InformationItemPolicy.isValidTitle("浏览于 2026-01-01"));
        assertFalse(InformationItemPolicy.isValidTitle("赞于 2026-01-01"));
        assertFalse(InformationItemPolicy.isValidTitle("收藏于 2026-01-01"));
    }
}
