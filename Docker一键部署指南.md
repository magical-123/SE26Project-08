# InfoDigest Docker 部署指南

项目通过 GitHub Actions 手动发布前端、后端和爬虫镜像。在仓库 Actions 页面选择 `Docker Build and Publish to GHCR` 后运行工作流；普通代码推送只做公开文件检查，不会发布镜像。数据库和 Redis 由部署者提供，Compose 不会创建或重置数据库。

## 首次部署

1. 安装 Docker Engine 和 Docker Compose。
2. 拉取项目，在根目录把 `.env.example` 复制为私有 `.env`。
3. 填写自己的数据库与 Redis 配置；运行 `python scripts/generate_secrets.py` 并填入两项独立密钥。
4. 将 `CORS_ALLOWED_ORIGIN_PATTERNS` 设为实际前端访问源。
5. 校验并启动：

```bash
docker compose config --quiet
docker compose up -d
```

如果镜像为私有，需要用有读取相应包权限的账号登录 GHCR。使用有有效期且权限尽量小的 Token，并在交互提示中输入，不要写入命令或文档：

```bash
docker login ghcr.io -u <GitHub用户名>
```

`.env`、Docker 认证文件和生成的密钥均应保持私有。Watchtower 默认不启动；部署者核对新版本与数据迁移要求后，可用 `docker compose --profile auto-update up -d` 启用自动更新。

## 日常管理

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 crawler
docker compose pull
docker compose up -d
```

分享日志前应复查其中的个人资料、请求内容与平台凭据。更换密钥及处理原有数据库记录的步骤见 [公开发布与凭据迁移](docs/public-release.md)。
