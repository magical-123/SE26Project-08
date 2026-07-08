export const graphData = {
  nodes: [
    { id: '1', label: 'React', cluster: 'tech', combo: 'tech' },
    { id: '2', label: 'Vue', cluster: 'tech', combo: 'tech' },
    { id: '3', label: 'Framer Motion', cluster: 'tech', combo: 'tech' },
    { id: '4', label: 'WebGL', cluster: 'tech', combo: 'tech' },
    { id: '5', label: 'Glassmorphism', cluster: 'design', combo: 'design' },
    { id: '6', label: 'UI/UX', cluster: 'design', combo: 'design' },
    { id: '7', label: 'Cyberpunk', cluster: 'design', combo: 'design' },
    { id: '8', label: '认知心理学', cluster: 'philosophy', combo: 'philosophy' },
    { id: '9', label: '信息过载', cluster: 'philosophy', combo: 'philosophy' },
    { id: '10', label: '数字极简', cluster: 'philosophy', combo: 'philosophy' },
  ],
  edges: [
    { source: '1', target: '3' },
    { source: '1', target: '2' },
    { source: '3', target: '4' },
    { source: '5', target: '6' },
    { source: '6', target: '8' },
    { source: '8', target: '9' },
    { source: '9', target: '10' },
    { source: '4', target: '7' },
    { source: '7', target: '5' },
    { source: '1', target: '6' },
  ],
  combos: [
    { id: 'tech', label: '技术生态', color: '#10B981' },
    { id: 'design', label: '设计美学', color: '#F59E0B' },
    { id: 'philosophy', label: '认知哲学', color: '#F43F5E' },
  ]
};

for(let i=11; i<=50; i++) {
  const clusters = ['tech', 'design', 'philosophy'];
  const cluster = clusters[i % 3];
  graphData.nodes.push({ id: `${i}`, label: `概念 ${i}`, cluster, combo: cluster });
  
  const targetId = Math.floor(Math.random() * (i - 1)) + 1;
  graphData.edges.push({ source: `${i}`, target: `${targetId}` });
  
  if (i % 3 === 0) {
    const targetId2 = Math.floor(Math.random() * (i - 1)) + 1;
    graphData.edges.push({ source: `${i}`, target: `${targetId2}` });
  }
}
