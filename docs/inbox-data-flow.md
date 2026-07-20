# InfoDigest Inbox 捕获流程与数据更新详细说明

## 1. 系统整体架构

```
+----------------+     HTTP POST      +----------------+     JPA Save      +----------+
|   爬虫 Node.js | ----------------> |   后端 Spring  | ----------------> | MySQL   |
|   (crawler/)   |   /api/inbox/items |   Boot         |   information_    | 数据库   |
+----------------+                    +----------------+   items 表       +----------+
       |                                      |
       | 定时/手动触发                        | REST API
       v                                      v
+----------------+                    +----------------+
| 各平台 API     |                    |   前端 React    |
| (B站/知乎/GitHub|                    |   (Vite)        |
|  /小红书)      |                    +----------------+
+----------------+                            |
                                                | fetch
                                                v
                                         +----------+
                                         | 浏览器   |
                                         | 缓存     |
                                         | (localStorage)
                                         +----------+
```

## 2. 数据持久化说明

**所有捕获的数据都会持久化到 MySQL 数据库中**，不会因为项目重启而丢失。

- 数据库地址：`10.119.3.25`
- 数据库名：`infodigest`
- 核心表：`information_items`（存储所有捕获的信息项）
- 用户配置表：`ai_configs`、`user_platforms` 等

只要数据库不清理、不做 `DELETE` 操作，历史数据会一直保留。

## 3. 完整捕获流程

### 3.1 爬虫抓取数据的触发点（重点）

InfoDigest 的爬虫抓取数据有以下 **5 种触发机制**，请仔细阅读：

---

#### 触发机制 1：后端定时自动抓取（CrawlScheduler）

**触发条件**：项目启动后，**每 5 分钟** 自动执行一次，无需用户操作。

**详细流程**：
1. Spring Boot 启动时，`@EnableScheduling` 启用定时任务
2. `CrawlScheduler` 每 5 分钟执行一次 (`@Scheduled(fixedRate = 300000)`)
3. 遍历所有已注册用户，检查每个用户已连接的平台（查询 `user_platforms` 表）
4. 为每个 `(用户, 平台)` 组合启动独立的爬虫线程
5. 调用 `node crawler/index.js --platform=xxx --auth-token=xxx --user-id=xxx` 启动子进程
6. 爬虫进程有 **2 分钟超时**，超时自动终止

**关键特点**：
- ✅ **自动运行**：项目启动后自动开始，无需用户登录或操作
- ✅ **全平台覆盖**：会抓取用户已连接的所有平台
- ✅ **防重入**：使用 `AtomicBoolean running` 和 `Set<String> activeJobs` 防止并发抓取
- ⚠️ **频率较高**：每 5 分钟抓一次，对平台 API 有一定压力

**代码位置**：`backend/src/main/java/com/infodigest/scheduler/CrawlScheduler.java`

---

#### 触发机制 2：用户连接平台后立即抓取（前端 Settings 页面）

**触发条件**：用户在 Settings 页面**手动连接/授权一个平台**后，系统**自动立即触发**一次该平台的抓取。

**详细流程**：
1. 用户在 Settings 页面点击"连接"按钮
2. 根据平台类型，执行相应的认证流程：
   - **B 站**：显示二维码，用户扫码后后端轮询确认登录状态
   - **知乎**：显示二维码，用户扫码后后端轮询确认登录状态
   - **GitHub**：用户手动输入 Personal Access Token
   - **小红书**：用户手动输入 Cookie（占位）
3. 认证成功后，前端调用 `settingsApi.saveCredential(platform, credential)` 保存凭证
4. **自动触发爬虫**：前端调用 `crawlApi.trigger(platform)`（`POST /api/crawl/trigger?platform=xxx`）
5. 后端 `CrawlController` 生成 JWT Token，启动 `node crawler/index.js --platform=xxx` 子进程
6. 抓取完成后，前端跳转到 Inbox 页面查看结果

**关键特点**：
- ✅ **即时反馈**：连接成功后立即抓取，用户无需等待
- ✅ **单平台**：只抓取用户刚刚连接的那个平台
- ✅ **主动触发**：由用户主动连接平台的行为触发

**代码位置**：
- 前端：`frontend/src/pages/Settings/Settings.jsx`（`handleConnect`、`handleBilibiliLoginSuccess`、`handleZhihuLoginSuccess`）
- 后端：`backend/src/main/java/com/infodigest/controller/CrawlController.java`

