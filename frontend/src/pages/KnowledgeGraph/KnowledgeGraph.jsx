import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Camera, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import './KnowledgeGraph.css';

const MAX_LABEL_LENGTH = 5;

const CONCEPT_NODES = [
  { id: 'concept-frontend-arch', label: '前端架构演进', color: '#10B981' },
  { id: 'concept-ai-trend', label: 'AI 行业动态', color: '#F59E0B' },
  { id: 'concept-design-system', label: '设计系统', color: '#0EA5E9' },
  { id: 'concept-animation', label: '动效与交互', color: '#8B5CF6' },
  { id: 'concept-science-pop', label: '科学科普', color: '#F43F5E' },
  { id: 'concept-productivity', label: '效率与认知', color: '#EC4899' },
];

// 每个 sourceId 可属于多个 conceptId
const SOURCE_CONCEPT_MAP = {
  1: ['concept-frontend-arch', 'concept-ai-trend'], // AI时代的前端架构演进
  2: ['concept-animation', 'concept-frontend-arch'], // 如何用 React 实现丝滑的弹簧动画
  3: ['concept-ai-trend', 'concept-productivity'], // 硅谷创业播客
  4: ['concept-science-pop'], // 三分钟看懂量子力学
  5: ['concept-frontend-arch', 'concept-animation'], // Framer Motion
  6: ['concept-design-system', 'concept-productivity'], // 设计系统搭建
  7: ['concept-frontend-arch', 'concept-ai-trend'], // 2026 前端技术趋势展望
  8: ['concept-ai-trend'], // 大模型推理成本
  9: ['concept-science-pop'], // 幽默科普：黑洞是什么
  10: ['concept-frontend-arch', 'concept-design-system'], // TypeScript高级类型体操
};

function getNodeWeight(item) {
  return item.hasNote ? 3 : 0;
}

function buildGraphData(premiumItems, visibleConcepts) {
  if (premiumItems.length === 0) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];

  // Calculate counts for each concept based on premium items
  const conceptCounts = {};
  CONCEPT_NODES.forEach(c => conceptCounts[c.id] = 0);

  premiumItems.forEach(item => {
    const itemConceptIds = SOURCE_CONCEPT_MAP[item.id] || [];
    itemConceptIds.forEach(cid => {
      if (conceptCounts[cid] !== undefined) conceptCounts[cid]++;
    });
  });

  // Only keep concepts that actually have premium items AND are visible
  const validConcepts = CONCEPT_NODES.filter(c => conceptCounts[c.id] > 0);
  const activeConcepts = validConcepts.filter(c => !visibleConcepts || visibleConcepts.has(c.id));
  const conceptRadius = 260;

  const conceptPositions = {};

  activeConcepts.forEach((concept, index) => {
    const angle = (2 * Math.PI / activeConcepts.length) * index;
    const x = conceptRadius * Math.cos(angle);
    const y = conceptRadius * Math.sin(angle);

    conceptPositions[concept.id] = { x, y, color: concept.color };

    const count = conceptCounts[concept.id];

    nodes.push({
      id: concept.id,
      type: 'circle',
      size: 56,
      data: {
        label: concept.label,
        color: concept.color,
        count,
        type: 'concept',
        x,
        y
      }
    });
  });

  const comboCounts = {};

  // Add Source Nodes
  premiumItems.forEach((item) => {
    const itemConceptIds = SOURCE_CONCEPT_MAP[item.id] || [];
    const activeItemConcepts = itemConceptIds.filter(cid => conceptPositions[cid]);

    if (activeItemConcepts.length === 0) return;

    const comboKey = activeItemConcepts.slice().sort().join(',');
    comboCounts[comboKey] = (comboCounts[comboKey] || 0) + 1;
    const localIndex = comboCounts[comboKey];

    let x = 0;
    let y = 0;
    const primaryColor = conceptPositions[activeItemConcepts[0]].color;
    const secondaryColor = activeItemConcepts.length > 1 ? conceptPositions[activeItemConcepts[1]].color : null;

    if (activeItemConcepts.length === 1) {
      const cid = activeItemConcepts[0];
      const pos = conceptPositions[cid];
      const innerRadius = 75 + localIndex * 8;
      const angle = localIndex * 2.39996; // Golden ratio spread
      x = pos.x + innerRadius * Math.cos(angle);
      y = pos.y + innerRadius * Math.sin(angle);
    } else {
      activeItemConcepts.forEach(cid => {
        x += conceptPositions[cid].x;
        y += conceptPositions[cid].y;
      });
      x /= activeItemConcepts.length;
      y /= activeItemConcepts.length;

      const jitterRadius = 12 + localIndex * 15;
      const angle = localIndex * 2.39996;
      x += jitterRadius * Math.cos(angle);
      y += jitterRadius * Math.sin(angle);
    }

    const weight = getNodeWeight(item);

    nodes.push({
      id: `source-${item.id}`,
      type: 'circle',
      size: 20 + weight * 2,
      data: {
        ...item,
        type: 'source',
        sourceTitle: item.title,
        primaryColor,
        secondaryColor,
        weight,
        conceptIds: activeItemConcepts,
        x,
        y
      }
    });

    activeItemConcepts.forEach(cid => {
      edges.push({
        id: `edge-${item.id}-${cid}`,
        source: `source-${item.id}`,
        target: cid,
        data: {
          type: 'belongs',
          color: conceptPositions[cid].color
        }
      });
    });
  });

  return { nodes, edges };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function truncateLabel(text, len) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '…' : text;
}


