# 公开发布与凭据迁移

代码脱敏不能使历史中曾出现的密码或密钥失效。维护者应在公开仓库前完成部署凭据轮换，并核查 GitHub 上的历史日志和附件。

## 本地开发配置

从仓库根目录执行：

```powershell
Copy-Item backend/.env.example backend/.env.local
python scripts/generate_secrets.py
```

把生成的两项密钥填入私有的 `backend/.env.local`，同时填写自己的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 和 Redis 配置。后端在 `backend` 目录启动时读取该文件。Linux/macOS 可使用 `cp` 复制模板。每个部署使用独立随机密钥，不要把生成结果写回示例文件。

缺少 JWT 密钥、JWT 密钥不足 32 字节，或者凭据加密密钥不是 Base64 编码的 32 字节值时，后端应拒绝启动。

## Docker Compose

```powershell
Copy-Item .env.example .env
python scripts/generate_secrets.py
```

填写私有 `.env` 中的数据库密码和两项新密钥，并把 `CORS_ALLOWED_ORIGIN_PATTERNS` 改为前端实际访问源，例如 `https://app.example.com`。模板中的数据库 URL 面向本地或受信任开发网络；生产数据库应按服务商要求配置 TLS。确认值完整后执行：

```bash
docker compose config --quiet
docker compose up -d
```

使用 `config --quiet` 校验配置，避免把展开后的密码输出到日志。Compose 缺少必填值时会直接报错。不要通过清空数据库来解决配置问题。

## 可选管理脚本

管理脚本从当前进程环境读取配置，不读取仓库中的密码。SSH 需要 `DEPLOY_HOST`、`DEPLOY_USER`，可选 `DEPLOY_PORT`（默认 22）、`DEPLOY_KEY_FILE`、`DEPLOY_PASSWORD`、`DEPLOY_KNOWN_HOSTS`；没有指定密钥文件和密码时使用 SSH agent/本地密钥。主机密钥必须事先核验并加入受信任的 known_hosts，脚本不会自动信任未知主机。

数据库诊断及迁移脚本需要 `DB_HOST`、`DB_USERNAME`、`DB_PASSWORD`，可选 `DB_PORT`（默认 3306）与 `DB_NAME`（默认 `info_digest`）。这些是 Python 管理脚本的配置，后端 JDBC 连接仍使用 `DB_URL`。

`seed_data.py` 需要 `SEED_USERNAME`、`SEED_PASSWORD`，仅向自己的测试实例导入模拟数据。独立运行爬虫时，通过 `AUTH_USERNAME`、`AUTH_PASSWORD` 提供测试账号，或由后端传入登录令牌。

## 线上轮换顺序

1. 备份数据库，暂停后台写入和爬虫任务。
2. 更换曾写入仓库的 SSH、数据库密码，并检查其他服务是否复用；同步更新部署平台的私有配置。
3. 生成新的 JWT 密钥和凭据加密密钥。JWT 密钥切换后，现有登录令牌失效，用户需要重新登录。
4. 对已有加密 Cookie/Token，按下方流程迁移后再启用新的加密密钥；也可以选择让用户清除旧授权并重新授权。
5. 手动运行 GitHub Actions 的镜像发布工作流并部署，检查启动、登录和平台授权，再恢复任务。普通代码推送不会发布镜像，Watchtower 也默认不启用；确认新镜像正常后，核查旧镜像和旧日志的访问范围。

## AES 凭据迁移

在隔离的管理进程环境中设置：

- `CREDENTIAL_ENCRYPTION_KEY`：目标新密钥。
- `PREVIOUS_CREDENTIAL_ENCRYPTION_KEY`：旧密钥，只在迁移期间提供。
- 上述管理脚本所需的数据库环境变量。

先预览，再在已备份并暂停写入的数据库上应用：

```bash
python migrate_credentials.py
python migrate_credentials.py --apply
```

默认预览只读，不更新数据库。脚本先验证整批数据能否迁移，再在一个事务中更新；不可解密的数据会使整批更新回滚。已使用目标密钥的记录会跳过，便于复查。迁移完成后，后端使用目标新密钥，移除管理环境中的旧密钥，并保持旧备份私有。

## Git 历史与 GitHub 页面

在独立副本中清理历史，避免在仍有开发工作的原仓库中直接重写。清理后的提交编号会变化；应用前需记录远端分支的原提交，并协调团队成员同步或重新克隆，防止旧历史被再次合入。

还需核查 GitHub Actions 旧日志和运行产物、Releases 附件、Issue/PR 内容、旧 PR 引用、仓库 Wiki 以及容器镜像；这些内容不包含在普通代码扫描中。确认成员资料和课程材料的公开范围，并由共同作者决定许可证。

仓库内的 `python scripts/check_public_release.py` 用于检查当前跟踪文件中的常见凭据误提交。它不连接服务、不验证线上密钥是否已轮换，也不能替代人工资料复核或 GitHub 附件检查。

参考：[GitHub 敏感数据处理](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)、[仓库可见性变更](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)。