**注意**：连接平台时会自动触发抓取，但**不是每次打开 Settings 页面都会触发**，只有在点击"连接"并成功授权后才会触发。

---

#### 触发机制 3：ContentAnalysisScheduler 触发后续分析

**触发条件**：每次 `CrawlScheduler`（或手动）抓取数据后，**每 60 秒** 自动扫描未处理的条目进行 AI 分析。

**详细流程**：
1. `ContentAnalysisScheduler` 每 60 秒执行一次 (`@Scheduled(fixedRate = 60000)`)
2. 查询数据库中 `processStatus = "UNPROCESSED"` 的信息项
3. 对每条未处理的信息项，调用 `ContentAnalysisService.analyzeItem(itemId)`
4. AI 分析包括：
   - 营养成分分析（蛋白质、碳水、维生素等）
   - AI 摘要生成
   - 知识含量评分
   - 自动分类
5. 分析完成后，更新 `aiSummary`、`knowledgeScore`、`category` 等字段

**关键特点**：
- ✅ **自动分析**：抓取新数据后会自动触发 AI 分析
- ✅ **增量处理**：只处理未分析过的条目（`UNPROCESSED` 状态）
- ⚠️ **不是抓取**：这是抓取后的后续处理，不产生新数据，只更新现有数据的 AI 分析结果

---

#### 触发机制 4：命令行手动/轮询抓取

**触发条件**：开发者在命令行手动执行爬虫脚本。

**使用方式**：
```bash
cd crawler

# 单次抓取所有启用平台
node index.js

# 单次抓取指定平台
node index.js --platform=bilibili
node index.js --platform=zhihu

# 轮询模式：抓取一次后，每隔 N 秒自动抓一次
node index.js --poll --interval=3600  # 默认 1 小时
node index.js --poll --interval=1800  # 30 分钟
```

**关键特点**：
- ✅ **手动控制**：开发者可以精确控制抓取时机和平台
- ✅ **独立运行**：不依赖后端定时器，直接调用平台 API
- ✅ **轮询模式**：适合本地开发调试，持续监控数据变化
- ⚠️ **需要配置环境变量**：需要设置 `BILIBILI_COOKIE`、`ZHIHU_COOKIE`、`BACKEND_URL` 等

---

#### 触发机制 5：前端 Inbox 页面轮询刷新

**触发条件**：用户打开 Inbox 页面后，**每 30 秒** 自动刷新一次数据。

**详细流程**：
1. 用户打开 Inbox 页面
2. `useInboxItems` hook 启动 30 秒定时器
3. 每 30 秒调用 `GET /api/inbox/items?page=0&size=1000`
4. 合并缓存后更新前端列表
5. 用户可以看到最新的数据（包括其他平台的抓取结果）

**关键特点**：
- ✅ **实时更新**：用户无需手动刷新，数据自动同步
- ✅ **被动触发**：不产生新数据，只是拉取已存在的数据
- ⚠️ **只读刷新**：不会触发新的爬虫抓取

**特殊场景**：从 Settings 页面跳转到 Inbox 时：
- Settings 会在 `sessionStorage` 中设置 `inbox:shouldRefetch` 标记
- Inbox 检测到标记后，**每 5 秒** 轮询一次后端 API，最多 12 次（60 秒）
- 目的是等待刚触发的爬虫抓取完成并入库

---

### 3.2 触发机制总结对比

| 触发机制 | 触发条件 | 频率 | 产生新数据？ | 触发方 |
|---------|---------|------|------------|--------|
| CrawlScheduler | 项目启动后自动 | 每 5 分钟 | ✅ 是 | 后端定时器 |
| Settings 连接平台 | 用户手动连接平台 | 连接成功后立即 | ✅ 是 | 前端用户操作 |
| ContentAnalysisScheduler | 有未处理条目时 | 每 60 秒 | ❌ 否（仅分析） | 后端定时器 |
| 命令行手动/轮询 | 开发者手动执行 | 手动/自定义 | ✅ 是 | 开发者 |
| Inbox 轮询刷新 | 用户打开 Inbox | 每 30 秒 | ❌ 否（仅刷新） | 前端定时器 |

---

### 3.3 一个完整的用户场景示例

**场景**：新用户首次使用系统，连接 B 站和知乎

1. **用户注册/登录** → 进入 Settings 页面
2. **连接 B 站**：
   - 点击"连接 B 站" → 扫码登录 → 成功
   - **自动触发**：`CrawlController.trigger('bilibili')` → 启动爬虫抓取 B 站历史
   - 前端跳转到 Inbox，显示"正在后台抓取..."