export function KnowledgeGraph() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const focusedNodeRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const { items } = useInboxItems();

  // Keep ref in sync with state so event handlers read latest value
  useEffect(() => {
    focusedNodeRef.current = focusedNode;
  }, [focusedNode]);

  const [visibleConcepts, setVisibleConcepts] = useState(() => {
    return new Set(CONCEPT_NODES.map(c => c.id));
  });

  const toggleConcept = (conceptId) => {
    setVisibleConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        if (next.size > 1) next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setVisibleConcepts(prev => {
      if (prev.size === CONCEPT_NODES.length) {
        return new Set([CONCEPT_NODES[0].id]);
      }
      return new Set(CONCEPT_NODES.map(c => c.id));
    });
  };

  const exportImage = () => {
    if (!graphRef.current) return;
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'knowledge-graph.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const clearFocus = () => {
    setFocusedNode(null);
    const g = graphRef.current;
    if (!g) return;
    try {
      const allNodes = g.getNodeData();
      const allEdges = g.getEdgeData();
      const stateMap = {};
      allNodes.forEach(node => { stateMap[node.id] = []; });
      allEdges.forEach(edge => { stateMap[edge.id] = []; });
      g.setElementState(stateMap);
    } catch {}
  };

  const handleDrawerClose = () => {
    setSelectedNode(null);
    clearFocus();
    setVisibleConcepts(new Set(CONCEPT_NODES.map(c => c.id)));
  };

  const graphData = useMemo(() => {
    const premiumItems = (items || []).filter(item => item.hasNote);
    return buildGraphData(premiumItems, visibleConcepts);
  }, [items, visibleConcepts]);

  // Unified effect: create graph on first valid data, update on subsequent changes
  useEffect(() => {
    if (!containerRef.current) return;

    const { nodes, edges } = graphData;
    if (nodes.length === 0) return;

    // If graph already exists, just update data
    if (graphRef.current) {
      const g = graphRef.current;
      if (g.destroyed || g.isDestroyed?.()) return;

      g.setData({ nodes, edges });
      try {
        g.render();
      } catch (err) {
        console.warn('Graph update failed:', err);
      }

      if (focusedNodeRef.current) {
        clearFocus();
        setSelectedNode(null);
      }
      return; // Don't recreate graph
    }

    // First time: create the graph
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      data: { nodes, edges },
      layout: {
        type: 'preset',
      },
      animation: false,
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      node: {
        size: (model) => model.size || 24,
        style: (model) => {
          const type = model.data?.type;
          const color = type === 'concept' ? model.data.color : (model.data?.primaryColor || '#0EA5E9');
          const isConcept = type === 'concept';
          const x = model.data?.x;
          const y = model.data?.y;

          if (isConcept) {
            return {
              x,
              y,
              fill: hexToRgba(color, 0.3),
              stroke: color,
              lineWidth: 2.5,
              shadowColor: color,
              shadowBlur: 32,
              cursor: 'pointer',
              labelText: model.data.label,
              labelFill: '#2a2a2a',
              labelFontSize: 12,
              labelFontWeight: 700,
              labelPlacement: 'center',
              labelBackgroundFill: 'rgba(255,255,255,0.85)',
              labelBackgroundRadius: 4,
              labelPadding: [4, 8],
            };
          }

          // Source Node Style
          const weight = model.data?.weight || 0;
          const hasSecondary = !!model.data?.secondaryColor;

          return {
            x,
            y,
            fill: hexToRgba(color, 0.22 + weight * 0.05),
            stroke: color,
            lineWidth: 1.5,
            shadowColor: color,
            shadowBlur: 12,
            lineDash: hasSecondary ? [4, 4] : undefined,
            cursor: 'pointer',
            labelText: model.id
              ? truncateLabel(model.data?.sourceTitle || model.id, MAX_LABEL_LENGTH)
              : '',
            labelFill: '#2a2a2a',
            labelFontSize: 10,
            labelFontWeight: 600,
            labelPlacement: 'bottom',
            labelOffsetY: 8,
            labelBackgroundFill: 'rgba(255,255,255,0.78)',
            labelBackgroundRadius: 4,
            labelPadding: [3, 7],
          };
        },
        state: {
          highlight: {
            fillOpacity: 1,
            strokeOpacity: 1,
            lineWidth: 3.5,
            shadowBlur: 42,
            labelFillOpacity: 1,
            zIndex: 10,
          },
          dim: {
            fillOpacity: 0.18,
            strokeOpacity: 0.15,
            shadowBlur: 0,
            labelFillOpacity: 0.1,
            zIndex: 0,
          },
          focused: {
            lineWidth: 4,
            shadowBlur: 56,
            stroke: '#FBBF24',
            labelFillOpacity: 1,
            zIndex: 20,
          },
        },
        tooltip: (model) => {
          const d = model.data || {};
          if (d.type === 'concept') {
            return {
              title: d.label,
              content: `包含 ${d.count} 个优质信息源`
            };
          }

          const badges = [];
          if (d.hasNote) badges.push('📝 已记录');
          if (d.aiPremium) badges.push('✨ AI推荐');
          if (d.userPremium) badges.push('⭐ 用户标记');
          return {
            title: d.sourceTitle || model.id,
            content: [
              `分类: ${d.category || '-'}`,
              `平台: ${d.platform || '-'}`,
              `作者: ${d.author || '-'}`,
              badges.length ? `标识: ${badges.join(' · ')}` : '',
              d.note ? `笔记: ${d.note.slice(0, 60)}${d.note.length > 60 ? '…' : ''}` : '',
            ].filter(Boolean).join('\n'),
          };
        },
      },
      edge: {
        style: (model) => {
          const color = model.data?.color || '#999';
          return {
            stroke: color,
            strokeOpacity: 0.35,
            lineWidth: 1,
          };
        },
        state: {
          highlight: {
            strokeOpacity: 0.7,
            lineWidth: 1.5,
            zIndex: 5,
          },
          dim: {
            strokeOpacity: 0.04,
            zIndex: 0,
          },
        },
      },
      autoFit: 'view',
    });

    graph.render();
    graphRef.current = graph;

    // --- Event Handlers ---
    const handleClick = (e) => {
      const g = graphRef.current;
      if (!g) return;

      const nodeId = e.target?.id;
      if (!nodeId) return;

      const item = g.getNodeData(nodeId);
      const isConcept = item.data?.type === 'concept';

      if (isConcept) {
        setSelectedNode(null);
      } else {
        setSelectedNode({
          title: item.data?.sourceTitle || item.id,
          ...item,
        });
      }
      setFocusedNode(nodeId);

      const allNodes = g.getNodeData();
      const allEdges = g.getEdgeData();

      const highlights = new Set([nodeId]);
      const connectedEdges = new Set();

      if (isConcept) {
        // Clicked Concept: Highlight concept + its sources
        allEdges.forEach(edge => {
          if (edge.target === nodeId) {
            highlights.add(edge.source);
            connectedEdges.add(edge.id);
          }
        });
      } else {
        // Clicked Source: Highlight source + its concepts + same-author nodes
        const author = item.data?.author;

        allEdges.forEach(edge => {
          if (edge.source === nodeId) {
            highlights.add(edge.target);
            connectedEdges.add(edge.id);
          }
        });

        if (author) {
          allNodes.forEach(node => {
            if (node.data?.type === 'source' && node.data?.author === author) {
              highlights.add(node.id);
            }
          });
        }
      }

      const stateMap = {};
      allNodes.forEach(node => {
        if (node.id === nodeId) stateMap[node.id] = 'focused';
        else if (highlights.has(node.id)) stateMap[node.id] = 'highlight';
        else stateMap[node.id] = 'dim';
      });
      allEdges.forEach(edge => {
        stateMap[edge.id] = connectedEdges.has(edge.id) ? 'highlight' : 'dim';
      });

      try {
        g.setElementState(stateMap);
      } catch {}
    };

    const handleCanvasClick = () => {
      setSelectedNode(null);
      clearFocus();
    };

    graph.on('node:click', handleClick);
    graph.on('canvas:click', handleCanvasClick);

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
      graph.off('node:click', handleClick);
      graph.off('canvas:click', handleCanvasClick);
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

  const validConcepts = useMemo(() => {
    const counts = {};
    CONCEPT_NODES.forEach(c => counts[c.id] = 0);
    (items || []).filter(item => item.hasNote).forEach(item => {
      const cids = SOURCE_CONCEPT_MAP[item.id] || [];
      cids.forEach(cid => { if (counts[cid] !== undefined) counts[cid]++; });
    });
    return CONCEPT_NODES.filter(c => counts[c.id] > 0);
  }, [items]);

  const allVisible = visibleConcepts.size === CONCEPT_NODES.length;

  return (
    <div className="knowledge-graph-page">
      {/* Top legend bar */}
      <div className="kg-legend-bar">
        <div className="kg-legend-bar-inner">
          <div className="kg-legend-items">
            {validConcepts.map(concept => (
              <button
                key={concept.id}
                className={`kg-legend-item ${visibleConcepts.has(concept.id) ? 'active' : 'hidden'}`}
                onClick={() => toggleConcept(concept.id)}
                title={visibleConcepts.has(concept.id) ? '点击隐藏' : '点击显示'}
              >
                <span className="kg-legend-dot" style={{ background: concept.color }} />
                <span className="kg-legend-label">{concept.label}</span>
                {visibleConcepts.has(concept.id) ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
            ))}
          </div>
          <button className="kg-legend-toggle-all" onClick={toggleAll}>
            {allVisible ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{allVisible ? '仅首个' : '全显示'}</span>
          </button>
        </div>
      </div>

      <div className="kg-container" ref={containerRef}></div>

      {/* Floating control cube panel */}
      <div className={`kg-control-cube ${isPanelOpen ? 'open' : ''}`}>
        <button
          className="kg-cube-toggle"
          onClick={() => setIsPanelOpen(v => !v)}
          title={isPanelOpen ? '收起控制面板' : '展开控制面板'}
        >
          <SlidersHorizontal size={16} />
          {isPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        <div className="kg-cube-body">
          {/* Controls */}
          <div className="kg-cube-section">
            <div className="kg-cube-section-title">视图</div>
            <div className="kg-cube-controls">
              <button onClick={() => graphRef.current?.zoomBy(1.2)} title="放大"><ZoomIn size={16} /></button>
              <button onClick={() => graphRef.current?.zoomBy(0.8)} title="缩小"><ZoomOut size={16} /></button>
              <button onClick={() => graphRef.current?.fitView()} title="适应画布"><Maximize size={16} /></button>
              <button onClick={exportImage} title="导出图片"><Camera size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="kg-tip">
        <Sparkles size={12} />
        <span>点击节点查看详情</span>
      </div>

      <DetailDrawer
        isOpen={!!selectedNode}
        onClose={handleDrawerClose}
        data={selectedNode}
        sourceTitle={selectedNode?.title}
      />
    </div>
  );
}
