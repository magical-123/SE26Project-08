# 技术原型目录

本目录包含本迭代的所有交付成果。

## 目录结构

```
TechPrototype/
├── docs/              # 文档目录
│   ├── 迭代计划2.pdf
│   ├── Vision文档.md
│   ├── 软件架构文档-1.docx
│   ├── InfoDigest (知食) 系统 UML 模型设计文档.pdf
│   └── 迭代二_技术原型迭代评估报告.md
└── code/              # 技术原型代码
    ├── backend/       # Spring Boot后端服务
    ├── frontend/      # React前端应用
    ├── crawler/       # Node.js数据爬虫服务
    └── extensions/    # 浏览器扩展
        ├── xiaohongshu-manual-sync/  # 小红书内容同步插件
        └── zhihu-manual-sync/        # 知乎内容同步插件
```

## 文档说明

### 1. 迭代计划2.pdf
包含本迭代的计划、目标、任务分配和时间安排。

### 2. Vision文档.md
项目愿景文档，描述项目目标、范围和关键特性。

### 3. 软件架构文档-1.docx
系统架构设计文档，包括技术栈选择、架构模式和关键设计决策。

### 4. InfoDigest (知食) 系统 UML 模型设计文档.pdf
完整的UML模型文档，包含：
- **用例模型**：系统用例图和用例描述
- **分析模型**：领域模型、类图等分析阶段产出
- **设计模型**：详细设计类图、序列图、组件图等

### 5. 迭代二_技术原型迭代评估报告.md
本迭代的评估报告，包括完成情况、遇到的问题和改进建议。

## 技术原型代码

完整的技术原型实现代码，包括：

### backend/
Spring Boot后端服务，提供RESTful API接口：
- 用户认证与授权
- 信息捕获与管理
- AI内容分析与摘要
- 报告生成与词云分析
- 知识图谱构建

### frontend/
React前端应用，提供用户界面：
- 捕获箱（Inbox）：信息收集与管理
- 仪表盘（Dashboard）：数据可视化展示
- 报告（Report）：周报/日报生成与查看
- 知识图谱（Graph）：概念关系可视化
- 设置（Settings）：用户配置管理

### crawler/
Node.js数据爬虫服务：
- 支持B站、抖音、小红书等平台
- 自动化数据采集
- 数据清洗与结构化

### extensions/
浏览器扩展插件：
- **xiaohongshu-manual-sync/**：小红书内容手动同步插件
- **zhihu-manual-sync/**：知乎内容手动同步插件

## 技术栈

### 后端
- Java 17 + Spring Boot 3.2.3
- MySQL 8.0
- Redis
- Hibernate JPA
- JWT认证

### 前端
- React 18
- Vite
- ECharts（数据可视化）
- React Router（路由管理）
- Framer Motion（动画效果）

### 爬虫
- Node.js
- Puppeteer（浏览器自动化）
- Cheerio（HTML解析）

### 浏览器扩展
- Chrome Extension Manifest V3
- JavaScript

## 运行说明

详细的运行说明请参考项目根目录的README文件。