3. **5 秒后**（Inbox 轮询检测）：
   - 发现 B 站数据已入库，Inbox 显示新数据
4. **连接知乎**：
   - 点击"连接知乎" → 扫码登录 → 成功
   - **自动触发**：`CrawlController.trigger('zhihu')` → 启动爬虫抓取知乎推荐
5. **5 秒后**：
   - 发现知乎数据已入库，Inbox 显示新数据
6. **AI 分析**：
   - `ContentAnalysisScheduler` 每 60 秒扫描未处理条目
   - 对新抓取的条目自动生成 AI 摘要、评分、分类
   - 分析完成后，Inbox 的"已生成 AI 摘要"计数自动增加
7. **后续使用**：
   - `CrawlScheduler` 每 5 分钟自动抓取一次，保持数据最新
   - Inbox 每 30 秒自动刷新，显示最新数据

### 3.4 各平台抓取逻辑

#### B 站（crawler/lib/bilibili.js）
1. 验证 Cookie 有效性
2. 分页拉取观看历史（`fetchHistory`），最多 `MAX_ITEMS_PER_RUN` 条
3. 对前 5 条视频提取 CC 字幕：
   - 调用 `fetchVideoInfo` 获取 `cid`
   - 调用 `fetchSubtitleList` 获取字幕列表
   - 调用 `fetchSubtitleText` 获取字幕文本
   - **关键校验**：`isSubtitleRelevant(title, subtitle)` 用 bigram 分词检查字幕是否与标题相关，不相关的字幕**丢弃**
4. 使用 `transformBilibiliItem` 转换为标准格式，`contentRaw` 优先使用字幕，无字幕时使用标题

#### 知乎（crawler/lib/zhihu.js）
1. 验证 Cookie（Playwright 登录）
2. 拉取推荐内容（`fetchRecommendations`）
3. 如果推荐不够，补充收藏夹内容（`fetchCollections`）
4. 对前 5 条提取全文（`fetchContentDetail`）
5. 使用 `transformZhihuItem` 转换，`contentRaw` 使用全文

#### GitHub（crawler/lib/github.js）
1. 使用 GitHub API 拉取用户 Star 的仓库
2. 提取 `description`、`topics`、`readme` 作为内容
3. 使用 `transformGitHubItem` 转换

#### 小红书（待实现）
- 当前为占位实现

### 3.5 写入后端

使用 `batchWriteItems`（crawler/lib/dataWriter.js）批量写入：

1. **认证**：调用 `/api/auth/login` 获取 JWT Token
2. **写入**：对每个转换后的条目调用 `POST /api/inbox/items`
3. **后端去重**：同标题+同平台的条目，只保留最新一条，不重新分析
4. **异步触发 AI 摘要**：新条目保存成功后，`AiSummaryService.generateSummaryAsync` 异步生成摘要

### 3.6 后端入库流程

`InboxController.createInboxItem`:
```java
// 1. 去重检查
Optional<InformationItem> existing = informationItemRepository
    .findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(userId, title, platform);
if (existing.isPresent()) {
    return ResponseEntity.ok(existing.get()); // 返回已存在的，不重复创建
}

// 2. 保存新条目
InformationItem savedItem = informationItemRepository.save(item);

// 3. 异步触发 AI 摘要
aiSummaryService.generateSummaryAsync(savedItem);
```

## 4. 前端数据更新机制

### 4.1 首次加载

`useInboxItems.js` 的 `loadInitial`:

1. **秒现缓存**：先从 `localStorage` 读取缓存，立即显示
2. **后台请求 API**：调用 `GET /api/inbox/items?page=0&size=1000`
3. **合并策略**：
   - API 数据为**权威来源**
   - 缓存仅补充 API 不返回的字段：`note`、`tags`
   - `hasNote`/`isPremium` 以 API 返回为准（修复了之前缓存覆盖 API 的问题）
4. **写入缓存**：合并后的数据写回 `localStorage`

### 4.2 实时更新（轮询）

每 **30 秒** 静默拉取一次最新数据：
- 调用 `GET /api/inbox/items?page=0&size=1000`
- 使用 `mergeWithCache` 合并
- 直接 `setItems(merged)` 替换当前列表
- 更新 `localStorage` 缓存

### 4.3 用户操作更新

