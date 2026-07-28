package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * AI 在分析内容时从视频/文章中提取的金句
 */
@Entity
@Table(name = "quote_extracts")
@Data
@NoArgsConstructor
public class QuoteExtract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long itemId; // 关联 information_items

    @Column(columnDefinition = "text", nullable = false)
    private String content; // 金句原文

    @Column(length = 500)
    private String reason;  // 为什么是金句（AI 给出的理由）

    @Column(length = 500)
    private String sourceTitle; // 来源标题

    private String sourceUrl;   // 来源链接

    private String sourcePlatform; // 来源平台

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
