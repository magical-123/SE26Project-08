package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_platforms", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "platform"})
})
@Data
@NoArgsConstructor
public class UserPlatform {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 50)
    private String platform; // BILIBILI, ZHIHU, GITHUB

    @Column(columnDefinition = "text")
    private String credential; // Cookie 或 Token（AES-GCM 加密后存储）

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