| 操作 | 本地更新 | 后端同步 | 缓存更新 |
|------|---------|---------|---------|
| 点击星标（togglePremium） | ✅ 乐观更新 `hasNote`/`isPremium` | ✅ PUT `/api/inbox/{id}` | ✅ 立即写入 |
| 打开抽屉（updateItem opened） | ✅ 更新 `opened` | ✅ PUT `/api/inbox/{id}` | ❌ 下次轮询更新 |
| 保存笔记（saveNote） | ✅ 更新 `note`/`tags`/`hasNote` | ✅ PUT `/api/inbox/{id}` | ✅ 立即写入 |
| 关闭抽屉（handleCloseDrawer） | ✅ 保存 `note`/`tags` | ✅ PUT `/api/inbox/{id}` | ✅ 下次轮询更新 |

## 5. 关键字段说明

| 字段 | 类型 | 说明 | 修改方 |
|------|------|------|--------|
| `id` | Long | 主键 | 系统自动生成 |
| `userId` | Long | 所属用户 | 系统自动设置 |
| `title` | String | 标题 | 爬虫写入，用户可编辑 |
| `url` | String | 原始链接 | 爬虫写入 |
| `platform` | String | 平台（BILIBILI/ZHIHU/GITHUB） | 爬虫写入 |
| `category` | String | 分类（深度知识/娱乐短剧等） | AI 分析生成 |
| `contentRaw` | Text | 原始内容（字幕/正文/README） | 爬虫写入，用户笔记会覆盖 |
| `processStatus` | String | UNPROCESSED/PROCESSED/FAILED | 系统自动更新 |
| `isPremium` | Boolean | 用户标记的优质信息源 | **用户手动标记** |
| `aiSummary` | Text | AI 生成的摘要 | AI 分析生成 |
| `knowledgeScore` | Integer | 知识含量评分 0-100 | AI 分析生成 |
| `analyzedAt` | LocalDateTime | 分析完成时间 | AI 分析生成 |
| `crawledAt` | LocalDateTime | 抓取时间 | 系统自动生成 |

## 6. AI 分析流程

### 6.1 内容分析（营养成分）

`ContentAnalysisScheduler` 定时扫描 `processStatus != PROCESSED` 的条目：

1. 调用 `ContentAnalysisService.analyzeItem(itemId)`
2. 从数据库加载条目和用户 AI 配置
3. 调用 DeepSeek API 进行营养成分分析
4. **局部更新**：仅更新 `nutrition*`、`aiSummary`、`analyzedAt` 字段，**不触碰 `isPremium`**
5. 自动创建概念映射（`ensureConceptMapping`）

### 6.2 AI 摘要生成

`AiSummaryService.generateSummaryAsync`:
1. 调用 DeepSeek API 生成摘要、评分、分类
2. **局部更新**：仅更新 `aiSummary`、`knowledgeScore`、`category` 等字段

## 7. 数据去重机制

### 7.1 后端去重（入库时）

`InboxController.createInboxItem`:
```java
// 同一用户下，同标题+平台已存在则直接跳过
Optional<InformationItem> existing = informationItemRepository
    .findTopByUserIdAndTitleAndPlatformOrderByCrawledAtDesc(userId, title, platform);
if (existing.isPresent()) {
    return ResponseEntity.ok(existing.get()); // 返回已存在的，不重复创建
}
```

### 7.2 前端去重

前端 `loadMore` 时使用追加方式，不进行去重（依赖后端去重）。

## 8. 缓存策略

### 8.1 localStorage 缓存

- Key: `infodigest_inbox_cache_v2`
- 内容：完整的 items 数组（JSON 格式）
- 更新时机：
  - 首次加载 API 返回后
  - togglePremium / saveNote 操作后
  - 每 30 秒轮询后
  - loadMore 追加后

### 8.2 缓存合并规则

```javascript
// API 数据为权威来源
const result = { ...apiItem };

// 仅从缓存补充：note、tags
if (cachedItem.note !== undefined) result.note = cachedItem.note;
if (cachedItem.tags !== undefined) result.tags = cachedItem.tags;

// 注意：hasNote/isPremium 以 API 为准，不再从缓存覆盖
```

## 9. 常见问题

### Q1: 数据会丢失吗？
**不会**。所有数据存储在 MySQL 数据库中，项目重启不会影响数据。只有手动调用删除接口或数据库操作才会删除数据。

### Q2: 什么时候会触发爬虫抓取？
共有 5 种触发机制：

