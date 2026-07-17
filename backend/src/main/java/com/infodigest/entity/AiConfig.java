package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ai_configs")
@Data
@NoArgsConstructor
public class AIConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String modelType; // GPT_4, GPT_4_TURBO, GPT_3_5_TURBO, CLAUDE_3_OPUS, etc.

    @Column(length = 500)
    private String apiKey;

    @Column(length = 500)
    private String apiEndpoint;

    private Integer maxTokens;

    // For custom models
    @Column(length = 100)
    private String customModelName;
}
