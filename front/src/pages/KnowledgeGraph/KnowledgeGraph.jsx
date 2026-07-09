import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Camera, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import './KnowledgeGraph.css';

const CATEGORY_COLORS = {
  '深度知识': '#10B981',
  '实用技巧': '#0EA5E9',
  '行业资讯': '#F59E0B',
  '娱乐科普': '#F43F5E',
};

const CATEGORY_ORDER = ['深度知识', '实用技巧', '行业资讯', '娱乐科普'];
const MAX_LABEL_LENGTH = 5;
const HOVER_LABEL_LENGTH = 12;
const STORAGE_KEY = 'infodigest_knowledge_graph_categories';
const NODE_POSITIONS_KEY = 'infodigest_knowledge_graph_node_positions';

function getNodeWeight(item) {
  return item.hasNote ? 3 : 0;
}

function getConnectionStrength(a, b) {
  let strength = 0;
  if (a.category === b.category) strength += 0.4;
  const aTags = new Set(a.tags || []);
  const bTags = new Set(b.tags || []);
  const shared = [...aTags].filter(t => bTags.has(t)).length;
  strength += shared * 0.2;
  if (a.platform === b.platform) strength += 0.15;
  return Math.min(1, strength);
}

function buildGraphData(items, visibleCategories) {
  const premium = items.filter(item => item.hasNote);
  if (premium.length === 0) return { nodes: [], edges: [] };

  const filtered = premium.filter(item => !visibleCategories || visibleCategories.has(item.category));
  if (filtered.length === 0) return { nodes: [], edges: [] };

  const sorted = [...filtered].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return ai - bi;
  });

  const nodes = sorted.map((item) => {
    const weight = getNodeWeight(item);
    return {
      id: `premium-${item.id}`,
      size: 20 + weight * 4,
      data: {
        category: item.category,
        sourceTitle: item.title,
        summary: item.summary,
        note: item.note,
        tags: item.tags,
        platform: item.platform,
        author: item.author,
        duration: item.duration,
        date: item.date,
        hasNote: item.hasNote,
        aiPremium: item.aiPremium,
        userPremium: item.userPremium,
        weight,
      },
    };
  });

  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const strength = getConnectionStrength(sorted[i], sorted[j]);
      if (strength >= 0.4) {
        edges.push({
          id: `edge-${nodes[i].id}-${nodes[j].id}`,
          source: nodes[i].id,
          target: nodes[j].id,
          data: { strength },
        });
      }
    }
  }

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

function createGlassSphereFill(color, weight) {
  // Use a translucent tint of the category color
  const alpha = 0.22 + weight * 0.05;
  return hexToRgba(color, alpha);
}


