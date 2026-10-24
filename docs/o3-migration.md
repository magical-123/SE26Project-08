# O3：InfoDigest 前端门禁与发布迁移

实验主仓库：[ops-lab1-16](https://github.com/magical-123/ops-lab1-16)。
真实项目：[SE26Project-08](https://github.com/magical-123/SE26Project-08)。

本次发布单元为 InfoDigest 前端。React 页面、核心组件和 API 工具是真实项目代码；
后端、MySQL、Redis、爬虫和 AI 服务不在本轮 CI 的集成验证范围。业务接口仍需后端。

## 与 Go 统一示例的差异

| 项目 | Go 示例 | InfoDigest 前端 |
| --- | --- | --- |
| 工具链 | Go / make | 固定 Node 24.14.0、npm lockfile、Python 3.12 打包 |
| 安装 | Go modules | `cd frontend && npm ci`；`.npmrc` 保持旧依赖所需的 peer 配置 |
| 静态检查 | fmt-check、vet | `npm run lint`，错误阻止合并；已有 warning 仍打印，不宣称清零 |
| 测试 | go test | Vitest + jsdom，恢复五套 205 项真实断言，mock API |
| 构建 | 单个可执行文件 | `npm run build` 生成 dist，预构建注入 version.json |
| 版本查询 | 服务版本接口 | 静态服务器的 `/version.json`，内容与 BUILD_INFO 一致 |
| 制品 | Linux 二进制 tar.gz | 静态资源 tar.gz，单一顶层目录，含 dist、BUILD_INFO、启动说明 |
| 部署 | 启动服务进程 | 本地静态启动验收；原校内服务器看门狗部署暂停 |

完整归档测试曾试跑 864 项，其中 333 项的页面 fixture/Provider/导航断言已过时。
本轮恢复范围见 `frontend/src/test/README.md`；完整归档保留，未把旧测试的失败描述为通过。

## 门禁与发布约定

- `ci.yml` 对面向 main 的所有 PR 和 push main 运行，不使用路径过滤。
- runner 为 ubuntu-24.04，10 分钟超时；安装、静态检查、测试、构建分别执行。
- main 规则集要求其他成员的一次审批、必需 `ci`、禁止删除/强推，Bypass 为空。
- 只有 push main 上传主干制品，版本 0.0.0-main；artifact 名含构建号和 SHA，保留 14 天。
- `release.yml` 对 `v数字.数字.数字` 标签触发；完整检出后检查提交为 origin/main 的祖先。
- 发布前重新检查、测试和构建；Release 上传 tar.gz 和同名 tar.gz.sha256。
- version 取标签去掉 v；build_no 取 github.run_number；run_id 取 github.run_id；commit 取 github.sha。
- 不注入构建时间；归档按固定顺序、权限、属主、mtime 和 gzip 时间生成。

原 `docker-publish.yml` 保留为手动构建三个服务镜像的入口；它与本轮前端 O3 流水线独立。
旧服务器已停用，不再依赖看门狗拉取。未来可将同一已验真的制品接入新部署环境。

## 本地复现

安装 Node 24.14.0 和 Python 3.12 或以上，在仓库根目录执行：

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
cd ..
python scripts/frontend_release.py package
python scripts/frontend_release.py smoke release/infodigest-frontend_dev_static.tar.gz
```

没有 Actions 环境时，版本为 dev，构建号与运行号为 local，提交号自动读取 Git。
发布构建通过环境变量 VERSION、BUILD_NO、RUN_ID、COMMIT 注入上下文。

下载 Release 的 tar.gz 和同名 sha256 后：

```bash
python scripts/frontend_release.py smoke /path/to/infodigest-frontend_1.0.0_static.tar.gz
python scripts/frontend_release.py trace /path/to/infodigest-frontend_1.0.0_static.tar.gz
```

smoke 会验证哈希、单一顶层目录、BUILD_INFO 与运行时版本一致，并短暂启动本地 HTTP
服务检查首页及版本，然后自动关闭。trace 输出对应 commit、Actions run 和 Release 链接。
手动运行可解压后执行 `python -m http.server 4173 --directory 解压目录/dist`。
回退时停止旧静态服务，校验上一版本的包，在同一端口启动上一版本并查询 version.json；
静态验证不代表后端业务可用，也不涉及数据库回退。

## 实验执行证据

本节按实际执行结果更新，未运行的项目保持待完成。

| 项目 | 状态 / 证据 |
| --- | --- |
| 本地依赖安装、205 项测试、生产构建 | 通过 |
| 本地包校验及静态启动 | 通过 |
| 迁移 PR | [PR #36](https://github.com/magical-123/SE26Project-08/pull/36)，待其他成员审批 |
| PR 失败 CI | [run 40079231793](https://github.com/magical-123/SE26Project-08/actions/runs/40079231793)，故意错误的鉴权断言导致 1 项失败、204 项通过，构建步骤被跳过 |
| 修复后成功 CI | [run 40079374698](https://github.com/magical-123/SE26Project-08/actions/runs/40079374698)，Ubuntu 上检查、205 项测试和生产构建通过 |
| main 规则集 | [main-merge-gate](https://github.com/magical-123/SE26Project-08/rules/25775887)，Active、无 Bypass、ci 必需、1 次其他成员审批 |
| main 制品 | 待合并后运行 |
| 非 main 标签被拒绝 | [run 40079415954](https://github.com/magical-123/SE26Project-08/actions/runs/40079415954)，v0.0.0 在 Check release gate 失败，后续构建/发布跳过；未创建 Release |
| 正常标签 Release 及下载校验 | 待合并后运行 |

### 管理员直接推 main 被拒绝

2026-10-24 使用当前 main 的同一份 tree 创建空变更提交，实际尝试直接推送 main。
GitHub 返回以下信息，推送前后 main 均为 d4a2617262e8215f9c3e956b4d3b8477d85385ce：

```text
GH013: Repository rule violations found for refs/heads/main.
Changes must be made through a pull request.
Required status check "ci" is expected.
[remote rejected] -> main (push declined due to repository rule violations)
```

这是服务器实际拒绝结果，不是 dry-run。对应规则集无 Bypass，账号管理员同样受限。

### 仓库公开与历史边界

原仓库已公开。公开前对十个分支应用脱敏历史，原始历史 bundle 留在私有本地备份。
已识别的旧凭据按部署负责人确认已失效或轮换；公开分支历史复查未发现这些原文。
GitHub 旧 PR 引用和缓存不受普通分支推送控制，仍可能访问旧提交及旧文档作者字段；
因此“清理后的分支无已识别凭据”不等于“GitHub 全站旧引用均已删除”。
团队继续开发时应重新克隆当前仓库，避免将旧克隆的历史重新推送。

本轮 O3 迁移不包含 O1 镜像加分项或整套后端部署验收。
