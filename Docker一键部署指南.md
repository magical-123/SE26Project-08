# InfoDigest - 混合容器化部署指南

为了实现极简的自动化部署体验，同时为了**100% 安全保留你原有的业务数据**，本项目采用**“前后端容器化 + 独立数据库”**的混合部署架构。

在部署时，Docker 引擎会为你打包最新的后端（Spring Boot）与前端（React/Vite），并直接连接到你们原本已存在的 MySQL 与 Redis 数据库上。

---

## 🚀 部署实操步骤

### 1. 前置环境安装 (仅全新机器需要)
如果你的服务器上还没有安装 Docker，请先通过以下命令安装（以 Ubuntu 为例，无需额外安装 Java 或 Node.js）：
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
```

### 2. 拉取代码与环境配置
将我们的代码仓库 clone 到你的服务器中：
```bash
git clone https://github.com/magical-123/SE26Project-08.git /opt/infodigest
cd /opt/infodigest/repo
```

代码拉取后，根目录下会有一个环境模板 `.env.example`。复制一份作为你的本地环境变量，并确保其中的密钥和密码妥善保管：
```bash
cp .env.example .env
```

**⚠️ 关键配置（连接旧库）**
使用文本编辑器（如 `vim .env`）打开你刚复制的 `.env`，找到 `DB_URL` 和 `REDIS_HOST`：
将里面的 IP 地址修改为**你老服务器的真实内网/公网 IP 地址**。如果你就是在老服务器本机上运行这套系统，也请填写这台机器的真实局域网 IP，**不要填写 localhost 或 127.0.0.1**，否则 Docker 内部会把它当成自己虚构的网络环境而导致连不上外部库。

### 3. 一键起飞 (Build & Up)
只需在项目根目录运行下面一行命令：

```bash
docker-compose up -d --build
```
执行后，Docker 会在后台自动完成长达几分钟的 Maven 后端编译与 NPM 前端编译。

### 4. 验证服务状态
当命令执行完毕并回到终端输入光标后，说明容器已创建成功，你可以通过以下命令持续查看后端启动的实时日志：
```bash
docker-compose logs -f backend
```

当日志输出 `Started InfoDigestApplication` 的字样时，说明部署全部成功！由于数据库连的是你的老系统库，你之前注册的所有用户、爬取的全部笔记，都会丝滑且原封不动地展现在你的新页面中。

## 🛑 常用维护命令

**更新最新代码重启：**
```bash
git pull
docker-compose up -d --build
```

**停止并销毁前后端服务：**
```bash
docker-compose down
```
