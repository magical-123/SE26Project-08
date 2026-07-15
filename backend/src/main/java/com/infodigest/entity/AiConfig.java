package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "ai_configs")
@Data
@NoArgsConstructor
public class AiConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String modelType;

    @Column(length = 500)
    private String apiKey;

    @Column(length = 500)
    private String apiEndpoint;

    private Integer maxTokens;

    @Column(length = 100)
    private String customModelName;
}
