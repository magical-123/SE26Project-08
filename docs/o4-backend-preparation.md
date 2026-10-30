# O4 后端准备与迁移交接

本次完成 InfoDigest 后端的观测与配置准备，供后续迁移到实验 2 O4 使用。没有执行 O4 压测、推算资源上限、编写实验 PromQL 或填写资源账，也没有改动业务逻辑、实体、数据库 schema 和定时任务。

迁移以仓库根目录的 `backend/` 及配套配置为准；`FinalRelease/`、`TechPrototype/` 中的历史快照未同步修改。

## 需求核查

依据提供的 `lab-2.html` 第 5 节，O4 要求是：为小组项目加入 RED 三项指标，测出一种资源的上限，按 L-07 格式写一行资源账；选做项目需要先写预期再测量。使用 HikariCP 作为候选资源、选择 `/api/health/db` 和使用 Actuator 自动采集，都是可行的实施选择，并非实验限定。

同学提供的《O4-后端指标要求.md》整体方向正确，需修正以下几点：

| 原要求或说法 | 核查与处理 |
| --- | --- |
| 添加 Actuator、Prometheus registry，交给 Spring Boot 管理版本 | 正确；HTTP 和 Hikari 指标可以自动采集，无需手写业务埋点。 |
| 配置端点暴露后就应出现时延直方图桶 | 缺少直方图开关；增加 `management.metrics.distribution.percentiles-histogram.http.server.requests: true`，才能提供验收要求的 `_bucket`。 |
| 只改 3 个文件即可在部署时用环境变量调池大小 | 后端本身可配置，但 Compose 显式列出传入容器的变量，还需要透传 `DB_POOL_MAX_SIZE`、`DB_POOL_MIN_IDLE`，并补充环境示例。默认仍为 10/2。 |
| 每次请求都应观察到 active 短暂 +1 | 借用连接会占用池，但 gauge 是采样值，短请求的变化可能被遗漏；不能要求每次抓取都看到 +1。 |
| 调小连接池即可制造连接池瓶颈 | 不保证。`SELECT 1` 持有连接极短，CPU、HTTP 工作线程或压测机可能先达到上限；最终需要实测证据判断。 |
| `/actuator/health` 保持原行为 | 改造前只有 Security 放行规则，尚无 Actuator 端点；加入依赖后才真正提供健康响应，并汇总数据库、Redis 等依赖状态。 |
| 其他全部 `/api/**` 需要 JWT | 应保留原有公开例外：登录、注册、ping、数据库健康检查；用户数据接口继续鉴权。 |

