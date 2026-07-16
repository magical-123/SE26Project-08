# InfoDigest

> 帮助用户进行「信息消化与知识提炼」的数字饮食操作系统。

InfoDigest 是一款面向碎片化信息时代的信息管理工具，通过收集、整理、分析与可视化，帮助用户把日常浏览的信息转化为可持续积累的结构化知识资产。

## 项目简介

在短视频、播客、文章、资讯充斥的日常中，用户每天摄入大量信息却难以沉淀。InfoDigest 提供了一整套信息处理工作流：

- **信息收集**：通过多平台爬虫自动抓取 B站、知乎、GitHub、小红书的内容，统一汇入 Inbox
- **智能分类**：自动/手动对信息打标签、分类，区分深度知识、行业资讯、实用技巧、娱乐科普等
- **数字饮食报告**：统计每日/每周信息摄入结构，帮助用户了解自己的「信息饮食结构」
- **知识图谱**：把已整理的信息可视化为动态知识星系，直观呈现知识之间的关联
- **复习机制**：基于记忆曲线提醒用户复习核心知识点

## 技术栈

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Java | 17 | 运行环境 |
| Spring Boot | 3.2.3 | 核心框架 |
| Spring Data JPA | - | 数据持久化 |
| Spring Security | - | 认证与授权 |
| MySQL | 8.x | 关系型数据库 |
| JJWT | 0.12.5 | JWT Token 生成与校验 |
| Lombok | 1.18.36 | 减少样板代码 |
| Maven | - | 构建工具 |

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.2.7 | UI 框架 |
| Vite | 8.1.1 | 构建工具 |
| React Router | 7.18.1 | 前端路由 |
| AntV G6 | 5.1.1 | 知识图谱可视化 |
| ECharts | 6.1.0 | 数据图表与词云 |
| Framer Motion | 12.42.2 | 动画与交互 |
| Lucide React | 1.23.0 | 图标库 |

### 爬虫

| 技术 | 说明 |
|------|------|
| Node.js | 爬虫运行环境 |
| Playwright | 浏览器自动化（知乎、小红书） |
| axios | HTTP 请求（B站、GitHub） |
| 插件架构 | 各平台独立模块，统一调度 |

## 项目结构

```
InfoDigest-
├── backend/                   # Spring Boot 后端
│   ├── src/main/java/com/infodigest/
│   │   ├── config/            # 安全配置、跨域配置
│   │   ├── controller/        # RESTful API 接口
│   │   ├── dto/               # 数据传输对象
│   │   ├── entity/            # 数据实体
│   │   ├── repository/        # JPA 数据访问层
│   │   ├── scheduler/         # 定时任务（爬虫自动调度）
│   │   ├── security/          # JWT 认证过滤器
│   │   └── service/           # 业务逻辑与用户服务
│   └── src/main/resources/
│       └── application.yml    # 数据库等配置
├── frontend/                  # React + Vite 前端
│   ├── src/
│   │   ├── components/        # 通用组件（GlassCard、CommandPalette 等）
│   │   ├── pages/             # 页面（Dashboard、Inbox、Settings 等）
│   │   ├── hooks/             # 自定义 React Hooks
│   │   ├── layouts/           # 布局组件
│   │   ├── mock/              # 前端 Mock 数据
│   │   └── utils/             # 工具函数（API 封装等）
│   └── package.json
├── crawler/                   # 多平台爬虫模块
│   ├── lib/
│   │   ├── antiCrawl.js       # 反爬策略（随机延迟、重试）
│   │   ├── bilibili.js        # B站爬虫
│   │   ├── dataWriter.js      # 数据写入后端
│   │   ├── github.js          # GitHub爬虫
│   │   ├── xiaohongshu.js     # 小红书爬虫
│   │   └── zhihu.js           # 知乎爬虫
│   ├── index.js               # 爬虫主入口
│   ├── config.js              # 配置文件
│   └── package.json
└── 远程数据库连接指南.md       # 团队共享数据库配置说明
```

## 环境要求

