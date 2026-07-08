import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { initialInboxItems } from '../../mock/inboxData';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import './KnowledgeGraph.css';

const CATEGORY_COLORS = {
  '深度知识': '#10B981',
  '实用技巧': '#0EA5E9',
  '行业资讯': '#F59E0B',
  '娱乐科普': '#F43F5E',
};

const CATEGORY_ORDER = ['深度知识', '实用技巧', '行业资讯', '娱乐科普'];
const MAX_LABEL_LENGTH = 15;

function buildGraphData(items) {
  const premium = items.filter(item => item.hasNote || item.aiPremium || item.userPremium);

  if (premium.length === 0) return { nodes: [], edges: [] };

  // Sort by category so same-category nodes are contiguous on the circle
  const sorted = [...premium].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return ai - bi;
  });

  const nodes = sorted.map((item) => ({
    id: `premium-${item.id}`,
    size: 20,
    data: {
      category: item.category,
      sourceTitle: item.title,
      note: item.note,
      tags: item.tags,
      platform: item.platform,
      author: item.author,
      hasNote: item.hasNote,
      aiPremium: item.aiPremium,
      userPremium: item.userPremium,
    },
  }));

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const ni = sorted[i], nj = sorted[j];
      if (ni.category === nj.category) {
        edges.push({ source: nodes[i].id, target: nodes[j].id });
      }
    }
  }

  // Count connections per node to determine size
  const connCount = {};
  nodes.forEach(n => connCount[n.id] = 0);
  edges.forEach(e => {
    connCount[e.source] = (connCount[e.source] || 0) + 1;
    connCount[e.target] = (connCount[e.target] || 0) + 1;
  });
  nodes.forEach(n => {
    const c = connCount[n.id] || 0;
    if (c >= 4) n.size = 26;
    else if (c >= 2) n.size = 20;
    else n.size = 14;
  });

  return { nodes, edges, sortedItems: sorted };
}

export function KnowledgeGraph() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const { nodes, edges, sortedItems } = buildGraphData(initialInboxItems);

    if (nodes.length === 0) return;

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      data: { nodes, edges },
      layout: {
        type: 'circular',
        radius: Math.min(width, height) * 0.35,
        divisions: 1,
        ordering: 'topology',
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      node: {
        size: (model) => model.size || 20,
        style: (model) => {
          const cat = model.data?.category || '';
          const color = CATEGORY_COLORS[cat] || '#0EA5E9';
          return {
            fill: '#fff',
            stroke: color,
            lineWidth: 2,
            labelText: model.id
              ? (model.data?.sourceTitle || model.id).length > MAX_LABEL_LENGTH
                ? (model.data?.sourceTitle || model.id).slice(0, MAX_LABEL_LENGTH) + '…'
                : (model.data?.sourceTitle || model.id)
              : '',
            labelFill: '#1a1a1a',
            labelFontSize: 10,
            labelPlacement: 'bottom',
            labelBackgroundFill: 'rgba(255,255,255,0.88)',
            labelBackgroundRadius: 3,
            labelPadding: [2, 6],
          };
        },
      },
      edge: {
        style: {
          stroke: 'rgba(0,0,0,0.06)',
          lineWidth: 1,
        },
      },
      autoFit: 'view',
    });

    graph.render();
    graphRef.current = graph;

    graph.on('node:click', (e) => {
      const item = graph.getNodeData(e.target.id);
      setSelectedNode({
        title: item.data?.sourceTitle || item.id,
        ...item,
      });
    });

    // Hover: glow effect instead of size change (more reliable in G6 v8)
    graph.on('node:mouseenter', (e) => {
      const id = e.target.id;
      graph.updateNodeData([{
        id,
        style: { lineWidth: 4, shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.2)' },
      }]);
      graph.draw();
    });

    graph.on('node:mouseleave', (e) => {
      const id = e.target.id;
      graph.updateNodeData([{
        id,
        style: { lineWidth: 2, shadowBlur: 0, shadowColor: 'transparent' },
      }]);
      graph.draw();
    });

    const handleResize = () => {
      if (containerRef.current && graphRef.current) {
        graphRef.current.setSize(
          containerRef.current.clientWidth || 800,
          containerRef.current.clientHeight || 600
        );
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      graph.destroy();
    };
  }, []);

  const hasCat = (cat) =>
    initialInboxItems.some(i => i.category === cat && (i.hasNote || i.aiPremium || i.userPremium));

  return (
    <div className="knowledge-graph-page">
      <div className="kg-container" ref={containerRef}></div>

      <div className="kg-legend">
        <span className="kg-legend-title">图例</span>
        {CATEGORY_ORDER.filter(hasCat).map(cat => (
          <div key={cat} className="kg-legend-item">
            <span className="kg-legend-dot" style={{ background: CATEGORY_COLORS[cat] }} />
            <span className="kg-legend-label">{cat}</span>
          </div>
        ))}
      </div>

      <div className="kg-controls">
        <button onClick={() => graphRef.current?.zoomBy(1.2)} title="放大"><ZoomIn size={18} /></button>
        <button onClick={() => graphRef.current?.zoomBy(0.8)} title="缩小"><ZoomOut size={18} /></button>
        <button onClick={() => graphRef.current?.fitView()} title="适应画布"><Maximize size={18} /></button>
      </div>

      <DetailDrawer
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        data={selectedNode}
        sourceTitle={selectedNode?.title}
      />
    </div>
  );
}
