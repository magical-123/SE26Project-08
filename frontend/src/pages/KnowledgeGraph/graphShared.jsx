import React from 'react';
import { Handle, Position } from '@xyflow/react';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
export const MAX_LABEL_LENGTH = 5;

/* ------------------------------------------------------------------ */
/*  Utility functions                                                 */
/* ------------------------------------------------------------------ */
export function getNodeWeight(item) {
  return item.hasNote ? 3 : 0;
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function blendColors(hexArray) {
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

export function truncateLabel(text, len) {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '\u2026' : text;
}

/* ------------------------------------------------------------------ */
/*  buildGraphData — 根据原始数据构建 ReactFlow 的 nodes / edges       */
/* ------------------------------------------------------------------ */
export function buildGraphData(premiumItems, visibleConcepts, savedPositions, conceptNodes, sourceConceptMap) {
  if (premiumItems.length === 0) return { nodes: [], edges: [] };

  // Calculate counts for each concept based on premium items
  const conceptCounts = {};
  conceptNodes.forEach(c => conceptCounts[c.id] = 0);

  premiumItems.forEach(item => {
    const itemConceptIds = sourceConceptMap[item.id] || [];
    itemConceptIds.forEach(cid => {
      if (conceptCounts[cid] !== undefined) conceptCounts[cid]++;
    });
  });

  // Only keep concepts that actually have premium items AND are visible (按 label 去重)
  const seenLabels = new Set();
  const validConcepts = conceptNodes.filter(c => {
    if (conceptCounts[c.id] <= 0) return false;
    if (seenLabels.has(c.label)) return false;
    seenLabels.add(c.label);
    return true;
  });
  const activeConcepts = validConcepts.filter(c => !visibleConcepts || visibleConcepts.has(c.id));
  
  // 按包含的文章数量降序排序，让大节点靠近中心 (但我们会把它们放在外圈，所以排序决定顺序)
  activeConcepts.sort((a, b) => (conceptCounts[b.id] || 0) - (conceptCounts[a.id] || 0));

  const activeConceptIds = new Set(activeConcepts.map(c => c.id));
  const activeItems = premiumItems.filter(item => {
    const cids = sourceConceptMap[item.id] || [];
    return cids.some(cid => activeConceptIds.has(cid));
  });

  // 统一所有节点到一个数组：信息源节点放在最前（在螺旋最内层），接着是大领域，最后是小领域
  const combinedSequence = [
    ...activeItems.map(i => ({ ...i, _type: 'source' })),
    ...activeConcepts.map(c => ({ ...c, _type: 'concept' }))
  ];

  const nodesMap = {};
  const conceptPositions = {};
  
  const cx = 0;
  const cy = 0;
  const goldenAngle = 2.39996323;
  let currentArea = 0;

  // 第一遍：计算所有节点的物理位置（基于累计面积的自适应螺旋）
  combinedSequence.forEach((item, index) => {
    const isConcept = item._type === 'concept';
    const id = isConcept ? item.id : `source-${item.id}`;
    
    let size, count, weight;
    if (isConcept) {
      count = conceptCounts[item.id] || 0;
      size = Math.min(50 + count * 15, 200);
    } else {
      weight = getNodeWeight(item);
      size = 30 + weight * 3;
    }

    const saved = savedPositions[id];
    let x, y;
    
    if (saved) {
      x = saved.x;
      y = saved.y;
    } else {
      // 通过累加节点面积来推算当前螺旋半径，确保不同大小的节点都能完美分布不重叠
      const padding = isConcept ? 40 : 15; 
      const nodeRadius = (size / 2) + padding;
      currentArea += Math.PI * nodeRadius * nodeRadius;
      
      const r = Math.sqrt(currentArea / Math.PI) * 1.35; // 增加间距系数
      const angle = index * goldenAngle;
      
      // X轴乘以 1.6 实现椭圆伸展，完美契合 16:9 宽屏玻璃面板，消灭左右大白边！
      x = cx + Math.cos(angle) * r * 1.6; 
      y = cy + Math.sin(angle) * r;
    }

    if (isConcept) {
      conceptPositions[item.id] = { x, y, color: item.color, size, count };
      nodesMap[id] = {
        id,
        type: 'concept',
        position: { x, y },
        width: size + 60,
        height: size + 60,
        data: { ...item, type: 'concept', count, size }
      };
    } else {
      nodesMap[id] = {
        id,
        type: 'source',
        position: { x, y },
        width: size + 80,
        height: size + 80,
        data: { ...item, type: 'source', sourceTitle: item.title, weight, size }
      };
    }
  });

  const edges = [];
  
  // 第二遍：为信息源节点计算颜色并连线
  activeItems.forEach(item => {
    const id = `source-${item.id}`;
    const sourceNode = nodesMap[id];
    if (!sourceNode) return;
    
    const itemConceptIds = sourceConceptMap[item.id] || [];
    const activeItemConcepts = itemConceptIds.filter(cid => activeConceptIds.has(cid));
    sourceNode.data.conceptIds = activeItemConcepts;

    const activeColors = activeItemConcepts.map(cid => conceptPositions[cid]?.color).filter(Boolean);
    sourceNode.data.primaryColor = blendColors(activeColors);
    sourceNode.data.secondaryColor = activeItemConcepts.length > 1 && conceptPositions[activeItemConcepts[1]] ? conceptPositions[activeItemConcepts[1]].color : null;

    activeItemConcepts.forEach(cid => {
      edges.push({
        id: `edge-${item.id}-${cid}`,
        source: id,
        target: cid,
        data: {
          type: 'belongs',
          color: conceptPositions[cid]?.color || '#999'
        }
      });
    });
  });

  const nodes = Object.values(nodesMap);

  // ===== 重叠检测与推开：确保未保存位置的圆绝对不会重叠 =====
  const MIN_PADDING = 12;
  const MAX_ITER = 15;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      if (savedPositions[ni.id]) continue;
      
      for (let j = i + 1; j < nodes.length; j++) {
        const nj = nodes[j];
        
        const radiusI = (ni.data.size || 24) / 2;
        const radiusJ = (nj.data.size || 24) / 2;

        const dx = nj.position.x - ni.position.x;
        const dy = nj.position.y - ni.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = radiusI + radiusJ + MIN_PADDING;

        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          
          ni.position.x -= nx * push;
          ni.position.y -= ny * push;
          if (!savedPositions[nj.id]) {
            nj.position.x += nx * push;
            nj.position.y += ny * push;
          } else {
            ni.position.x -= nx * push * 2;
            ni.position.y -= ny * push * 2;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Custom Node: ConceptNode                                           */
/* ------------------------------------------------------------------ */
export function ConceptNode({ data }) {
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
  const fontSize = Math.max(20, Math.min(36, Math.round(size * 0.22)));

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
      <span
        style={{
          background: 'rgba(255,255,255,0.85)',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: fontSize,
          fontWeight: 800,
          color: '#1a1a1a',
          marginTop: 8,
          maxWidth: 160,
          lineHeight: 1.3,
          textAlign: 'center',
          wordBreak: 'break-word',
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
export function SourceNode({ data }) {
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
            background: 'rgba(255,255,255,0.85)',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 700,
            color: '#1a1a1a',
            marginTop: 8,
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