- **JDK 17**（系统若已安装 JDK 25 等不兼容版本，需单独安装 JDK 17）
- **Node.js 18+**（用于运行前端和爬虫）
- **MySQL 8.x**（本地或远程服务器）
- **Maven**（可使用项目内 `mvnw`）
- **Playwright Chromium**（知乎和小红书爬虫需要，通过 `npx playwright install chromium` 安装）

## 数据库配置

项目默认连接团队共享的远程 MySQL 数据库，配置位于：

[backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)

```yaml
spring:
  datasource:
    url: jdbc:mysql://10.119.3.25:3306/info_digest?useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai
    username: root
    password: root123
```

> 注意：连接远程数据库需要处于校园网内，且服务器安全组已放行 3306 端口。详细说明请参考 [远程数据库连接指南.md](远程数据库连接指南.md)。

如需切换为本地数据库，修改 `application.yml` 中的 `url` 为：

```yaml
url: jdbc:mysql://localhost:3306/info_digest?useUnicode=true&characterEncoding=utf-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai
```

## 快速启动

### 1. 启动后端

```bash
cd backend
mvnw.cmd spring-boot:run   # Windows
./mvnw spring-boot:run     # Linux / macOS
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 3. 打开浏览器访问

http://localhost:5173

### 4. 安装爬虫依赖（必须）

后端启动后，**定时爬虫调度器会每 30 秒自动触发全平台抓取**，但需要先安装爬虫运行环境和浏览器：

```bash
cd crawler
npm install
npx playwright install chromium
```

> 爬虫需要在前端 Settings 页面完成平台授权（保存 Cookie/Token）后才能抓取个人数据。小红书无需登录即可抓取公开内容。
>
> 如需手动触发单平台抓取：
> ```bash
> node index.js --platform=bilibili
> ```

## API 认证

后端使用 JWT 进行无状态认证。除 `/api/auth/**` 等公开接口外，其他请求需要在请求头中携带 Token：

```http
Authorization: Bearer <Your-JWT-Token>
```

登录/注册流程：

1. `POST /api/auth/register` 注册用户
2. `POST /api/auth/login` 登录获取 JWT
3. 后续请求在 Header 中携带 `Authorization: Bearer <token>`

## 主要功能页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 仪表盘 | `/` | 今日浏览量、优质信息源、数字饮食概览 |
| 信息收件箱 | `/inbox` | 信息收集、分类、按平台筛选、状态管理；每 30 秒自动刷新，保留最新 30 条 |
| 知识图谱 | `/graph` | 可视化信息关联网络 |
| 数字饮食报告 | `/report` | 周报/日报、词云、溯源 |
| 社交 | `/social` | 用户互动、好友系统 |
| 个人资料 | `/profile` | 用户信息编辑、头像上传 |
| 设置 | `/settings` | 平台授权、凭证管理、用户偏好 |

## 爬虫平台支持

后端内置 **CrawlScheduler 定时调度器**，每 30 秒自动为已授权平台触发抓取，数据实时同步到 Inbox。

| 平台 | 抓取数据 | 认证方式 | 调度 |
|------|---------|---------|:--:|
| B站 | 观看历史 + CC字幕 | Cookie | 自动 |
| 知乎 | 推荐流 + 收藏夹 | Cookie | 自动 |
| GitHub | Star/仓库/Events/README | Token | 自动 |
| 小红书 | 公开发现页推荐 | 无需登录 | 自动 |

详细技术实现和已知限制请参考 [爬虫情况.md](爬虫情况.md)。

## 团队协作

本项目采用 **GitHub Flow** 协作规范：

1. 从 `main` 分支创建功能分支：`feature/xxx`
2. 在功能分支上开发并提交
3. 发起 Pull Request 请求合并
4. 经 reviewer 审批后合并到 `main`

详细的数据库共享配置、分支规范和常见问题请参考 [远程数据库连接指南.md](远程数据库连接指南.md)。

## 相关文档

- [远程数据库连接指南.md](远程数据库连接指南.md) - 团队共享数据库配置与排错
- [爬虫情况.md](爬虫情况.md) - 各平台爬虫数据、技术实现和已知限制
- [frontend/README.md](frontend/README.md) - 前端详细说明
- [backend/README.md](backend/README.md) - 后端详细说明

## License

本项目为课程实践项目，仅供团队内部学习使用。
