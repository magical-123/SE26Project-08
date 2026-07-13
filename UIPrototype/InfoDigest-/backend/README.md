# InfoDigest - Backend

InfoDigest 的后端服务，负责处理前端复杂的数据请求、信息流解析、用户认证与鉴权，并为知识图谱的高效加载提供数据支撑。

## 🛠️ 技术栈

本项目基于强大的 Java Spring 生态构建，保证了系统的高并发与稳定性：

- **核心框架**: Java 17 + Spring Boot 3.2.3
- **构建工具**: Maven
- **数据持久化**: 
  - Spring Data JPA
  - MySQL Connector (底层数据库支持)
- **安全与认证**: 
  - Spring Security
  - JSON Web Tokens (JJWT 0.12.5) 负责无状态的高效鉴权
- **代码简化**: Lombok (大幅减少样板代码，加速实体与服务的开发)
- **RESTful API**: Spring Web 构建标准且优雅的前后端分离接口

## 🚀 快速启动

1. 环境准备:
   - 确保本机安装了 Java 17 (或使用项目内自带的 `jdk17` 环境)。
   - 确保已配置好 MySQL 数据库服务，并更新 `application.yml` / `application.properties` 中的数据库连接信息。

2. 编译并运行项目:
   使用 Maven Wrapper 直接启动（无需全局配置 Maven）：
   
   **Windows:**
   ```cmd
   mvnw.cmd spring-boot:run
   ```
   
   **Linux / macOS:**
   ```bash
   ./mvnw spring-boot:run
   ```

3. 构建打包:
   ```bash
   ./mvnw clean package
   ```
   打包后的 `.jar` 文件将生成在 `target` 目录下。

## 🔒 认证机制
所有的 API 调用（除公开接口外）都需要在 HTTP Header 中携带 JWT Token 以完成身份验证：
```http
Authorization: Bearer <Your-JWT-Token>
```
