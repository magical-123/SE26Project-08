-- ============================================================
-- 知识图谱性能测试数据生成脚本
-- 目标: 500+ 节点 + 1000+ 连线
--       250 concepts + 250 information_items (source nodes) = 500 节点
--       每 item 连接 4 个概念 = 1000 条连线
-- 使用: mysql -h 10.119.3.25 -u root -p info_digest < 此文件
-- 注意: 修改下面的 @targetUserId 为你要测试的用户 ID
-- ============================================================

SET @targetUserId = 2;

-- 1. 清理旧测试数据
DELETE FROM item_concepts WHERE item_id IN (SELECT id FROM information_items WHERE user_id = @targetUserId AND title LIKE '[PERF-TEST]%');
DELETE FROM node_positions WHERE user_id = @targetUserId;
DELETE FROM information_items WHERE user_id = @targetUserId AND title LIKE '[PERF-TEST]%';
DELETE FROM concepts WHERE user_id = @targetUserId AND name LIKE 'perf-concept-%';

-- 2. 生成 250 个概念节点
INSERT INTO concepts (user_id, name, label, color, created_at)
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 250
)
SELECT
    @targetUserId,
    CONCAT('perf-concept-', n),
    CONCAT('测试概念节点 #', n),
    ELT(1 + (n % 12),
        '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444',
        '#10B981', '#EC4899', '#6366F1', '#14B8A6',
        '#F97316', '#84CC16', '#06B6D4', '#D946EF'
    ),
    NOW()
FROM numbers;

-- 3. 生成 250 个信息项（来源节点）
INSERT INTO information_items (user_id, title, url, platform, author, duration_minutes, content_raw, ai_summary, knowledge_score, is_premium, process_status, crawled_at)
WITH RECURSIVE numbers AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 250
)
SELECT
    @targetUserId,
    CONCAT('[PERF-TEST] 测试内容 #', n, ' - 这是一篇关于技术架构的长文标题以便测试展示效果'),
    CONCAT('https://example.com/perf-test/', n),
    ELT(1 + (n % 4), 'Bilibili', 'Zhihu', 'YouTube', 'Github'),
    CONCAT('测试作者_', n),
    10 + (n % 50),
    CONCAT('这是性能测试用的原始内容第', n, '篇，包含一些技术讨论和知识点。'),
    CONCAT('AI摘要：这是第', n, '篇内容的AI分析摘要，涵盖了主要观点和技术要点。'),
    50 + (n % 50),
    TRUE,
    'PROCESSED',
    NOW()
FROM numbers;

-- 4. 生成 1000 条连线（每 item 连接 4 个不同的概念，使用取模均匀分布）
INSERT INTO item_concepts (item_id, concept_id, highlighted, confidence, reason)
SELECT
    i.id,
    c.id,
    TRUE,
    0.5 + (RAND() * 0.5),
    ELT(1 + FLOOR(RAND() * 5),
        '该内容深入探讨了相关概念',
        '内容中多次提及该关键词',
        'AI分析发现内容与此概念高度相关',
        '用户标注内容与此领域相关',
        '内容的核心主题与此概念一致'
    )
FROM (
    SELECT id, (@item_rank := @item_rank + 1) AS rn
    FROM information_items, (SELECT @item_rank := 0) v
    WHERE user_id = @targetUserId AND title LIKE '[PERF-TEST]%'
    ORDER BY id
) i
CROSS JOIN (
    SELECT 1 AS slot UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
) slots
JOIN (
    SELECT id, (@concept_rank := @concept_rank + 1) AS rn
    FROM concepts, (SELECT @concept_rank := 0) v
    WHERE user_id = @targetUserId AND name LIKE 'perf-concept-%'
    ORDER BY id
) c ON c.rn = 1 + ((i.rn * 4 + slots.slot - 1) % 250);

-- 5. 统计报告
SELECT '数据生成完成' AS status;
SELECT COUNT(*) AS concept_count FROM concepts WHERE user_id = @targetUserId AND name LIKE 'perf-concept-%';
SELECT COUNT(*) AS item_count FROM information_items WHERE user_id = @targetUserId AND title LIKE '[PERF-TEST]%';
SELECT COUNT(*) AS edge_count FROM item_concepts ic
JOIN information_items ii ON ic.item_id = ii.id
WHERE ii.user_id = @targetUserId AND ii.title LIKE '[PERF-TEST]%';
