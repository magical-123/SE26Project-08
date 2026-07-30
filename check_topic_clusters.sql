-- 查询zsz2用户的ID
SELECT id, username FROM user WHERE username = 'zsz2';

-- 查询zsz2用户的所有话题聚类数据
SELECT 
    id, 
    user_id, 
    report_date, 
    LEFT(clusters, 100) as clusters_preview,
    created_at,
    updated_at
FROM user_topic_clusters 
WHERE user_id = (SELECT id FROM user WHERE username = 'zsz2')
ORDER BY report_date DESC;

-- 查询今天的日期
SELECT CURDATE() as today;

-- 查询本周周一的日期
SELECT DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) as this_monday;

-- 查询zsz2用户今天是否有话题聚类
SELECT 
    report_date, 
    LEFT(clusters, 100) as clusters_preview
FROM user_topic_clusters 
WHERE user_id = (SELECT id FROM user WHERE username = 'zsz2')
  AND report_date = CURDATE();

-- 查询zsz2用户本周是否有话题聚类（周一作为key）
SELECT 
    report_date, 
    LEFT(clusters, 100) as clusters_preview
FROM user_topic_clusters 
WHERE user_id = (SELECT id FROM user WHERE username = 'zsz2')
  AND report_date = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
