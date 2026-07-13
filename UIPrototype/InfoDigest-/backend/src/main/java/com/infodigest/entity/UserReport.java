package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

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
    private ReportType type;

    @Column(nullable = false)
    private LocalDate reportDate;

    // JSON format: {"deep": 60, "entertainment": 10, "industry": 20, "creative": 10}
    @Column(columnDefinition = "json")
    private String nutritionData;

    private String insightTitle;

    @Column(length = 500)
    private String insightSummary;

    @Column(columnDefinition = "text")
    private String insightFullText;

    // JSON format: [{"word": "React", "weight": 100}, {"word": "LLM", "weight": 80}]
    @Column(columnDefinition = "json")
    private String wordCloudData;
}
