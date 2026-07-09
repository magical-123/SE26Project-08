export const reportData = {
  summary: {
    totalHours: 12.5,
    topTopic: '前端架构',
    efficiency: 85,
  },
  trend: [
    { date: '周一', value: 3 },
    { date: '周二', value: 4 },
    { date: '周三', value: 3.5 },
    { date: '周四', value: 5 },
    { date: '周五', value: 4.5 },
    { date: '周六', value: 7 },
    { date: '周日', value: 8 },
  ],
  weeklyTopicClusters: [
    { name: '前端动画工程', count: 12, tags: ['React', 'WebGL', 'Framer'] },
    { name: '大模型应用', count: 8, tags: ['LLM', 'Agent', 'RAG'] },
    { name: '效率工具', count: 5, tags: ['Notion', '知识图谱', 'PKM'] }
  ],
  dailyTopicClusters: [
    { name: '个人知识管理体系', count: 4, tags: ['PKM', 'Zettelkasten', '笔记法'] },
    { name: '前沿渲染技术', count: 3, tags: ['WebGL', 'Three.js'] }
  ]
};
