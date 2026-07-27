package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "concepts")
@Data
@NoArgsConstructor
public class Concept {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String name; // e.g. "frontend-arch"

    @Column(nullable = false)
    private String label; // e.g. "前端架构演进"

    @Column(nullable = false)
    private String color; // e.g. "#0EA5E9"

    private Double posX;

    private Double posY;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
