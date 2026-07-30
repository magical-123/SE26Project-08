package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 用户话题聚类数据实体
 */
@Entity
@Table(name = "user_topic_clusters")
@Data
public class UserTopicCluster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    /**
     * 报告日期（日报的日期，如 2024-03-15）
     */
    @Column(nullable = false)
    private LocalDate reportDate;

    /**
     * 报告类型（daily=日报, weekly=周报）
     */
    @Column(nullable = false, length = 10)
    private String reportType;

    /**
     * 话题聚类 JSON 数据
     * 格式：[{"name": "话题名", "count": 5, "tags": ["标签1"], "videoIds": [1,2,3]}]
     */
    @Column(columnDefinition = "TEXT")
    private String clusters;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
