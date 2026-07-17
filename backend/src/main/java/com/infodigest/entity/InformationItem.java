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

    // AI 分析相关字段
    private Integer knowledgeScore; // 知识含量评分(0-100)

    @Column(length = 500)
    private String scoreReasoning; // 评分理由

    @Column(columnDefinition = "text")
    private String aiSummary; // AI生成的内容摘要

    private LocalDateTime analyzedAt; // 分析完成时间

    @Column(nullable = false, updatable = false)
    private LocalDateTime crawledAt = LocalDateTime.now();

    // hasNote: 前端用于判断是否已处理/标记优质，数据库无独立字段，通过 processStatus 推断
    public Boolean getHasNote() {
        return "PROCESSED".equals(this.processStatus);
    }

    // AI 分析结果字段 - 营养成分评估
    private Integer nutritionProtein;      // 蛋白质：深度认知与硬核知识
    private Integer nutritionCarbs;        // 碳水化合物：实用技能与行业快讯
    private Integer nutritionVitamins;     // 维生素：创意灵感与美学体验
    private Integer nutritionFats;         // 脂肪与糖分：纯娱乐与情绪多巴胺
    private Integer nutritionFiber;        // 膳食纤维：哲思与心理复原力

    @Column(length = 1000)
    private String nutritionReasoning;     // 营养成分分析理由

    // 用户行为数据字段
    private Integer watchDurationSeconds;  // 实际观看时长（秒）
    private Double completionRate;         // 完播率（0.0-1.0）
}