技术依据：[Spring Boot 3.2.3 的 HTTP 指标与数据源指标](https://docs.spring.io/spring-boot/docs/3.2.3/reference/html/actuator.html#actuator.metrics.supported.spring-mvc)、[直方图配置](https://docs.spring.io/spring-boot/docs/3.2.3/reference/html/actuator.html#actuator.metrics.customizing.per-meter-properties)、[Micrometer gauge 的采样语义](https://docs.micrometer.io/micrometer/reference/concepts/gauges.html)。

## 迁移后提供的能力

- `GET /actuator/prometheus`：无需 JWT，返回 Prometheus 指标文本；统一带 `application="infodigest-backend"` 标签。
- `GET /actuator/health`：无需 JWT，返回应用及依赖的健康状态；数据库或 Redis 异常时可能返回 503。
- `GET /api/health/db`：保持原来的免鉴权 `SELECT 1` 检查，通过同一个 Hikari 数据源访问真实数据库。
- Hikari 池大小由 `DB_POOL_MAX_SIZE`、`DB_POOL_MIN_IDLE` 覆盖；修改后需要重启应用或重建容器。设置时保持最小空闲数不大于最大连接数。
- Actuator HTTP 暴露列表只有 `health,prometheus`，没有开放 `env`、`configprops`、`heapdump` 等端点。业务接口鉴权保持现有规则。

HTTP 指标包括 `http_server_requests_seconds_count`、`_sum`、`_bucket`，以及 `method`、`uri`、`status` 等标签。HTTP 请求完成后才累计，先访问目标接口，再抓取指标；没有发生过的状态码不一定有对应序列。5xx 应按状态码统计，503 同样属于服务端错误，不能只筛 500。

Hikari 指标包括 `hikaricp_connections_active`、`_idle`、`_pending`、`_max`、`_min`、连接获取/使用计时和超时计数。HTTP 时延包含安全过滤、连接等待、SQL 与响应处理，不能直接当作连接占用时间。当前 Hikari 的连接使用计时按毫秒记录，极短的 `SELECT 1` 还可能被量化为零。[Hikari 指标实现](https://raw.githubusercontent.com/brettwooldridge/HikariCP/HikariCP-5.0.1/src/main/java/com/zaxxer/hikari/metrics/micrometer/MicrometerMetricsTracker.java)

## 本地启动与轻量验收

以下命令在仓库根目录执行，使用 Java 17 和 Maven。环境文件仅填写新环境的值，不迁移原部署凭据或用户数据。直接访问后端 8080，前端静态服务不提供 Actuator 端点。

1. 准备可连接的 MySQL 与 Redis。将 `backend/.env.example` 复制为 `backend/.env.local`，填写数据库连接、Redis 与两个应用密钥。可以运行 `python scripts/generate_secrets.py` 生成新密钥并填写到私有环境文件。后端从其工作目录读取 `.env.local`。
2. 构建和测试，再启动应用：

   ```bash
   cd backend
   mvn package
   java -jar target/backend-0.0.1-SNAPSHOT.jar
   ```

   `package` 阶段包含测试。Windows 可将 Maven 命令换为 `.\mvnw.cmd package`。若使用 Maven Wrapper，首次运行需要下载 Maven；也可直接使用已安装的 Maven。

3. 在另一终端检查公开入口与鉴权：

   ```bash
   curl -i http://localhost:8080/api/ping
   curl -i http://localhost:8080/api/health/db
   curl -i http://localhost:8080/actuator/health
   curl -i http://localhost:8080/api/user/profile
   curl -s http://localhost:8080/actuator/prometheus > metrics.txt
   ```

   PowerShell 使用 `curl.exe`，避免旧版 PowerShell 的 `curl` 别名。数据库正常时 db-health 应返回 200 和 `"status":"UP"`；无 JWT 的 profile 应被安全过滤器拒绝（当前配置通常为 403）。Prometheus 应返回 200 和指标文本。健康端点的 503 需要排查依赖，不能视为指标端点未放行。

4. 在 `metrics.txt` 中确认目标 URI 的请求计数、状态标签、`_sum`、带 `le` 标签的 `_bucket`，以及上述 Hikari 指标。一次短请求结束后 active 为 0 是正常现象；无需制造故障或添加延迟来验收。

应用原有定时任务和队列消费者继续运行；后续测量时应记录其活动及数据库/Redis 所在位置，避免把后台工作误算为被测接口开销。本次没有禁用这些任务。

## Docker 与 GHCR 交接

根目录 `.env.example` 用于 Compose，`backend/.env.example` 用于直接运行，两者工作目录和文件名不同。池大小变量已在 Compose 中透传，修改根目录 `.env` 后需重新创建后端容器。

现有 `docker-compose.yml` 使用 GHCR `latest` 镜像，没有本地 `build:`；仅修改源码后执行 `docker compose up` 不会自动获得新代码。本地验收优先使用上面的新构建 JAR。需要验证镜像时，可在本地用 `docker build -t infodigest-backend:o4-prep ./backend` 构建，再通过临时 Compose override 将后端 `image` 改为该本地标签；无需推送 GHCR。运行镜像前仍需准备真实数据库、Redis 和私有环境配置。

原有 GHCR 手动发布入口保持兼容；是否发布由项目负责人决定，本次准备不代表远程镜像已经更新。

现有主 CI 仍只验证前端，GHCR 工作流打包后端时会跳过测试；后端迁移验收需主动运行 `mvn clean verify`。本次新增的少量集成测试已取消 Git 忽略，覆盖率文件也由 Windows 固定路径改为 `backend/target/jacoco.exec`，便于在 Java 17 的 Windows/Linux 环境复现。

## 验证记录与下一步边界

| 验证项 | 本次实际结果 |
| --- | --- |
| 后端 Maven 测试、打包 | 2026-10-30：Java 17.0.19、Maven Wrapper 3.9.5，`mvnw.cmd -B -q clean verify` 通过；生成 `backend/target/backend-0.0.1-SNAPSHOT.jar`。 |
| 隔离外部依赖的 HTTP/Hikari 集成测试 | 2026-10-30，Java 17.0.19：4 项通过，0 失败、0 错误；验证公开监控、受保护接口、HTTP 直方图、Hikari 指标及数据库故障 503 的记录。报告位于 `backend/target/surefire-reports/`。 |
| Compose 配置解析与池参数透传 | 使用无真实凭据的示例环境通过 `docker compose config --format json`，确认覆盖值 3/1 进入 backend 容器环境。 |
| 既有配置与发布安全脚本测试 | `python -m unittest discover -s scripts/tests -v`：11 项通过。 |
| 真实 MySQL/Redis 环境启动与以上 curl 验收 | 未执行：本机 Docker 引擎未运行，未连接实际数据库、Redis 或远程服务器。 |

隔离测试使用 H2 并替换外部依赖，只验证指标导出、真实 HTTP 请求的记录以及安全边界；不代表真实 MySQL、Redis、爬虫或现有服务器已经部署验收。测试通过 `@AutoConfigureObservability` 启用 Prometheus 导出，避免 Spring Boot 测试模式默认关闭外部指标注册表；没有使用测试专用的生产埋点。

后续 O4 负责人再完成：选定被测路径和候选资源、记录预期与条件、配置 Prometheus 抓取路径 `/actuator/prometheus`、编写适配本项目标签的查询、逐步加压并保存原始证据，最后根据实际饱和资源填写资源账。实验 Go 示例的指标名和查询不能直接照搬到 Spring Boot。本次没有代做这些实验，也没有提供虚构吞吐量或实验结论。
