import React, { useMemo } from 'react';
import './DynamicWordCloud.css';

// 固定的词汇位置分布 (为了动画能丝滑过渡，位置必须固定)
const POSITIONS = {
  '大模型架构': { top: '45%', left: '45%' },
  'React 19': { top: '65%', left: '75%' },
  'Framer Motion': { top: '60%', left: '20%' },
  'UI 设计心理学': { top: '25%', left: '35%' },
  '独立开发': { top: '80%', left: '45%' },
  '个人知识管理': { top: '35%', left: '75%' },
  'WebGL 渲染': { top: '20%', left: '65%' },
  '播客访谈': { top: '40%', left: '10%' },
  '数字饮食': { top: '15%', left: '45%' },
  '微前端': { top: '80%', left: '20%' },
};

const COLORS = [
  '#0EA5E9', '#F43F5E', '#8B5CF6', '#10B981', '#F59E0B',
  '#3B82F6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'
];

export function DynamicWordCloud({ data, onWordClick }) {
  // 计算当前数据中的最大值，用于归一化字体大小
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value));
  }, [data]);

  return (
    <div className="dynamic-wordcloud-container">
      {data.map((item, index) => {
        // 计算字体大小 (12px 到 48px)
        const sizeRatio = item.value / maxValue;
        const fontSize = 12 + sizeRatio * 36;
        const opacity = 0.4 + sizeRatio * 0.6;
        
        // 分配固定颜色
        const color = COLORS[index % COLORS.length];
        
        const pos = POSITIONS[item.name] || { top: '50%', left: '50%' };

        return (
          <div
            key={item.name}
            className="dw-word"
            onClick={() => onWordClick && onWordClick(item.name)}
            style={{
              top: pos.top,
              left: pos.left,
              fontSize: `${fontSize}px`,
              opacity: opacity,
              color: color,
              transform: 'translate(-50%, -50%)',
              zIndex: Math.floor(sizeRatio * 10) || 1
            }}
          >
            {item.name}
          </div>
        );
      })}
    </div>
  );
}
