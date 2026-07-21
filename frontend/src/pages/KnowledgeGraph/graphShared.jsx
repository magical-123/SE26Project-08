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

  // Only keep concepts that actually have premium items AND are visible (按 label 去重)
  const seenLabels = new Set();
  const validConcepts = conceptNodes.filter(c => {
    if (conceptCounts[c.id] <= 0) return false;
    if (seenLabels.has(c.label)) return false;
    seenLabels.add(c.label);
    return true;
  });
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
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          color: '#2a2a2a',
          marginTop: 4,
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