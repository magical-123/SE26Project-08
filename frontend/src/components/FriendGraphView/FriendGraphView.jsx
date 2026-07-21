import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { DetailDrawer } from '../DetailDrawer/DetailDrawer';
import { buildGraphData, ConceptNode, SourceNode } from '../../pages/KnowledgeGraph/graphShared';
import './FriendGraphView.css';

const API_BASE = 'http://localhost:8080';

function getAuthHeaders() {
  return { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` };
}

/* ------------------------------------------------------------------ */
/*  FriendGraphInner — 内部的 ReactFlow 实例                           */
/* ------------------------------------------------------------------ */
function FriendGraphInner({ friendId, friendName, onClose }) {
  const reactFlowInstance = useReactFlow();
  const [conceptNodes, setConceptNodes] = useState([]);
  const [sourceConceptMap, setSourceConceptMap] = useState({});
  const [premiumItems, setPremiumItems] = useState([]);
  const [savedPositions, setSavedPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [rfNodes, setRfNodes] = useState([]);
  const [rfEdges, setRfEdges] = useState([]);

  // 获取数据（仅一次，静态快照）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/graph/data/user/${friendId}`, { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const nodes = (data.concepts || []).map(c => ({ ...c, id: `concept-${c.id}` }));
        setConceptNodes(nodes);

        const mapping = {};
        Object.entries(data.itemToConcepts || {}).forEach(([itemId, conceptIds]) => {
          mapping[Number(itemId)] = conceptIds.map(cid => `concept-${cid}`);
        });
        setSourceConceptMap(mapping);

        // 使用好友保存的节点位置
        const positions = data.positions || {};
        setSavedPositions(positions);

        const items = (data.items || []).map(item => ({
          ...item,
          hasNote: true,
          id: item.id,
          title: item.title,
          platform: item.platform,
          author: item.platform || '未知来源',
          duration: (item.durationMinutes || 1) + ' 分钟',
          date: item.crawledAt || '',
          aiSummary: item.aiSummary || null,
          knowledgeScore: item.knowledgeScore || null,
        }));
        setPremiumItems(items);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [friendId]);

  // 构建图数据（使用好友保存的节点位置）
  const graphData = useMemo(() => {
    return buildGraphData(premiumItems, null, savedPositions, conceptNodes, sourceConceptMap);
  }, [premiumItems, savedPositions, conceptNodes, sourceConceptMap]);

  // 高亮逻辑（简化版，仅支持点击节点高亮）
  const { enhancedNodes, enhancedEdges } = useMemo(() => {
    const { nodes, edges } = graphData;

    if (!focusedNodeId || nodes.length === 0) {
      const cleanNodes = nodes.map(n => ({
        ...n,
        data: { ...n.data, dimmed: false, highlighted: false, authorHighlight: false, isFocused: false }
      }));
      const cleanEdges = edges.map(e => ({
        ...e,
        data: { ...e.data, dimmed: false, highlighted: false },
        style: { stroke: e.data?.color || 'rgba(156, 163, 175, 0.5)', strokeOpacity: 0.35, strokeWidth: 1 }
      }));
      return { enhancedNodes: cleanNodes, enhancedEdges: cleanEdges };
    }

    const highlightNodes = new Set([focusedNodeId]);
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
      edges.forEach(edge => {
        if (edge.source === focusedNodeId) {
          highlightNodes.add(edge.target);
          connectedEdgeIds.add(edge.id);
        }
      });
    }

    const enhancedNodes = nodes.map(node => {
      const isFocused = node.id === focusedNodeId;
      const isHighlighted = highlightNodes.has(node.id) && !isFocused;
      const isDimmed = !isFocused && !isHighlighted;
      return { ...node, data: { ...node.data, dimmed: isDimmed, highlighted: isHighlighted, authorHighlight: false, isFocused } };
    });

    const enhancedEdges = edges.map(edge => {
      const isConnected = connectedEdgeIds.has(edge.id);
      const color = edge.data?.color || 'rgba(156, 163, 175, 0.5)';
      return { ...edge, data: { ...edge.data, dimmed: !isConnected, highlighted: isConnected }, style: { stroke: color, strokeOpacity: isConnected ? 1.0 : 0.1, strokeWidth: isConnected ? 3 : 1 } };
    });

    return { enhancedNodes, enhancedEdges };
  }, [graphData, focusedNodeId]);

  // 同步节点到渲染状态
  useEffect(() => { setRfNodes(enhancedNodes); }, [enhancedNodes]);
  useEffect(() => { setRfEdges(enhancedEdges); }, [enhancedEdges]);

  // 适应画布
  useEffect(() => {
    if (enhancedNodes.length > 0 && reactFlowInstance) {
      requestAnimationFrame(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
      });
    }
  }, [enhancedNodes, reactFlowInstance]);

  // 节点点击：支持高亮和详情
  const onNodeClick = useCallback((_event, node) => {
    const nodeData = node.data;
    const isConcept = nodeData?.type === 'concept';

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

  const nodeTypes = useMemo(() => ({ concept: ConceptNode, source: SourceNode }), []);

  return (
    <div className="fgv-overlay" onClick={onClose}>
      <div className="fgv-modal" onClick={e => e.stopPropagation()}>
        {/* 顶栏 */}
        <div className="fgv-header">
          <span className="fgv-title">{friendName} 的知识图谱</span>
          <div className="fgv-header-actions">
            <button className="fgv-ctrl-btn" onClick={() => reactFlowInstance?.zoomIn()} title="放大"><ZoomIn size={16} /></button>
            <button className="fgv-ctrl-btn" onClick={() => reactFlowInstance?.zoomOut()} title="缩小"><ZoomOut size={16} /></button>
            <button className="fgv-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* 图谱区域 */}
        <div className="fgv-body">
          {loading && (
            <div className="fgv-loading">加载中...</div>
          )}
          {!loading && enhancedNodes.length === 0 && (
            <div className="fgv-empty">该好友暂无知识图谱数据</div>
          )}
          {!loading && enhancedNodes.length > 0 && (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              panOnDrag={true}
              zoomOnScroll={true}
              nodesDraggable={false}
              selectNodesOnDrag={false}
              minZoom={0.1}
              maxZoom={4}
              style={{ width: '100%', height: '100%' }}
            >
              <Background color="#e0e0e0" gap={20} size={1} />
            </ReactFlow>
          )}
        </div>

        <DetailDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setSelectedNode(null); }}
          data={selectedNode}
          sourceTitle={selectedNode?.title}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FriendGraphView — 导出组件，提供 ReactFlowProvider                */
/* ------------------------------------------------------------------ */
export function FriendGraphView({ friendId, friendName, onClose }) {
  return (
    <ReactFlowProvider>
      <FriendGraphInner friendId={friendId} friendName={friendName} onClose={onClose} />
    </ReactFlowProvider>
  );
}