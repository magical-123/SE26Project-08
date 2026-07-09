import React from 'react';
import { GlassCard } from '../GlassCard/GlassCard';
import { Clock, PlayCircle, FileText, Mic, ArrowUpRight, Heart, Star, Sparkles } from 'lucide-react';
import './InfoSourceCard.css';

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />,
  Podcast: <Mic size={14} />
};

// 判断是否显示红点：点赞或收藏了，但还没打开看过
const shouldShowRedDot = (data) => {
  return (data.isFavorite || data.isLiked) && !data.opened;
};

export function InfoSourceCard({ data, onClick, onTogglePremium, isPremium, premiumLabel }) {
  const showRedDot = shouldShowRedDot(data);

  const handleTogglePremium = (e) => {
    e.stopPropagation();
    onTogglePremium?.(data.id);
  };

  return (
    <GlassCard className={`info-source-card ${isPremium ? 'is-premium' : ''}`} onClick={onClick}>
      {showRedDot && (
        <div className="isc-red-dot" />
      )}
      {isPremium && premiumLabel && (
        <div className="isc-premium-badge">
          <Sparkles size={10} />
          <span>{premiumLabel}</span>
        </div>
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
          <span className="isc-divider">|</span>
          <span className="isc-time">{data.date}</span>
        </div>

        <div className="isc-actions">
          <button
            className={`isc-action-btn ${data.isFavorite ? 'active' : ''}`}
            onClick={handleTogglePremium}
            title={data.isFavorite ? '取消收藏' : '收藏'}
          >
            <Heart size={14} fill={data.isFavorite ? '#EF4444' : 'none'} />
          </button>
          <button
            className={`isc-action-btn ${data.isLiked ? 'active' : ''}`}
            onClick={handleTogglePremium}
            title={data.isLiked ? '取消点赞' : '点赞'}
          >
            <Star size={14} fill={data.isLiked ? '#F59E0B' : 'none'} />
          </button>
          <button className="isc-extract-btn" onClick={(e) => e.stopPropagation()}>
            <span>提取知识</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {isPremium && (
        <div className="isc-premium-indicator" />
      )}
    </GlassCard>
  );
}
