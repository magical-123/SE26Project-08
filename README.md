# InfoDigest

> 帮助用户进行「信息消化与知识提炼」的数字饮食操作系统。

InfoDigest 是一款面向碎片化信息时代的信息管理工具，通过收集、整理、分析与可视化，帮助用户把日常浏览的信息转化为可持续积累的结构化知识资产。

## 项目简介

在短视频、播客、文章、资讯充斥的日常中，用户每天摄入大量信息却难以沉淀。InfoDigest 提供了一整套信息处理工作流：

- **信息收集**：把来自不同平台（B站、播客、文章等）的信息片段统一汇入 Inbox。
- **智能分类**：自动/手动对信息打标签、分类，区分深度知识、行业资讯、实用技巧、娱乐科普等。
- **数字饮食报告**：统计每日/每周信息摄入结构，帮助用户了解自己的「信息饮食结构」。
- **知识图谱**：把已整理的信息可视化为动态知识星系，直观呈现知识之间的关联。
- **复习机制**：基于记忆曲线提醒用户复习核心知识点。

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

## 项目结构

```
InfoDigest-
├── backend/                   # Spring Boot 后端
│   ├── src/main/java/com/infodigest/
│   │   ├── config/            # 安全配置、跨域配置
│   │   ├── controller/        # RESTful API 接口
│   │   ├── model/             # 数据实体
│   │   ├── repository/        # JPA 数据访问层
│   │   ├── security/          # JWT 认证过滤器
│   │   └── service/           # 业务逻辑与用户服务
│   └── src/main/resources/
│       └── application.yml    # 数据库等配置
├── frontend/                  # React + Vite 前端
│   ├── src/
│   │   ├── components/        # 通用组件（GlassCard、CommandPalette 等）
│   │   ├── pages/             # 页面（Dashboard、Inbox、KnowledgeGraph 等）
│   │   ├── hooks/             # 自定义 React Hooks
│   │   └── mock/              # 前端 Mock 数据
│   └── package.json
├── UIPrototype/               # 早期 UI 原型文件
└── 远程数据库连接指南.md       # 团队共享数据库配置说明
```

## 环境要求

- **JDK 17**（系统若已安装 JDK 25 等不兼容版本，需单独安装 JDK 17）
- **Node.js 18+**（用于运行前端）
- **MySQL 8.x**（本地或远程服务器）
- **Maven**（可使用项目内 `mvnw`）

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

### 方式一：分别启动前后端

1. 启动后端：
   ```bash
   cd backend
   mvnw.cmd spring-boot:run   # Windows
   ./mvnw spring-boot:run     # Linux / macOS
   ```

2. 启动前端：
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. 打开浏览器访问：http://localhost:5173

### 方式二：一键启动脚本（项目根目录）

在 `d:\123pan\软工原\` 目录下提供了 Windows 一键脚本：

- `start-dev.bat`：同时启动前后端
- `stop-dev.bat`：停止前后端进程

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
| 信息收件箱 | `/inbox` | 信息收集、分类、状态管理 |
| 知识图谱 | `/graph` | 可视化信息关联网络 |
| 数字饮食报告 | `/report` | 周报/日报、词云、溯源 |
| 设置 | `/settings` | 用户偏好，如「隐藏娱乐类信息」 |

## 团队协作

本项目采用 **GitHub Flow** 协作规范：

1. 从 `main` 分支创建功能分支：`feature/xxx`
2. 在功能分支上开发并提交
3. 发起 Pull Request 请求合并
4. 经 reviewer 审批后合并到 `main`

详细的数据库共享配置、分支规范和常见问题请参考 [远程数据库连接指南.md](远程数据库连接指南.md)。

## 相关文档

- [远程数据库连接指南.md](远程数据库连接指南.md) - 团队共享数据库配置与排错
- [frontend/README.md](frontend/README.md) - 前端详细说明
- [backend/README.md](backend/README.md) - 后端详细说明

## License

本项目为课程实践项目，仅供团队内部学习使用。
