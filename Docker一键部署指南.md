# InfoDigest - 现代化全自动部署指南 (CI/CD)

为了实现极简的自动化部署体验，同时为了**100% 安全保留你原有的业务数据**，本项目采用了**“GitHub 顶配自动化流水线 + 独立数据库 + Watchtower 内网热更新”**的现代化混合架构（前后端+爬虫微服务分离）。

这意味着：你只需要在本地敲打 `git push`，剩下的脏活累活全部由微软的超级计算机代劳，你的交大内网服务器只需要坐等签收包裹即可！

---

## 🚀 部署实操步骤

### 1. 配置 GitHub 通行证 (仅第一次需要)
我们的流水线是由 GitHub Container Registry (GHCR) 提供免费的高速海外货仓。首先，你需要让你的服务器拿到开启这个货仓的钥匙。

1. 去你的 Github 网页，点击右上角的头像 -> `Settings` -> 最下方的 `Developer settings` -> `Personal access tokens` -> `Tokens (classic)`。
2. 点击 **Generate new token (classic)**，名字随便起，过期时间选 `No expiration`。
3. **关键步骤**：权限栏中打勾选中 **`write:packages`** (系统会自动勾上 `read:packages`) 和 **`repo`**。
4. 生成后，**务必立刻复制那串 `ghp_` 开头的 Token**（一旦刷新网页就看不到了）。

### 2. 服务器环境配置
登录到你用来运行系统的服务器（例如交大内网的 10.119.3.25）。

**获取并登录 GitHub 仓库：**
```bash
sudo docker login ghcr.io -u magical-123
# 提示输入 Password 时，将刚刚复制的 ghp_ 开头的 Token 粘贴进去即可。看到 Login Succeeded 代表大功告成！
```
> ⚠️ **这一步至关重要**：不仅首次拉取镜像需要它，后续 Watchtower 看门狗的自动热更新也依赖这份认证文件（`/root/.docker/config.json`）。如果跳过这一步，自动更新将会静默失败。

**配置连接老数据库：**
在项目根目录拉取代码，并复制一份环境变量模板：
```bash
cp .env.example .env
```
使用文本编辑器（如 `vim .env`）打开你刚复制的 `.env`。
找到 `DB_URL` 和 `REDIS_HOST`。如果你的 MySQL 和 Redis 运行在同一台宿主机上，请直接保留 `host.docker.internal`（系统已自动配置该映射）。如果在其他机器，请修改为对应的内网 IP。

### 3. 一键起飞 (召唤看门狗)
在项目目录下，只需执行人生中的最后一次启动命令：

```bash
docker-compose up -d
```
Docker 会迅速拉取我们早就打包好的最新成品，并顺带召唤出了一只名叫 **Watchtower (看门狗)** 的容器进程。

### 4. 彻底躺平 (全自动热更新)
从今往后，你可以**永远离开这台服务器**了。

每当你想要更新应用，只需在本地电脑上开发完毕后，按平时习惯执行：
```bash
git add .
git commit -m "你的更新信息"
git push
```

**背后发生的魔法：**
1. GitHub Actions 瞬间拦截你的 Push，启动免费的海外虚拟机，自动编译 Java 后端、React 前端以及 Node 爬虫微服务，打成 Docker 镜像存进 `ghcr.io`。
2. 服务器里的 Watchtower 看门狗每隔 5 分钟会出去巡逻一圈，一旦发现 GitHub 货仓里有新包裹，它会自动将其取回交大内网，优雅地干掉旧容器，替换新容器，全程无需任何人工干预！🎉

---

## 🛑 常用故障排查

**如何查看后端和爬虫报错日志？**
```bash
docker-compose logs -f backend
docker-compose logs -f crawler
```

**如果不想要自动更新了，或者要销毁系统怎么做？**
```bash
docker-compose down
```
这只会销毁用来运行前后端的代码壳子，你的数据库和 Redis 的数据都在宿主机上安然无恙，请放心食用。
