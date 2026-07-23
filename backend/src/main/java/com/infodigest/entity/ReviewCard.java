package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "review_cards")
@Data
@NoArgsConstructor
public class ReviewCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    private String sourcePlatform;

    @Column(nullable = false)
    private LocalDate scheduledReviewDate;

    // Fields for Spaced Repetition System (SM-2)
    @Column(nullable = false)
    private Integer repetitionCount = 0;

    @Column(nullable = false)
    private Double easinessFactor = 2.5;

    @Column(nullable = false)
    private Integer intervalDays = 0;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
