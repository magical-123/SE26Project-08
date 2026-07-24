package com.infodigest.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Visibility defaultVisibility = Visibility.PUBLIC;

    // MySQL 8+ JSON column for hidden platforms (e.g. ["娱乐短剧", "微博"])
    @Column(columnDefinition = "json")
    private String hiddenPlatforms;

    @Column(columnDefinition = "longtext")
    private String avatarUrl;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    /** 最近一次活跃时间，用于判断在线状态 */
    private LocalDateTime lastActiveAt;

    /** 用户自画像：用户对自身需求、兴趣、价值观的描述，辅助 AI 进行信息价值判断 */
    @Column(columnDefinition = "longtext")
    private String selfPortrait;
}
