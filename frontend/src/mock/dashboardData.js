export const nutritionData = [
  { name: '深度知识 (蛋白质)', value: 35, color: '#10B981' },
  { name: '娱乐短剧 (碳水)', value: 45, color: '#F43F5E' },
  { name: '行业资讯 (脂肪)', value: 15, color: '#F59E0B' },
  { name: '创意灵感 (维生素)', value: 5, color: '#3B82F6' },
];

export const trendData = {
  days: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  values: [2.5, 3.8, 2.1, 5.4, 4.2, 6.8, 7.5]
};

export const aiQuotes = [
  {
    id: 1,
    summary: "你最近对「大模型架构」的关注度显著上升...",
    fullText: "你最近对「大模型架构」的关注度显著上升，这与你上个月研究的「Transformer 机制」形成了很好的知识闭环。建议你可以继续深入了解 MoE (Mixture of Experts) 的混合专家架构，以拓展你对参数扩展的理解边界。",
    sourcePlatform: "B站 · 深度技术解析",
    sourceLink: "https://bilibili.com/video/xxx",
    tags: ["大模型", "Transformer", "MoE"]
  },
  {
    id: 2,
    summary: "昨天晚上你浏览了高密度的哲学内容...",
    fullText: "昨天晚上你花了两小时浏览了高密度的哲学内容，这是很好的深度思考时刻。在碎片化时代，能够保持长达两小时的心流状态是非常难得的“数字冥想”。",
    sourcePlatform: "知乎 · 哲学板块",
    sourceLink: "https://zhihu.com/xxx",
    tags: ["哲学", "心流", "深度思考"]
  }
];

export const reviewCards = [
  {
    title: "什么是 LoRA?",
    content: "一种微调大模型的高效技术，通过冻结预训练权重，在每一层注入可训练的秩分解矩阵。",
    source: "知乎 · AI 算法工程师"
  },
  {
    title: "设计心理学：锚定效应",
    content: "人们在做决策时，过度依赖最初获得的信息（即“锚”）。在UI设计中常用于价格方案的高对比呈现。",
    source: "B站 · 交互设计"
  }
];

export const wordCloudData = [
  { name: '大模型架构', value: 15000 },
  { name: 'React 19', value: 10081 },
  { name: 'Framer Motion', value: 9386 },
  { name: 'UI 设计心理学', value: 8500 },
  { name: '独立开发', value: 6000 },
  { name: '个人知识管理', value: 5500 },
  { name: 'WebGL 渲染', value: 4200 },
  { name: '播客访谈', value: 3800 },
  { name: '数字饮食', value: 3200 },
  { name: '微前端', value: 2500 }
];

export const historicalWordCloudData = [
  {
    date: '6天前',
    data: [
      { name: '个人知识管理', value: 14000 },
      { name: 'WebGL 渲染', value: 9000 },
      { name: 'React 19', value: 8000 },
      { name: '播客访谈', value: 5000 },
      { name: 'UI 设计心理学', value: 4000 }
    ]
  },
  {
    date: '5天前',
    data: [
      { name: '个人知识管理', value: 11000 },
      { name: 'WebGL 渲染', value: 10000 },
      { name: 'React 19', value: 9000 },
      { name: '独立开发', value: 7000 },
      { name: '数字饮食', value: 4500 }
    ]
  },
  {
    date: '4天前',
    data: [
      { name: 'WebGL 渲染', value: 13000 },
      { name: '微前端', value: 9500 },
      { name: 'React 19', value: 9000 },
      { name: '独立开发', value: 8000 },
      { name: '大模型架构', value: 5000 }
    ]
  },
  {
    date: '3天前',
    data: [
      { name: '微前端', value: 12000 },
      { name: 'React 19', value: 11000 },
      { name: '独立开发', value: 8000 },
      { name: 'UI 设计心理学', value: 6000 },
      { name: '大模型架构', value: 4000 }
    ]
  },
  {
    date: '2天前',
    data: [
      { name: 'React 19', value: 13000 },
      { name: '大模型架构', value: 8000 },
      { name: 'Framer Motion', value: 7500 },
      { name: '微前端', value: 7000 },
      { name: 'UI 设计心理学', value: 6500 }
    ]
  },
  {
    date: '昨天',
    data: [
      { name: '大模型架构', value: 12000 },
      { name: 'Framer Motion', value: 11000 },
      { name: 'React 19', value: 9000 },
      { name: 'UI 设计心理学', value: 8000 },
      { name: '个人知识管理', value: 5000 }
    ]
  },
  {
    date: '今天',
    data: wordCloudData
  }
];

