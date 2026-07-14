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
    private String processStatus = "UNPROCESSED"; // UNPROCESSED, PROCESSED

    @Column(nullable = false, updatable = false)
    private LocalDateTime crawledAt = LocalDateTime.now();
}
