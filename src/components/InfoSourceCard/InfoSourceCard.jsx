import React from 'react';
import { GlassCard } from '../GlassCard/GlassCard';
import { Clock, PlayCircle, FileText, Mic, ArrowUpRight, Heart, Star } from 'lucide-react';
import './InfoSourceCard.css';

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />,
  Podcast: <Mic size={14} />
};

// 判断是否显示红点：点赞或收藏了，但没有笔记
const shouldShowRedDot = (data) => {
  return (data.isFavorite || data.isLiked) && !data.hasNote;
};

export function InfoSourceCard({ data, onClick }) {
  const showRedDot = shouldShowRedDot(data);
  
  return (
    <GlassCard className="info-source-card" onClick={onClick}>
      {showRedDot && (
        <div className="isc-red-dot" />
      )}
      <div className="isc-header">
        <div className="isc-platform">
          {platformIcon[data.platform] || <FileText size={14} />}
          <span>{data.platform}</span>
        </div>
        <div className="isc-category" style={{ color: data.color, borderColor: data.color }}>
          {data.category}
        </div>
      </div>
      
      <div className="isc-body">
        <h3 className="isc-title">{data.title}</h3>
      </div>
      
      <div className="isc-footer">
        <div className="isc-meta">
          <span className="isc-author">{data.author}</span>
          <span className="isc-divider">|</span>
          <Clock size={12} className="isc-clock-icon" />
          <span className="isc-duration">{data.duration}</span>
          {data.isFavorite && (
            <>
              <span className="isc-divider">|</span>
              <Heart size={12} className="isc-action-icon isc-favorite" fill="#EF4444" />
              <span className="isc-action-label">收藏</span>
            </>
          )}
          {data.isLiked && (
            <>
              <span className="isc-divider">|</span>
              <Star size={12} className="isc-action-icon isc-liked" fill="#F59E0B" />
              <span className="isc-action-label">点赞</span>
            </>
          )}
          <span className="isc-divider">|</span>
          <span className="isc-time">{data.date}</span>
        </div>
        
        <button className="isc-extract-btn">
          <span>提取知识</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </GlassCard>
  );
}