1. **后端定时抓取**：每 5 分钟自动抓取一次，无需用户操作
2. **连接平台后**：用户在 Settings 连接/授权平台后，立即自动触发一次该平台的抓取
3. **AI 分析**：每 60 秒自动分析未处理的条目（这是分析，不是抓取）
4. **命令行手动抓取**：`node index.js` 或 `node index.js --poll`
5. **前端轮询刷新**：每 30 秒刷新界面，不产生新数据

### Q3: 连接平台后一定会触发抓取吗？
**是的**。在 Settings 页面点击"连接"并成功授权后，前端会自动调用 `crawlApi.trigger(platform)`，后端会启动爬虫进程进行抓取。**不是**每次打开 Settings 页面都会触发，只有在主动连接新平台时才会触发。

### Q4: 为什么有时候切换页面再回来，优质信息源标识会消失？
这是之前的一个 bug，已在 `hzy` 分支修复：
- 原因：`mergeWithCache` 错误地让缓存覆盖了 API 返回的 `isPremium`
- 修复：缓存仅补充 `note`/`tags`，`isPremium` 以 API 为准
- 另外：后端 AI 分析使用全量 `save()` 会覆盖用户标记的 `isPremium`，已改为局部更新

### Q5: 为什么 AI 摘要有时候与内容不符？
原因有两个：
1. **B 站字幕关联错误**：早期爬虫可能将其他视频的字幕关联到当前视频
2. **内容为空的条目**：某些条目爬取时未获取到内容，AI 基于空内容或错误内容生成摘要

修复：
- 爬虫增加字幕相关性校验（`isSubtitleRelevant`），不匹配的字幕丢弃
- 后端提供 `/api/dashboard/cleanup-mismatched-content` 接口，清理不匹配的条目并重置 AI 摘要

### Q6: 为什么会有重复卡片？
原因：
1. 爬虫每次抓取都会写入，如果没有去重机制会重复
2. 某些平台（如 B 站）的历史记录可能包含重复条目

修复：
- 后端入库时进行标题+平台去重
- 前端提供 `/api/dashboard/cleanup-duplicates` 和 `/api/dashboard/cleanup-title-duplicates` 接口清理历史重复数据

### Q7: 轮询间隔是多少？
- **后端爬虫调度**：每 5 分钟自动抓取一次
- **后端 AI 分析**：每 60 秒自动分析一次
- **前端数据刷新**：每 30 秒自动拉取一次最新数据
- **Settings 跳转后等待抓取完成**：每 5 秒轮询一次，最多 60 秒

### Q8: 如何手动触发抓取？
方式一：前端界面（推荐）
- Settings -> Platforms 页面，点击"连接"按钮连接平台，连接成功后自动触发抓取

方式二：命令行
```bash
cd crawler
node index.js                    # 抓取所有启用平台
node index.js --platform=bilibili # 只抓 B 站
```

方式三：后端 API
```bash
POST /api/crawl/trigger?platform=bilibili
```

## 10. 数据库表结构核心字段

```sql
-- information_items 表核心字段
CREATE TABLE information_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000),
    platform VARCHAR(50),
    category VARCHAR(100),
    duration_minutes INT,
    content_raw TEXT,
    process_status VARCHAR(50) DEFAULT 'UNPROCESSED',
    is_premium BOOLEAN DEFAULT FALSE,
    knowledge_score INT,
    score_reasoning VARCHAR(500),
    ai_summary TEXT,
    analyzed_at TIMESTAMP,
    crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nutrition_protein INT,
    nutrition_carbs INT,
    nutrition_vitamins INT,
    nutrition_fats INT,
    nutrition_fiber INT,
    nutrition_reasoning TEXT,
    watch_duration_seconds INT,
    completion_rate DOUBLE
);
```

## 11. 接口速查

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/inbox/items` | GET | 获取当前用户的 inbox 列表（分页） |
| `/api/inbox/items/{id}` | GET | 获取单个条目详情 |
| `/api/inbox/items` | POST | 创建新条目（爬虫调用） |
| `/api/inbox/items/{id}` | PUT | 更新条目（前端调用） |
| `/api/inbox/items/{id}` | DELETE | 删除条目 |
| `/api/dashboard/cleanup-duplicates` | POST | 清理重复数据（基于 url+platform） |
| `/api/dashboard/cleanup-title-duplicates` | POST | 清理重复数据（基于 title+platform） |
| `/api/dashboard/cleanup-mismatched-content` | POST | 清理内容不匹配的条目 |
| `/api/dashboard/reset-premium` | POST | 重置所有 isPremium 为 false |
| `/api/crawl/trigger?platform={platform}` | POST | 手动触发爬虫抓取 |
