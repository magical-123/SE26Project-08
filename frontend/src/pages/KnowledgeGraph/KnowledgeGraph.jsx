import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { ZoomIn, ZoomOut, Eye, EyeOff, Camera, Sparkles, WifiOff, RotateCcw } from 'lucide-react';
import { buildGraphData, ConceptNode, SourceNode, MAX_LABEL_LENGTH } from './graphShared';
import { graphApi } from '../../utils/api';
import { cacheData, getCachedData } from '../../utils/cache';
import './KnowledgeGraph.css';

const toKeywordSuggestions = (concepts = []) => concepts.map(c => ({
  label: c.label,
  isNew: false,
  confidence: c.confidence,
  reason: c.reason,
}));

/* ------------------------------------------------------------------ */
/*  Inner component (all logic lives here)                             */
/* ------------------------------------------------------------------ */
function KnowledgeGraphInner() {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const focusedNodeIdRef = useRef(null);
  const [savedPositions, setSavedPositions] = useState({});
  const [conceptNodes, setConceptNodes] = useState([]);
  const [sourceConceptMap, setSourceConceptMap] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [premiumItems, setPremiumItems] = useState([]);
  const { items } = useInboxItems();
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState([]);
  const [kgOffline, setKgOffline] = useState(false);
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

  const [visibleConcepts, setVisibleConcepts] = useState(new Set());
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const API_BASE = '';
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
  });

  // Fetch graph data and positions from API
  const fetchGraphData = useCallback(() => {
    setDataLoading(true);
    setKgOffline(false);
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

          // Store premium items from API (all优质信息源, not limited by inbox page size)
          const apiPremiumItems = (graphData.items || []).map(item => ({
            ...item,
            hasNote: true,
            id: item.id,
            title: item.title,
            platform: item.platform,
            author: item.author || item.platform || '未知来源',
            durationMinutes: item.durationMinutes,
            duration: item.durationMinutes ? item.durationMinutes + ' 分钟' : '-',
            date: item.crawledAt || '',
            aiSummary: item.aiSummary || null,
            knowledgeScore: item.knowledgeScore || null,
            nutritionProtein: item.nutritionProtein || null,
            nutritionCarbs: item.nutritionCarbs || null,
            nutritionVitamins: item.nutritionVitamins || null,
            nutritionFats: item.nutritionFats || null,
            nutritionFiber: item.nutritionFiber || null,
            nutritionReasoning: item.nutritionReasoning || null,
            userNote: item.userNote || null,
            note: item.note || null,
            url: item.url || null,
            isLiked: item.isLiked || false,
            isFavorite: item.isFavorite || false,
          }));
          setPremiumItems(apiPremiumItems);

          setVisibleConcepts(new Set(nodes.map(n => n.id)));

          // 缓存成功获取的图谱数据
          cacheData('knowledgeGraph', { graphData, positionsData });
        }
        setDataLoading(false);
      })
      .catch(() => {
        // 从缓存读取降级数据
        const cached = getCachedData('knowledgeGraph');
        if (cached) {
          const { graphData: cachedGraph, positionsData: cachedPos } = cached;
          if (cachedPos) setSavedPositions(cachedPos);
          if (cachedGraph) {
            const nodes = (cachedGraph.concepts || []).map(c => ({ ...c, id: `concept-${c.id}` }));
            setConceptNodes(nodes);
            const mapping = {};
            Object.entries(cachedGraph.itemToConcepts || {}).forEach(([itemId, conceptIds]) => {
              mapping[Number(itemId)] = conceptIds.map(cid => `concept-${cid}`);
            });
            setSourceConceptMap(mapping);
            const cachedItems = (cachedGraph.items || []).map(item => ({ ...item, hasNote: true }));
            setPremiumItems(cachedItems);
            setVisibleConcepts(new Set(nodes.map(n => n.id)));
          }
          setKgOffline(true);
        }
        setDataLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData, refreshKey]);

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

  const resetLayout = async () => {
    if (!window.confirm("确定要重置所有节点的位置并恢复默认布局吗？")) return;
    try {
      await fetch(`${API_BASE}/api/graph/positions`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      localStorage.removeItem('kg_viewport');
      setSavedViewport(null);
      setSavedPositions({});
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('重置布局失败:', e);
    }
  };

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
    setSelectedKeywords([]);
    setSuggestedKeywords([]);
  };

  const handleToggleKeyword = (kw) => {
    const itemId = selectedNode?.data?.id;
    if (!itemId) return;
    graphApi.toggleItemKeyword(itemId, kw).then(concepts => {
      const kws = concepts.map(c => c.label);
      const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
      setSelectedKeywords(highlighted);
      setSuggestedKeywords(toKeywordSuggestions(concepts));
      setRefreshKey(k => k + 1);
    }).catch(e => console.error('切换高亮失败:', e));
  };

  const [collapsedConcepts, setCollapsedConcepts] = useState(new Set());

  const toggleCollapseConcept = useCallback((conceptId) => {
    setCollapsedConcepts(prev => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  }, []);

  const graphData = useMemo(() => {
    const data = buildGraphData(premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap);

    if (collapsedConcepts.size === 0) {
      // 没有收起的概念，直接返回，但给概念节点加上 onToggleCollapse
      return {
        nodes: data.nodes.map(n => {
          if (n.type === 'concept') {
            return { ...n, data: { ...n.data, isCollapsed: false, onToggleCollapse: toggleCollapseConcept } };
          }
          return n;
        }),
        edges: data.edges,
      };
    }

    // 统计每个概念关联的 source 节点数
    const conceptSourceCounts = {};
    const hiddenSourceIds = new Set();

    data.nodes.forEach(n => {
      if (n.type !== 'source') return;
      const conceptIds = n.data?.conceptIds || [];
      // 如果一个 source 节点的所有关联概念都被收起，则隐藏它
      if (conceptIds.length > 0 && conceptIds.every(cid => collapsedConcepts.has(cid))) {
        hiddenSourceIds.add(n.id);
      }
      // 统计每个概念的 source 节点数（即使不隐藏也算总数）
      conceptIds.forEach(cid => {
        conceptSourceCounts[cid] = (conceptSourceCounts[cid] || 0) + 1;
      });
    });

    return {
      nodes: data.nodes
        .filter(n => !hiddenSourceIds.has(n.id))
        .map(n => {
          if (n.type === 'concept') {
            const totalCount = conceptSourceCounts[n.id] || 0;
            return {
              ...n,
              data: {
                ...n.data,
                isCollapsed: collapsedConcepts.has(n.id),
                hiddenSourceCount: collapsedConcepts.has(n.id) ? totalCount : 0,
                sourceCount: totalCount,
                onToggleCollapse: toggleCollapseConcept,
              }
            };
          }
          return n;
        }),
      edges: data.edges.filter(e => !hiddenSourceIds.has(e.source) && !hiddenSourceIds.has(e.target)),
    };
  }, [premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap, collapsedConcepts, toggleCollapseConcept]);

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
      reactFlowInstance.fitView({ padding: 0.08, duration: 0 });
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

      // 获取关键词
      const itemId = nodeData?.id || node.id;
      if (itemId) {
        graphApi.getItemKeywords(itemId).then(concepts => {
          const kws = concepts.map(c => c.label);
          const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
          setSelectedKeywords(highlighted.length > 0 ? highlighted : kws);
          setSuggestedKeywords(toKeywordSuggestions(concepts));
        }).catch(e => {
          console.error('获取关键词失败:', e);
          setSelectedKeywords([]);
          setSuggestedKeywords([]);
        });
      }
    }
    setFocusedNodeId(node.id);
  }, [focusedNodeId]);

  const handleDeleteKeyword = async (label) => {
    if (!label) return;
    try {
      await graphApi.deleteKeyword(label);
      setSelectedKeywords(prev => prev.filter(k => k !== label));
      setSuggestedKeywords(prev => prev.filter(k => k.label !== label));
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error('删除关键词失败:', e);
    }
  };

  const handleAddKeyword = () => {
    const kw = prompt('请输入新关键词：');
    const itemId = selectedNode?.data?.id;
    if (kw && itemId && !selectedKeywords.includes(kw)) {
      setSelectedKeywords(prev => {
        const updated = [...prev, kw];
        graphApi.updateItemKeywords(itemId, updated.map(label => ({
          label,
          isNew: suggestedKeywords.find(s => s.label === label)?.isNew || false
        }))).then(() => {
          setRefreshKey(k => k + 1);
        }).catch(e => console.error('添加关键词失败:', e));
        return updated;
      });
      if (!suggestedKeywords.find(s => s.label === kw)) {
        setSuggestedKeywords(prev => [...prev, { label: kw, isNew: true }]);
      }
    }
  };



  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setFocusedNodeId(null);
    setIsDrawerOpen(false);
    setSelectedKeywords([]);
    setSuggestedKeywords([]);
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
    premiumItems.forEach(item => {
      const cids = sourceConceptMap[item.id] || [];
      cids.forEach(cid => { if (counts[cid] !== undefined) counts[cid]++; });
    });
    // 先按 label 去重（保留第一个出现的），再过滤掉无关联数据的
    const seenLabels = new Set();
    return conceptNodes.filter(c => {
      if (counts[c.id] <= 0) return false;
      if (seenLabels.has(c.label)) return false;
      seenLabels.add(c.label);
      return true;
    });
  }, [premiumItems, conceptNodes, sourceConceptMap]);

  const allVisible = validConcepts.length > 0 && validConcepts.every(c => visibleConcepts.has(c.id));

  return (
    <div className="knowledge-graph-page">
      {/* Top legend bar */}
      {kgOffline && (
        <div className="kg-offline-banner">
          <WifiOff size={14} />
          <span>当前离线/服务超时，已切换为缓存模式</span>
        </div>
      )}
      <div className="kg-legend-bar">
        <div className={`kg-legend-bar-inner ${legendCollapsed ? 'collapsed' : ''}`}>
          {legendCollapsed ? (
            <button
              className="kg-legend-collapse-btn"
              onClick={() => setLegendCollapsed(false)}
              title="展开标签栏"
            >
              <span className="kg-legend-collapse-icon">▶</span>
              <span>{validConcepts.length} 个标签</span>
            </button>
          ) : (
            <div className="kg-legend-expanded">
              <div className="kg-legend-items-scroll">
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
              </div>
              <div className="kg-legend-actions">
                <button 
                  className={`kg-legend-toggle-all ${allVisible ? 'disabled' : ''}`}
                  onClick={toggleAll}
                  disabled={allVisible}
                  style={{ opacity: allVisible ? 0.5 : 1, cursor: allVisible ? 'default' : 'pointer' }}
                >
                  <Eye size={12} />
                  <span>全显示</span>
                </button>
                <button
                  className="kg-legend-collapse-btn"
                  onClick={() => setLegendCollapsed(true)}
                  title="收起标签栏"
                >
                  <span className="kg-legend-collapse-icon">▼</span>
                </button>
              </div>
            </div>
          )}
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

      <div className="kg-controls">
        <button onClick={resetLayout} title="重置布局"><RotateCcw size={16} /></button>
        <button onClick={() => reactFlowInstance?.zoomIn()} title="放大"><ZoomIn size={16} /></button>
        <button onClick={() => reactFlowInstance?.zoomOut()} title="缩小"><ZoomOut size={16} /></button>
        <button onClick={exportImage} title="导出图片"><Camera size={16} /></button>
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
        selectedKeywords={selectedKeywords}
        suggestedKeywords={suggestedKeywords}
        onToggleKeyword={handleToggleKeyword}
        onDeleteKeyword={handleDeleteKeyword}
        onAddKeyword={handleAddKeyword}
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
