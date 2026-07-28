# InfoDigest - Frontend

InfoDigest 是一个旨在帮助用户进行“信息消化与知识提炼”的操作系统（OS）。前端采用极致的现代美学设计，深度应用了 Glassmorphism（毛玻璃质感）与赛博朋克极简风格，并以高度互动的核心组件构建。

## 🌟 核心特性

- **全局命令面板 (Command Palette)**：通过类似于 macOS Spotlight 的交互快速直达各种功能和碎片信息。
- **信息流收集器 (Inbox)**：自动收集和汇聚多种来源（如 B站、播客、文章）的信息片段。
- **知识星系图谱 (Knowledge Graph)**：**本项目的灵魂！** 使用动态力导向图呈现信息的网状结构，智能融合多种颜色与节点大小，连线动态呼吸，完美可视化“跨界知识”。
- **精美动效与手势交互**：丝滑的页面切换、卡片 3D 倾斜跟随、抽屉无缝弹出。

## 🛠️ 技术栈

- **框架**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **路由**: [React Router Dom](https://reactrouter.com/)
- **数据可视化**: 
  - [AntV G6 (v5)](https://g6.antv.antgroup.com/) (知识星系图谱引擎)
  - [ECharts](https://echarts.apache.org/) (数据看板与可视化)
- **动效与交互**: 
  - [Framer Motion](https://www.framer.com/motion/) (核心动画引擎)
  - Vanilla-Tilt / React-Tilt (3D 悬浮卡片物理交互)
  - [cmdk](https://cmdk.paco.me/) (快捷命令面板)
- **UI & 样式**: 
  - 纯手工雕琢的 Vanilla CSS (定制化 Glassmorphism & Neon Glow)
  - [Lucide-React](https://lucide.dev/) (高品质现代图标)
- **工程化**: [Oxlint](https://oxc-project.github.io/docs/guide/usage/linter.html) (超高速基于 Rust 的 Linter)

## 🚀 快速启动

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动开发服务器:
   ```bash
   npm run dev
   ```

3. 构建生产版本:
   ```bash
   npm run build
   ```

## 🎨 设计哲学

我们没有使用 Tailwind CSS 或现成的组件库，因为 InfoDigest 的设计对环境光泽、毛玻璃多重阴影有着极其严苛的要求。所有的颜色均源于我们精心配置的 **Vibrant 调色盘**，旨在为用户提供类似于科幻电影般沉浸的数据整理体验。
