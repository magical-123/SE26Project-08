-- 用户词云数据表
CREATE TABLE IF NOT EXISTS user_word_cloud (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    report_date DATE NOT NULL,
    keywords JSON NOT NULL COMMENT '关键词数据: [{"word": "关键词", "value": 权重, "relatedVideos": [视频ID列表]}]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, report_date),
    INDEX idx_user_id (user_id),
    INDEX idx_report_date (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户每日关注点词云数据';
