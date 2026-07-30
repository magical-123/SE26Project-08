-- 检查各个表中是否有按用户ID存储的数据

-- 1. 检查用户表
SELECT id, username, email, created_at FROM users;

-- 2. 检查信息项（视频数据）是否按用户存储
SELECT user_id, COUNT(*) as count,
       SUM(CASE WHEN process_status = 'PROCESSED' THEN 1 ELSE 0 END) as processed_count
FROM information_items
GROUP BY user_id;

-- 3. 检查词云数据是否按用户存储
SELECT user_id, report_date, COUNT(*) as count
FROM user_word_cloud
GROUP BY user_id, report_date
ORDER BY user_id, report_date DESC;

-- 4. 检查话题聚类是否按用户存储
SELECT user_id, report_date, COUNT(*) as count
FROM user_topic_clusters
GROUP BY user_id, report_date
ORDER BY user_id, report_date DESC;

-- 5. 检查AI洞察报告是否按用户存储
SELECT user_id, type, report_date, version, insight_title
FROM user_reports
ORDER BY user_id, report_date DESC, version DESC;

-- 6. 检查复习卡片是否按用户存储
SELECT user_id, COUNT(*) as count,
       SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count
FROM review_cards
GROUP BY user_id;

-- 7. 检查特定用户的数据示例（假设有user_id=1和user_id=2）
SELECT
    'user_1_items' as data_type,
    COUNT(*) as count
FROM information_items WHERE user_id = 1
UNION ALL
SELECT
    'user_2_items',
    COUNT(*)
FROM information_items WHERE user_id = 2;
