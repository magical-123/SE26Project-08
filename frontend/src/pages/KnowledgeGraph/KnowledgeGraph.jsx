import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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
      type: 'concept',
      position: { x, y },
      data: { ...concept, type: 'concept', count, size: nodeSize }
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
      type: 'source',
      position: { x: sx, y: sy },
      data: {
        ...item,
        type: 'source',
        sourceTitle: item.title,
        primaryColor,
        secondaryColor,
        weight,
        conceptIds: activeItemConcepts,
        size
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
  return text.length > len ? text.slice(0, len) + '\u2026' : text;
}

/* ------------------------------------------------------------------ */
/*  Custom Node: ConceptNode                                           */
/* ------------------------------------------------------------------ */
function ConceptNode({ data }) {
  const size = data.size || 60;
  const color = data.color || '#888';
  const dimmed = data.dimmed;
  const highlighted = data.highlighted;
  const authorHighlight = data.authorHighlight;
  const isFocused = data.isFocused;

  const bgColor = hexToRgba(color, 0.15);
  let borderColor = color;
  let borderWidth = 2.5;
  let shadowColor = color;
  let shadowBlur = 32;

  if (isFocused) {
    borderColor = '#FFFFFF';
    borderWidth = 4;
    shadowBlur = 56;
  } else if (authorHighlight) {
    borderColor = '#FBBF24';
    borderWidth = 3;
    shadowColor = '#FBBF24';
    shadowBlur = 30;
  } else if (highlighted) {
    borderWidth = 3.5;
    shadowBlur = 42;
  }

  const opacity = dimmed ? 0.1 : 1;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bgColor,
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow: `0 0 ${shadowBlur}px ${shadowColor}`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
    >
      <span
        style={{
          background: 'rgba(255,255,255,0.85)',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          color: '#2a2a2a',
          maxWidth: size - 16,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
      >
        {data.label || ''}
      </span>
      <Handle
        type="source"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'transparent', border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'transparent', border: 'none' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom Node: SourceNode                                            */
/* ------------------------------------------------------------------ */
function SourceNode({ data }) {
  const size = data.size || 24;
  const primaryColor = data.primaryColor || '#ffffff';
  const dimmed = data.dimmed;
  const highlighted = data.highlighted;
  const authorHighlight = data.authorHighlight;
  const isFocused = data.isFocused;
  const label = truncateLabel(data.sourceTitle || '', MAX_LABEL_LENGTH);

  let bgColor = hexToRgba(primaryColor, 0.25);
  let borderColor = primaryColor;
  let borderWidth = 1.5;
  let shadowColor = primaryColor ? hexToRgba(primaryColor, 0.6) : 'rgba(255, 255, 255, 0.6)';
  let shadowBlur = 16;

  if (isFocused) {
    borderColor = '#FFFFFF';
    borderWidth = 4;
    shadowBlur = 56;
  } else if (authorHighlight) {
    bgColor = 'rgba(251, 191, 36, 0.4)';
    borderColor = '#FBBF24';
    borderWidth = 3;
    shadowColor = '#FBBF24';
    shadowBlur = 30;
  } else if (highlighted) {
    borderColor = '#FFFFFF';
    borderWidth = 3.5;
    shadowBlur = 42;
  }

  const opacity = dimmed ? 0.1 : 1;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity,
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bgColor,
          border: `${borderWidth}px solid ${borderColor}`,
          boxShadow: `0 0 ${shadowBlur}px ${shadowColor}`,
          cursor: 'pointer',
        }}
      />
      {label && (
        <span
          style={{
            background: 'rgba(255,255,255,0.78)',
            padding: '3px 7px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 600,
            color: '#2a2a2a',
            marginTop: 4,
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'transparent', border: 'none' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner component (all logic lives here)                             */
/* ------------------------------------------------------------------ */
function KnowledgeGraphInner() {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const focusedNodeIdRef = useRef(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [savedPositions, setSavedPositions] = useState({});
  const [conceptNodes, setConceptNodes] = useState([]);
  const [sourceConceptMap, setSourceConceptMap] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const { items } = useInboxItems();
  const reactFlowInstance = useReactFlow();
  const isDraggingRef = useRef(false);
  const initialPositionsSavedRef = useRef(false);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Read saved viewport from localStorage (used as defaultViewport for ReactFlow)
  const [savedViewport] = useState(() => {
    try {
      const raw = localStorage.getItem('kg_viewport');
      if (raw) return JSON.parse(raw);
    } catch {}
    return undefined;
  });

  const API_BASE = 'http://localhost:8080';
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const [visibleConcepts, setVisibleConcepts] = useState(new Set());

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
    focusedNodeIdRef.current = focusedNodeId;
  }, [focusedNodeId]);

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

  const exportImage = useCallback(async () => {
    if (!reactFlowInstance) return;
    try {
      const dataUrl = await reactFlowInstance.toImage();
      const link = document.createElement('a');
      link.download = 'knowledge-graph.png';
      link.href = dataUrl;
      link.click();
    } catch {
      // Fallback: serialize the SVG viewport
      const svgEl = document.querySelector('.react-flow__renderer svg');
      if (svgEl) {
        const clone = svgEl.cloneNode(true);
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clone);
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
        const link = document.createElement('a');
        link.download = 'knowledge-graph.png';
        link.href = dataUrl;
        link.click();
      }
    }
  }, [reactFlowInstance]);

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const graphData = useMemo(() => {
    const premiumItems = (items || []).filter(item => item.hasNote);
    return buildGraphData(premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap);
  }, [items, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap]);

  // Compute highlight / dim state
  const { enhancedNodes, enhancedEdges } = useMemo(() => {
    const { nodes, edges } = graphData;

    if (!focusedNodeId || nodes.length === 0) {
      // No focus — everything normal
      const cleanNodes = nodes.map(n => ({
        ...n,
        data: { ...n.data, dimmed: false, highlighted: false, authorHighlight: false, isFocused: false }
      }));
      const cleanEdges = edges.map(e => ({
        ...e,
        data: { ...e.data, dimmed: false, highlighted: false },
        style: {
          stroke: e.data?.color || 'rgba(156, 163, 175, 0.5)',
          strokeOpacity: 0.35,
          strokeWidth: 1,
        }
      }));
      return { enhancedNodes: cleanNodes, enhancedEdges: cleanEdges };
    }

    const highlightNodes = new Set([focusedNodeId]);
    const authorHighlightSet = new Set();
    const connectedEdgeIds = new Set();

    const focusedItem = nodes.find(n => n.id === focusedNodeId);
    const isConcept = focusedItem?.data?.type === 'concept';

    if (isConcept) {
      edges.forEach(edge => {
        if (edge.target === focusedNodeId) {
          highlightNodes.add(edge.source);
          connectedEdgeIds.add(edge.id);
        }
      });
    } else {
      const author = focusedItem?.data?.author;
      edges.forEach(edge => {
        if (edge.source === focusedNodeId) {
          highlightNodes.add(edge.target);
          connectedEdgeIds.add(edge.id);
        }
      });
      if (author) {
        nodes.forEach(node => {
          if (node.data?.type === 'source' && node.data?.author === author && node.id !== focusedNodeId) {
            authorHighlightSet.add(node.id);
          }
        });
      }
    }

    const enhancedNodes = nodes.map(node => {
      const isFocused = node.id === focusedNodeId;
      const isHighlighted = highlightNodes.has(node.id) && !isFocused;
      const isAuthorHL = authorHighlightSet.has(node.id);
      const isDimmed = !isFocused && !isHighlighted && !isAuthorHL;
      return {
        ...node,
        data: {
          ...node.data,
          dimmed: isDimmed,
          highlighted: isHighlighted,
          authorHighlight: isAuthorHL,
          isFocused,
        }
      };
    });

    const enhancedEdges = edges.map(edge => {
      const isConnected = connectedEdgeIds.has(edge.id);
      const color = edge.data?.color || 'rgba(156, 163, 175, 0.5)';
      return {
        ...edge,
        data: {
          ...edge.data,
          dimmed: !isConnected,
          highlighted: isConnected,
        },
        style: {
          stroke: color,
          strokeOpacity: isConnected ? 1.0 : 0.1,
          strokeWidth: isConnected ? 3 : 1,
        }
      };
    });

    return { enhancedNodes, enhancedEdges };
  }, [graphData, focusedNodeId]);

  // Sync enhancedNodes into rfNodes, but NOT during drag
  useEffect(() => {
    if (isDraggingRef.current) return;
    setRfNodes(enhancedNodes);
  }, [enhancedNodes, setRfNodes]);

  // Sync enhancedEdges into rfEdges always (edges paths auto-update from node positions)
  useEffect(() => {
    setRfEdges(enhancedEdges);
  }, [enhancedEdges, setRfEdges]);

  // Restore saved viewport or fitView once on initial data load
  useEffect(() => {
    if (enhancedNodes.length === 0 || !reactFlowInstance) return;
    if (savedViewport) return; // defaultViewport handles this

    // No saved viewport → fitView once
    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
    });
  }, [enhancedNodes, reactFlowInstance, savedViewport]);

  // Save all initial positions once after first load, so that dragging
  // concept nodes won't cause source nodes to recalculate positions.
  useEffect(() => {
    if (enhancedNodes.length === 0) return;
    if (initialPositionsSavedRef.current) return;
    initialPositionsSavedRef.current = true;

    const positions = enhancedNodes.map(n => ({
      nodeId: n.id,
      posX: n.position.x,
      posY: n.position.y,
    }));
    savePositions(positions);
    setSavedPositions(prev => {
      const next = { ...prev };
      enhancedNodes.forEach(n => {
        next[n.id] = { x: n.position.x, y: n.position.y };
      });
      return next;
    });
  }, [enhancedNodes, savePositions, setSavedPositions]);

  // ----- Event handlers -----
  const onNodeClick = useCallback((_event, node) => {
    const nodeData = node.data;
    const isConcept = nodeData?.type === 'concept';

    // Clicking the same node again → un-focus
    if (node.id === focusedNodeId) {
      setFocusedNodeId(null);
      setSelectedNode(null);
      setIsDrawerOpen(false);
      return;
    }

    if (isConcept) {
      setSelectedNode(null);
      setIsDrawerOpen(false);
    } else {
      setSelectedNode({
        title: nodeData?.sourceTitle || node.id,
        id: node.id,
        data: nodeData,
        position: node.position,
      });
      setIsDrawerOpen(true);
    }
    setFocusedNodeId(node.id);
  }, [focusedNodeId]);



  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    setIsDrawerOpen(false);
  }, []);

  const onMoveEnd = useCallback((_event, viewport) => {
    try {
      localStorage.setItem('kg_viewport', JSON.stringify(viewport));
    } catch {}
  }, []);

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    setRfEdges(prev => prev.map(e => ({
      ...e,
      style: { ...e.style, strokeOpacity: 0 }
    })));
  }, [setRfEdges]);

  const onNodeDragStop = useCallback((_event, node) => {
    isDraggingRef.current = false;
    const { id, position } = node;
    const positions = [{ nodeId: id, posX: position.x, posY: position.y }];
    savePositions(positions);
    setSavedPositions(prev => ({
      ...prev,
      [id]: { x: position.x, y: position.y }
    }));
  }, [savePositions]);

  const nodeTypes = useMemo(() => ({
    concept: ConceptNode,
    source: SourceNode,
  }), []);

  const validConcepts = useMemo(() => {
    const counts = {};
    conceptNodes.forEach(c => counts[c.id] = 0);
    (items || []).filter(item => item.hasNote).forEach(item => {
      const cids = sourceConceptMap[item.id] || [];
      cids.forEach(cid => { if (counts[cid] !== undefined) counts[cid]++; });
    });
    return conceptNodes.filter(c => counts[c.id] > 0);
  }, [items, conceptNodes, sourceConceptMap]);

  const allVisible = validConcepts.length > 0 && validConcepts.every(c => visibleConcepts.has(c.id));

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
        {enhancedNodes.length === 0 && (
          <div className="kg-empty-state">
            <Sparkles size={32} />
            <span>暂无数据</span>
          </div>
        )}
        {enhancedNodes.length > 0 && (
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onMoveEnd={onMoveEnd}
            defaultViewport={savedViewport}
            fitView={false}
            panOnDrag={true}
            zoomOnScroll={true}
            selectNodesOnDrag={false}
            nodesDraggable={true}
            minZoom={0.1}
            maxZoom={4}
            style={{ width: '100%', height: '100%' }}
          >
            <Background color="#e0e0e0" gap={20} size={1} />
          </ReactFlow>
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
          <div className="kg-cube-section">
            <div className="kg-cube-section-title">视图</div>
            <div className="kg-cube-controls">
              <button onClick={() => reactFlowInstance?.zoomIn()} title="放大"><ZoomIn size={16} /></button>
              <button onClick={() => reactFlowInstance?.zoomOut()} title="缩小"><ZoomOut size={16} /></button>
              <button onClick={() => reactFlowInstance?.fitView({ padding: 0.2, duration: 0 })} title="适应画布"><Maximize size={16} /></button>
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

/* ------------------------------------------------------------------ */
/*  Exported wrapper — provides ReactFlowProvider context              */
/* ------------------------------------------------------------------ */
export function KnowledgeGraph() {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphInner />
    </ReactFlowProvider>
  );
}
