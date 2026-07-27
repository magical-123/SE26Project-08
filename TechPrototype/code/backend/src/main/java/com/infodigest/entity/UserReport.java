package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_reports")
@Data
@NoArgsConstructor
public class UserReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportType type; // DAILY or WEEKLY

    @Column(nullable = false)
    private LocalDate reportDate; // 日报：当天日期；周报：周一日期

    // JSON format: {"protein": 30, "carbs": 25, "vitamins": 20, "fats": 15, "fiber": 10}
    @Column(columnDefinition = "json")
    private String nutritionData;

    private String insightTitle;

    @Column(columnDefinition = "text")
    private String insightSummary; // AI 生成的洞察摘要

    @Column(columnDefinition = "text")
    private String insightFullText; // AI 生成的完整洞察

    // JSON format: [{"word": "React", "weight": 100}, {"word": "LLM", "weight": 80}]
    @Column(columnDefinition = "json")
    private String wordCloudData;

    @Column(nullable = false)
    private LocalDateTime createdAt; // 报告生成时间

    @Column
    private LocalDateTime updatedAt; // 报告更新时间（重新生成）

    @Column(nullable = false)
    private Integer version; // 版本号，用于追踪重新生成次数

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (version == null) {
            version = 1;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
