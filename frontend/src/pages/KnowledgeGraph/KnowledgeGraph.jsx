import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Graph } from '@antv/g6';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Camera, Sparkles, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import './KnowledgeGraph.css';

const MAX_LABEL_LENGTH = 5;

function getNodeWeight(item) {
  return item.hasNote ? 3 : 0;
}

function buildGraphData(premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap) {
  if (premiumItems.length === 0) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];

  // Calculate counts for each concept based on premium items
  const conceptCounts = {};
  conceptNodes.forEach(c => conceptCounts[c.id] = 0);

  premiumItems.forEach(item => {
    const itemConceptIds = sourceConceptMap[item.id] || [];
    itemConceptIds.forEach(cid => {
      if (conceptCounts[cid] !== undefined) conceptCounts[cid]++;
    });
  });

  // Only keep concepts that actually have premium items AND are visible
  const validConcepts = conceptNodes.filter(c => conceptCounts[c.id] > 0);
  const activeConcepts = validConcepts.filter(c => !visibleConcepts || visibleConcepts.has(c.id));
  
  const width = window.innerWidth || 800;
  const height = window.innerHeight || 600;
  const conceptRadius = Math.min(width, height) * 0.28 || 240; 
  const conceptPositions = {};
  
  // G6 v5 的画布原点 (0,0) 就是视口正中心
  const cx = 0;
  const cy = 0;

  // 计算总权重以分配角度
  const getWeight = (c) => Math.max(conceptCounts[c.id] || 0, 1);
  const totalWeight = activeConcepts.reduce((sum, c) => sum + getWeight(c), 0);
  let currentAngle = 0;

  activeConcepts.forEach((concept) => {
    const count = conceptCounts[concept.id] || 0;
    const weight = getWeight(concept);
    
    // 如果有保存的位置，直接使用；否则按圆形排列计算
    const saved = savedPositions[concept.id];
    let x, y;
    if (saved) {
      x = saved.x;
      y = saved.y;
    } else {
      const sliceAngle = (weight / totalWeight) * 2 * Math.PI;
      const centerAngle = currentAngle + sliceAngle / 2;
      x = cx + conceptRadius * Math.cos(centerAngle);
      y = cy + conceptRadius * Math.sin(centerAngle);
      currentAngle += sliceAngle;
    }

    const nodeSize = Math.min(40 + count * 6, 110);
    const sliceAngle = saved ? 0 : (weight / totalWeight) * 2 * Math.PI;

    conceptPositions[concept.id] = { x, y, color: concept.color, angle: 0, sliceAngle, size: nodeSize };

    nodes.push({
      id: concept.id,
      type: 'circle',
      x,
      y,
      size: nodeSize,
      data: { ...concept, type: 'concept', count, x, y, size: nodeSize }
    });

    currentAngle += sliceAngle;
  });

  const comboCounts = {};

  const singleDegreeItemsCount = {};
  premiumItems.forEach((item) => {
    const itemConceptIds = sourceConceptMap[item.id] || [];
    const activeItemConcepts = itemConceptIds.filter(cid => conceptPositions[cid]);
    if (activeItemConcepts.length === 1) {
      const cid = activeItemConcepts[0];
      singleDegreeItemsCount[cid] = (singleDegreeItemsCount[cid] || 0) + 1;
    }
  });
  const singleDegreeCount = {};

  // Add Source Nodes
  premiumItems.forEach((item) => {
    const itemConceptIds = sourceConceptMap[item.id] || [];
    const activeItemConcepts = itemConceptIds.filter(cid => conceptPositions[cid]);

    if (activeItemConcepts.length === 0) return;

    const sourceNodeId = `source-${item.id}`;
    const saved = savedPositions[sourceNodeId];

    const activeColors = activeItemConcepts.map(cid => conceptPositions[cid].color);
    const primaryColor = blendColors(activeColors);
    const secondaryColor = activeItemConcepts.length > 1 ? conceptPositions[activeItemConcepts[1]].color : null;

    let sx, sy;
    if (saved) {
      sx = saved.x;
      sy = saved.y;
    } else {
      sx = 0;
      sy = 0;

      const comboKey = activeItemConcepts.slice().sort().join(',');
      comboCounts[comboKey] = (comboCounts[comboKey] || 0) + 1;
      const localIndex = comboCounts[comboKey];

      if (activeItemConcepts.length === 1) {
        // 单节点：均匀分布在圆环外侧的弧线上
        const cid = activeItemConcepts[0];
        const pos = conceptPositions[cid];
        
        const totalSingles = singleDegreeItemsCount[cid] || 1;
        singleDegreeCount[cid] = (singleDegreeCount[cid] || 0);
        const localIndex = singleDegreeCount[cid]++;

        // 每圈最多排 4 个节点
        const orbit = Math.floor(localIndex / 4);
        const indexInOrbit = localIndex % 4;
        const itemsInThisOrbit = Math.min(4, totalSingles - orbit * 4);

        // 半径向外扩散
        const r = (pos.size / 2) + 35 + orbit * 40;

        // 在所属切片内均匀分布，留出 10% 的安全边距
        const safeSlice = pos.sliceAngle * 0.8; 
        let a = pos.angle;
        if (itemsInThisOrbit > 1) {
          const step = safeSlice / (itemsInThisOrbit - 1);
          a = pos.angle - (safeSlice / 2) + step * indexInOrbit;
        }
        
        sx = pos.x + Math.cos(a) * r;
        sy = pos.y + Math.sin(a) * r;
      } else {
        activeItemConcepts.forEach(cid => {
          sx += conceptPositions[cid].x;
          sy += conceptPositions[cid].y;
        });
        sx /= activeItemConcepts.length;
        sy /= activeItemConcepts.length;

        const jitterRadius = 12 + localIndex * 15;
        const angle = localIndex * 2.39996;
        sx += jitterRadius * Math.cos(angle);
        sy += jitterRadius * Math.sin(angle);
      }
    }

    const weight = getNodeWeight(item);

    const size = 20 + weight * 2;
    nodes.push({
      id: `source-${item.id}`,
      type: 'circle',
      x: sx,
      y: sy,
      size: size,
      data: {
        ...item,
        type: 'source',
        sourceTitle: item.title,
        primaryColor,
        secondaryColor,
        weight,
        conceptIds: activeItemConcepts,
        x: sx,
        y: sy,
        size: size
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

function blendColors(hexArray) {
  if (!hexArray || hexArray.length === 0) return '#ffffff';
  let r = 0, g = 0, b = 0;
  hexArray.forEach(hex => {
    r += parseInt(hex.slice(1, 3), 16);
    g += parseInt(hex.slice(3, 5), 16);
    b += parseInt(hex.slice(5, 7), 16);
  });
  const count = hexArray.length;
  r = Math.round(r / count).toString(16).padStart(2, '0');
  g = Math.round(g / count).toString(16).padStart(2, '0');
  b = Math.round(b / count).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedNode, setFocusedNode] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [savedPositions, setSavedPositions] = useState({});
  const [conceptNodes, setConceptNodes] = useState([]);
  const [sourceConceptMap, setSourceConceptMap] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const { items } = useInboxItems();

  // 从后端获取概念数据、映射关系和概念位置
  const API_BASE = 'http://localhost:8080';
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  // Fetch graph data and positions from API
  useEffect(() => {
    const headers = getAuthHeaders();
    Promise.all([
      fetch(`${API_BASE}/api/graph/data`, { headers }).then(res => res.ok ? res.json() : null),
      fetch(`${API_BASE}/api/graph/positions`, { headers }).then(res => res.ok ? res.json() : null),
    ])
      .then(([graphData, positionsData]) => {
        if (positionsData) {
          const posObj = typeof positionsData === 'object' && !Array.isArray(positionsData) ? positionsData : {};
          setSavedPositions(posObj);
        }
        if (graphData) {
          const nodes = (graphData.concepts || []).map(c => ({ ...c, id: `concept-${c.id}` }));
          setConceptNodes(nodes);

          const mapping = {};
          Object.entries(graphData.itemToConcepts || {}).forEach(([itemId, conceptIds]) => {
            mapping[Number(itemId)] = conceptIds.map(cid => `concept-${cid}`);
          });
          setSourceConceptMap(mapping);

          setVisibleConcepts(new Set(nodes.map(n => n.id)));
        }
        setDataLoading(false);
      })
      .catch(() => {
        setDataLoading(false);
      });
  }, []);

  const savePositions = async (positions) => {
    try {
      await fetch(`${API_BASE}/api/graph/positions`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(positions)
      });
    } catch {}
  };

  // Keep ref in sync with state so event handlers read latest value
  useEffect(() => {
    focusedNodeRef.current = focusedNode;
  }, [focusedNode]);

  const [visibleConcepts, setVisibleConcepts] = useState(new Set());

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
    setVisibleConcepts(new Set(conceptNodes.map(c => c.id)));
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
    setIsDrawerOpen(false);
  };

  const graphData = useMemo(() => {
    const premiumItems = (items || []).filter(item => item.hasNote);
    return buildGraphData(premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap);
  }, [items, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap]);

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
        setIsDrawerOpen(false);
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
      animation: false,
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      node: {
        style: {
          x: (model) => model.data?.x,
          y: (model) => model.data?.y,
          size: (model) => model.data?.size || 24,
          r: (model) => (model.data?.size || 24) / 2,
          fill: (model) => model.data?.type === 'concept' ? hexToRgba(model.data.color, 0.15) : hexToRgba(model.data.primaryColor || '#ffffff', 0.25),
          stroke: (model) => model.data?.type === 'concept' ? model.data.color : (model.data.primaryColor || 'rgba(255, 255, 255, 0.8)'),
          lineWidth: (model) => model.data?.type === 'concept' ? 2.5 : 1.5,
          shadowColor: (model) => model.data?.type === 'concept' ? model.data.color : (model.data.primaryColor ? hexToRgba(model.data.primaryColor, 0.6) : 'rgba(255, 255, 255, 0.6)'),
          shadowBlur: (model) => model.data?.type === 'concept' ? 32 : 16,
          cursor: 'pointer',
          labelText: (model) => {
            if (model.data?.type === 'concept') return model.data.label;
            return model.id ? truncateLabel(model.data?.sourceTitle || model.id, MAX_LABEL_LENGTH) : '';
          },
          labelFill: '#2a2a2a',
          labelFontSize: (model) => model.data?.type === 'concept' ? 12 : 10,
          labelFontWeight: (model) => model.data?.type === 'concept' ? 700 : 600,
          labelPlacement: (model) => model.data?.type === 'concept' ? 'center' : 'bottom',
          labelOffsetY: (model) => model.data?.type === 'concept' ? 0 : 8,
          labelBackgroundFill: (model) => model.data?.type === 'concept' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.78)',
          labelBackgroundRadius: 4,
          labelPadding: (model) => model.data?.type === 'concept' ? [4, 8] : [3, 7],
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
          authorHighlight: {
            fill: 'rgba(251, 191, 36, 0.4)',
            stroke: '#FBBF24',
            lineWidth: 3,
            shadowColor: '#FBBF24',
            shadowBlur: 30,
            labelFillOpacity: 1,
            zIndex: 15,
          },
          dim: {
            fillOpacity: 0.1,
            strokeOpacity: 0.1,
            shadowBlur: 0,
            labelFillOpacity: 0.1,
            zIndex: 0,
          },
          focused: {
            lineWidth: 4,
            shadowBlur: 56,
            stroke: '#FFFFFF',
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
          const color = model.data?.color || 'rgba(156, 163, 175, 0.5)';
          return {
            stroke: color,
            strokeOpacity: 0.35,
            lineWidth: 1,
          };
        },
        state: {
          highlight: {
            stroke: '#FBBF24',
            strokeOpacity: 1,
            lineWidth: 3,
            shadowColor: '#FBBF24',
            shadowBlur: 12,
            zIndex: 5,
          },
          dim: {
            strokeOpacity: 0.1,
            zIndex: 0,
          },
        },
      },
      zoomable: 'view',
    });

    graph.render();
    graph.fitView();
    graphRef.current = graph;

    // --- Event Handlers ---
    const updateHighlightState = (targetNodeId) => {
      const g = graphRef.current;
      if (!g) return;
      const allNodes = g.getNodeData();
      const allEdges = g.getEdgeData();

      if (!targetNodeId) {
        const stateMap = {};
        allNodes.forEach(node => { stateMap[node.id] = []; });
        allEdges.forEach(edge => { stateMap[edge.id] = []; });
        try { g.setElementState(stateMap); } catch {}
        return;
      }

      const item = g.getNodeData(targetNodeId);
      const isConcept = item.data?.type === 'concept';

      const highlights = new Set([targetNodeId]);
      const authorHighlights = new Set();
      const connectedEdges = new Set();

      if (isConcept) {
        allEdges.forEach(edge => {
          if (edge.target === targetNodeId) {
            highlights.add(edge.source);
            connectedEdges.add(edge.id);
          }
        });
      } else {
        const author = item.data?.author;
        allEdges.forEach(edge => {
          if (edge.source === targetNodeId) {
            highlights.add(edge.target);
            connectedEdges.add(edge.id);
          }
        });

        if (author) {
          allNodes.forEach(node => {
            if (node.data?.type === 'source' && node.data?.author === author && node.id !== targetNodeId) {
              authorHighlights.add(node.id);
            }
          });
        }
      }

      const stateMap = {};
      allNodes.forEach(node => {
        if (node.id === targetNodeId) stateMap[node.id] = 'focused';
        else if (authorHighlights.has(node.id)) stateMap[node.id] = 'authorHighlight';
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

    const handleClick = (e) => {
      const g = graphRef.current;
      if (!g) return;

      const nodeId = e.target?.id;
      if (!nodeId) return;

      const item = g.getNodeData(nodeId);
      const isConcept = item.data?.type === 'concept';

      if (isConcept) {
        setSelectedNode(null);
        setIsDrawerOpen(false);
      } else {
        setSelectedNode({
          title: item.data?.sourceTitle || item.id,
          ...item,
        });
        setIsDrawerOpen(true);
      }
      setFocusedNode(nodeId);
      updateHighlightState(nodeId);
    };

    const handleMouseEnter = (e) => {
      const nodeId = e.target?.id;
      if (!nodeId) return;
      // If a node is already clicked and focused, don't override with hover
      if (!focusedNodeRef.current) {
        updateHighlightState(nodeId);
      }
    };

    const handleMouseLeave = () => {
      // Revert to clicked node's highlight state, or clear if none
      updateHighlightState(focusedNodeRef.current);
    };

    const handleCanvasClick = () => {
      setSelectedNode(null);
      setFocusedNode(null);
      updateHighlightState(null);
      setIsDrawerOpen(false);
    };

    graph.on('node:click', handleClick);
    graph.on('node:mouseenter', handleMouseEnter);
    graph.on('node:mouseleave', handleMouseLeave);
    graph.on('canvas:click', handleCanvasClick);

    // 拖拽结束后保存所有节点位置
    const handleDragEnd = (e) => {
      if (!graphRef.current) return;

      const allNodes = graphRef.current.getNodeData();
      const positions = [];
      const posMap = {};

      allNodes.forEach(node => {
        // drag-element 更新了顶层 x/y，同步到 data.x/y 以便 style 函数读取
        if (node.x != null) {
          node.data = node.data || {};
          node.data.x = node.x;
          node.data.y = node.y;
          positions.push({ nodeId: node.id, posX: node.x, posY: node.y });
          posMap[node.id] = { x: node.x, y: node.y };
        }
      });

      setSavedPositions(prev => ({ ...prev, ...posMap }));
      savePositions(positions);
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
      graph.off('node:mouseenter', handleMouseEnter);
      graph.off('node:mouseleave', handleMouseLeave);
      graph.off('canvas:click', handleCanvasClick);
      graph.off('node:dragend', handleDragEnd);
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

  const validConcepts = useMemo(() => {
    const counts = {};
    conceptNodes.forEach(c => counts[c.id] = 0);
    (items || []).filter(item => item.hasNote).forEach(item => {
      const cids = sourceConceptMap[item.id] || [];
      cids.forEach(cid => { if (counts[cid] !== undefined) counts[cid]++; });
    });
    return conceptNodes.filter(c => counts[c.id] > 0);
  }, [items, conceptNodes, sourceConceptMap]);

  const allVisible = conceptNodes.length > 0 && validConcepts.every(c => visibleConcepts.has(c.id));

  return (
    <div className="knowledge-graph-page">
      {/* Top legend bar */}
      <div className="kg-legend-bar">
        <div className="kg-legend-bar-inner">
          <div className="kg-legend-items">
            {conceptNodes.map(concept => (
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
          <button 
            className={`kg-legend-toggle-all ${allVisible ? 'disabled' : ''}`}
            onClick={toggleAll}
            disabled={allVisible}
            style={{ opacity: allVisible ? 0.5 : 1, cursor: allVisible ? 'default' : 'pointer' }}
          >
            <Eye size={12} />
            <span>全显示</span>
          </button>
        </div>
      </div>

      <div className="kg-container" ref={containerRef}>
        {conceptNodes.length === 0 && (
          <div className="kg-empty-state">
            <Sparkles size={32} />
            <span>暂无数据</span>
          </div>
        )}
      </div>

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
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        data={selectedNode}
        sourceTitle={selectedNode?.title}
      />
    </div>
  );
}
