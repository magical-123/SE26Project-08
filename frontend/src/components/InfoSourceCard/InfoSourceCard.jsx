import React from 'react';
import { GlassCard } from '../GlassCard/GlassCard';
import { Clock, PlayCircle, FileText, Mic, ArrowUpRight, Heart, Star, Sparkles } from 'lucide-react';
import './InfoSourceCard.css';

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />
};

// 判断是否显示红点：收藏了该卡片
const shouldShowRedDot = (data) => {
  return data.isFavorite;
};

export function InfoSourceCard({ data, onClick, onTogglePremium, isPremium, premiumLabel }) {
  // 优质信息源卡片只显示黄色边框，不显示红点
  const showRedDot = !isPremium && shouldShowRedDot(data);

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
      {(!data.aiSummary && data.processStatus === 'UNPROCESSED') && (
        <div className="isc-processing-badge">
          <div className="isc-spinner" />
          <span>AI 分析中...</span>
        </div>
      )}
      <div className="isc-header">
        <div className="isc-platform">
          {platformIcon[data.platform] || <FileText size={14} />}
          <span>{data.platform}</span>
        </div>
        <div className="isc-keywords">
          {(data.keywords || []).slice(0, 2).map((kw, i) => (
            <span key={i} className="isc-keyword-pill">{kw}</span>
          ))}
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
          <span
            className={`isc-action-indicator ${data.isLiked ? 'active' : ''}`}
            title={data.isLiked ? '已从平台同步：您点赞了此内容' : '未检测到平台点赞'}
          >
            <Heart size={14} fill={data.isLiked ? '#EF4444' : 'none'} color={data.isLiked ? '#EF4444' : undefined} />
          </span>
          <span
            className={`isc-action-indicator ${data.isFavorite ? 'active' : ''}`}
            title={data.isFavorite ? '已从平台同步：您收藏了此内容' : '未检测到平台收藏'}
          >
            <Star size={14} fill={data.isFavorite ? '#F59E0B' : 'none'} color={data.isFavorite ? '#F59E0B' : undefined} />
          </span>
          <button
            className="isc-extract-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick(data);
            }}
          >
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