// 模拟溯源数据映射
export const sourceMapping = {
  '大模型架构': [
    { title: '【深度】AI 时代的前端架构演进', platform: 'BILIBILI', time: '2小时前', category: '深度知识' },
    { title: '深入理解 MoE 混合专家模型', platform: 'ZHIHU', time: '昨天', category: '深度知识' }
  ],
  'React 19': [
    { title: 'React 19 新特性完全解析', platform: 'BILIBILI', time: '3小时前', category: '行业资讯' }
  ],
  'Framer Motion': [
    { title: 'Framer Motion 布局动画实战', platform: 'Bilibili', time: '11:45', category: '视频' },
    { title: 'React 动画终极指南', platform: '掘金', time: '09:20', category: '文章' }
  ]
};

// 饼图数据 (带具体小时数)
export const weeklyPieData = [
  { value: 35, hours: 8.5, name: '蛋白质', subName: '深度知识', itemStyle: { color: '#0EA5E9' } },
  { value: 25, hours: 6.0, name: '碳水化合物', subName: '实用资讯', itemStyle: { color: '#F59E0B' } },
  { value: 5, hours: 1.2, name: '膳食纤维', subName: '哲思冥想', itemStyle: { color: '#10B981' } },
  { value: 5, hours: 1.2, name: '维生素', subName: '创意灵感', itemStyle: { color: '#8B5CF6' } },
  { value: 30, hours: 7.2, name: '脂肪与糖分', subName: '娱乐短剧', itemStyle: { color: '#F43F5E' } }
];

export const dailyPieData = [
  { value: 40, hours: 1.5, name: '蛋白质', subName: '深度知识', itemStyle: { color: '#0EA5E9' } },
  { value: 30, hours: 1.1, name: '碳水化合物', subName: '实用资讯', itemStyle: { color: '#F59E0B' } },
  { value: 5, hours: 0.2, name: '膳食纤维', subName: '哲思冥想', itemStyle: { color: '#10B981' } },
  { value: 5, hours: 0.2, name: '维生素', subName: '创意灵感', itemStyle: { color: '#8B5CF6' } },
  { value: 20, hours: 0.8, name: '脂肪与糖分', subName: '娱乐短剧', itemStyle: { color: '#F43F5E' } }
];

// AI 联合语境洞察数据
export const weeklyAiInsight = {
  title: "本周数字饮食洞察",
  summary: "本周您在「娱乐短剧」上耗费了45%的时间，呈现出明显的**多巴胺代偿期**特征。但值得肯定的是，周三和周四对「大模型架构」与「前端动画」的集中攻坚，为您挽回了整体的营养价值。建议下周适当控制碎片化娱乐，将更多时间倾斜至您重点关注的「知识管理体系」。"
};

export const dailyAiInsight = {
  title: "今日数字饮食洞察",
  summary: "今天您的信息摄入极为**聚焦且硬核**！高达60%的深度知识摄入（主要集中在「个人知识管理」与「WebGL」），表明您正处于极佳的深度工作流中。今天几乎完全隔离了短视频干扰，这种“低多巴胺、高内聚”的摄入模式非常有助于长期记忆的构建，请继续保持！"
};
