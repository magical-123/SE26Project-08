export const graphData = {
  nodes: [
    { id: '1', label: 'React', cluster: 'tech' },
    { id: '2', label: 'Vue', cluster: 'tech' },
    { id: '3', label: 'Framer Motion', cluster: 'tech' },
    { id: '4', label: 'WebGL', cluster: 'tech' },
    { id: '5', label: 'Glassmorphism', cluster: 'design' },
    { id: '6', label: 'UI/UX', cluster: 'design' },
    { id: '7', label: 'Cyberpunk', cluster: 'design' },
    { id: '8', label: '认知心理学', cluster: 'philosophy' },
    { id: '9', label: '信息过载', cluster: 'philosophy' },
    { id: '10', label: '数字极简', cluster: 'philosophy' },
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
  ]
};

for(let i=11; i<=50; i++) {
  const clusters = ['tech', 'design', 'philosophy'];
  const cluster = clusters[i % 3];
  graphData.nodes.push({ id: `${i}`, label: `概念 ${i}`, cluster });
  
  const targetId = Math.floor(Math.random() * (i - 1)) + 1;
  graphData.edges.push({ source: `${i}`, target: `${targetId}` });
  
  if (i % 3 === 0) {
    const targetId2 = Math.floor(Math.random() * (i - 1)) + 1;
    graphData.edges.push({ source: `${i}`, target: `${targetId2}` });
  }
}
