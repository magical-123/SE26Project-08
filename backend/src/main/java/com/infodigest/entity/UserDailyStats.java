package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

/**
 * 用户每日统计数据（用于加速 Dashboard 加载）
 *
 * 存储每日的累计浏览时长和营养成分占比，避免每次都查询全部历史数据
 */
@Entity
@Table(name = "user_daily_stats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "stat_date"}))
@Data
public class UserDailyStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "stat_date", nullable = false)
    private LocalDate statDate;

    // 当日浏览总秒数
    @Column(name = "total_seconds")
    private Double totalSeconds = 0.0;

    // 当日各营养成分的加权秒数
    @Column(name = "protein_seconds")
    private Double proteinSeconds = 0.0;

    @Column(name = "carbs_seconds")
    private Double carbsSeconds = 0.0;

    @Column(name = "vitamins_seconds")
    private Double vitaminsSeconds = 0.0;

    @Column(name = "fats_seconds")
    private Double fatsSeconds = 0.0;

    @Column(name = "fiber_seconds")
    private Double fiberSeconds = 0.0;

    // 当日已分析条目数
    @Column(name = "analyzed_count")
    private Integer analyzedCount = 0;
}