export function KnowledgeGraph() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const focusedNodeRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [focusPosition, setFocusPosition] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const { items } = useInboxItems();

  // Keep ref in sync with state so event handlers in single-useEffect read latest value
  useEffect(() => {
    focusedNodeRef.current = focusedNode;
  }, [focusedNode]);

  const [visibleCategories, setVisibleCategories] = useState(() => {
    // 优先从localStorage加载用户的分类显示/隐藏设置
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return new Set(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load saved categories:', e);
      }
    }
    // 如果没有保存的设置，则初始化为所有优质信息源的分类
    const set = new Set();
    items.forEach(item => {
      if (item.hasNote) {
        set.add(item.category);
      }
    });
    return set;
  });

  const toggleCategory = (cat) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      // 保存到localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch (e) {
          console.warn('Failed to save categories:', e);
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    setVisibleCategories(prev => {
      const next = prev.size === CATEGORY_ORDER.length ? new Set([CATEGORY_ORDER[0]]) : new Set(CATEGORY_ORDER);
      // 保存到localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
        } catch (e) {
          console.warn('Failed to save categories:', e);
        }
      }
      return next;
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
    setFocusPosition(null);
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
    // 关闭抽屉时不重置 visibleCategories，保留用户的分类显示/隐藏设置
    // 只有在特定情况下才重置，例如当用户点击"重置分类"按钮时
  };

  const graphData = useMemo(() => buildGraphData(items, visibleCategories), [items, visibleCategories]);

  // Effect 1: Initialize graph ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;
    const { nodes, edges } = graphData;

    if (nodes.length === 0) return;

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      data: { nodes, edges },
      layout: {
        type: 'circular',
        radius: Math.min(width, height) * 0.36,
        divisions: CATEGORY_ORDER.length,
        ordering: 'topology',
        startAngle: 0,
        endAngle: 360,
      },
      animation: false,
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      node: {
        size: (model) => model.size || 24,
        style: (model) => {
          const cat = model.data?.category || '';
          const color = CATEGORY_COLORS[cat] || '#0EA5E9';
          const weight = model.data?.weight || 0;
          const isHighWeight = weight >= 4;
          return {
            fill: createGlassSphereFill(color, weight),
            fillOpacity: 0.95,
            stroke: color,
            strokeOpacity: 0.85,
            lineWidth: isHighWeight ? 2.5 : 1.5,
            shadowColor: color,
            shadowBlur: isHighWeight ? 28 : 14,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            cursor: 'pointer',
            labelText: model.id
              ? truncateLabel(model.data?.sourceTitle || model.id, MAX_LABEL_LENGTH)
              : '',
            labelFill: '#2a2a2a',
            labelFontSize: 10,
            labelFontWeight: 600,
            labelPlacement: 'bottom',
            labelOffsetY: 8,
            labelTextAlign: 'center',
            labelOffsetX: 0,
            labelBackgroundFill: 'rgba(255,255,255,0.78)',
            labelBackgroundRadius: 4,
            labelPadding: [3, 7],
            labelBackgroundOpacity: 0.9,
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
          const strength = model.data?.strength || 0.15;
          return {
            stroke: 'rgba(120,120,130,0.22)',
            strokeOpacity: 0.3 + strength * 0.5,
            lineWidth: 0.8 + strength * 2.2,
            lineDash: [4, 6],
          };
        },
        animate: {
          stroke: 'rgba(120,120,130,0.35)',
          lineDashOffset: -12,
          duration: 1200,
          iterations: Infinity,
          easing: 'linear',
        },
        state: {
          highlight: {
            strokeOpacity: 0.85,
            stroke: 'rgba(80,80,90,0.45)',
            lineWidth: (model) => 1 + (model.data?.strength || 0) * 2.5,
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

    // 如果有保存的节点位置，应用它们
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(NODE_POSITIONS_KEY);
        if (saved) {
          const savedPositions = JSON.parse(saved);
          const nodeData = graph.getNodeData();
          nodeData.forEach(node => {
            if (savedPositions[node.id]) {
              graph.updateNodeData({
                id: node.id,
                x: savedPositions[node.id].x,
                y: savedPositions[node.id].y,
              });
            }
          });
          graph.render();
        }
      } catch (e) {
        console.warn('Failed to apply saved node positions:', e);
      }
    }

    const handleClick = (e) => {
      const g = graphRef.current;
      if (!g) return;

      const nodeId = e.target?.id;
      if (!nodeId) return;

      const item = g.getNodeData(nodeId);
      const screenPos = e.canvas || g.getViewportCenter?.();

      setSelectedNode({
        title: item.data?.sourceTitle || item.id,
        ...item,
      });
      setFocusedNode(nodeId);
      setFocusPosition(screenPos);

      // Focus mode: highlight selected + neighbors, dim others
      const allNodes = g.getNodeData();
      const allEdges = g.getEdgeData();
      const neighbors = new Set([nodeId]);
      const connectedEdges = new Set();
      allEdges.forEach(edge => {
        if (edge.source === nodeId) {
          neighbors.add(edge.target);
          connectedEdges.add(edge.id);
        }
        if (edge.target === nodeId) {
          neighbors.add(edge.source);
          connectedEdges.add(edge.id);
        }
      });

      const stateMap = {};
      allNodes.forEach(node => {
        if (node.id === nodeId) stateMap[node.id] = 'focused';
        else if (neighbors.has(node.id)) stateMap[node.id] = 'highlight';
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
      if (selectedNode || focusedNode) {
        setSelectedNode(null);
        clearFocus();
      }
    };

    graph.on('node:click', handleClick);
    graph.on('canvas:click', handleCanvasClick);

    // 监听节点拖拽结束事件，保存节点位置
    const handleDragEnd = () => {
      try {
        const nodeData = graph.getNodeData();
        const positions = {};
        nodeData.forEach(node => {
          positions[node.id] = { x: node.x, y: node.y };
        });
        localStorage.setItem(NODE_POSITIONS_KEY, JSON.stringify(positions));
      } catch (e) {
        console.warn('Failed to save node positions:', e);
      }
    };

    graph.on('node:dragend', handleDragEnd);

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
      graph.off('node:dragend', handleDragEnd);
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: Update data when categories change
  useEffect(() => {
    if (!graphRef.current) return;
    const g = graphRef.current;
    if (g.destroyed || g.isDestroyed?.()) return;

    const { nodes, edges } = graphData;

    g.setData({ nodes, edges });
    try {
      // 优先使用localStorage保存的节点位置，若不存在则重新布局
      let savedPositions = null;
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(NODE_POSITIONS_KEY);
          if (saved) {
            savedPositions = JSON.parse(saved);
          }
        } catch (e) {
          console.warn('Failed to load saved node positions:', e);
        }
      }

      if (savedPositions) {
        // 应用保存的节点位置
        const nodeData = g.getNodeData();
        nodeData.forEach(node => {
          if (savedPositions[node.id]) {
            g.updateNodeData({
              id: node.id,
              x: savedPositions[node.id].x,
              y: savedPositions[node.id].y,
            });
          }
        });
        g.render();
      } else {
        // 没有保存的位置，使用布局算法重新布局
        g.layout();
        g.render();
      }
    } catch (err) {
      console.warn('Graph update failed:', err);
    }

    // Clear focus state after data update
    if (focusedNode) {
      clearFocus();
      setSelectedNode(null);
    }
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasCat = (cat) =>
    items.some(i => i.category === cat && i.hasNote);

  const allVisible = visibleCategories.size === CATEGORY_ORDER.length;

  return (
    <div className="knowledge-graph-page">
      {/* Top legend bar */}
      <div className="kg-legend-bar">
        <div className="kg-legend-bar-inner">
          <div className="kg-legend-items">
            {CATEGORY_ORDER.filter(hasCat).map(cat => (
              <button
                key={cat}
                className={`kg-legend-item ${visibleCategories.has(cat) ? 'active' : 'hidden'}`}
                onClick={() => toggleCategory(cat)}
                title={visibleCategories.has(cat) ? '点击隐藏' : '点击显示'}
              >
                <span className="kg-legend-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="kg-legend-label">{cat}</span>
                {visibleCategories.has(cat) ? <Eye size={12} /> : <EyeOff size={12} />}
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

      {/* Focus scrim overlay */}
      {focusedNode && focusPosition && (
        <div
          className="kg-focus-scrim"
          style={{
            '--focus-x': `${focusPosition.x}px`,
            '--focus-y': `${focusPosition.y}px`,
          }}
        />
      )}

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
