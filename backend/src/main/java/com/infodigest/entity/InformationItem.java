package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "information_items")
@Data
@NoArgsConstructor
public class InformationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String url;

    private String platform; // Bilibili, Zhihu, etc.

    private String category; // 深度知识, 娱乐短剧, etc.

    private Integer durationMinutes;

    @Column(columnDefinition = "text")
    private String contentRaw;

    @Column(nullable = false)
    private String processStatus = "UNPROCESSED"; // UNPROCESSED, PROCESSED, FAILED

    @Column(nullable = false, updatable = false)
    private LocalDateTime crawledAt = LocalDateTime.now();

    // AI 分析结果字段 - 营养成分评估
    private Integer nutritionProtein;      // 蛋白质：深度认知与硬核知识
    private Integer nutritionCarbs;        // 碳水化合物：实用技能与行业快讯
    private Integer nutritionVitamins;     // 维生素：创意灵感与美学体验
    private Integer nutritionFats;         // 脂肪与糖分：纯娱乐与情绪多巴胺
    private Integer nutritionFiber;        // 膳食纤维：哲思与心理复原力

    @Column(length = 1000)
    private String nutritionReasoning;     // 营养成分分析理由

    @Column(columnDefinition = "text")
    private String aiSummary;

    private LocalDateTime analyzedAt;
}
