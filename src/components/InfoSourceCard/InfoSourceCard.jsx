import React from 'react';
import { GlassCard } from '../GlassCard/GlassCard';
import { Lightbulb, Clock, PlayCircle, FileText, Mic } from 'lucide-react';
import './InfoSourceCard.css';

const platformIcon = {
  Bilibili: <PlayCircle size={16} />,
  Zhihu: <FileText size={16} />,
  Podcast: <Mic size={16} />
};

export function InfoSourceCard({ data, onClick }) {
  return (
    <GlassCard className="info-source-card" onClick={onClick}>
      <div className="isc-glow"></div>
      <div className="isc-header">
        <div className="isc-platform">
          {platformIcon[data.platform] || <FileText size={16} />}
          <span>{data.platform}</span>
        </div>
        <div className="isc-category" style={{ color: data.color }}>
          {data.category}
        </div>
      </div>
      <h3 className="isc-title">{data.title}</h3>
      <div className="isc-footer">
        <div className="isc-meta">
          <span>{data.author}</span>
          <span className="dot">•</span>
          <Clock size={12} />
          <span>{data.duration}</span>
        </div>
        <div className="isc-time">{data.date}</div>
      </div>
      <div className="isc-action">
        <button className="extract-btn">
          <Lightbulb size={14} />
          提取知识
        </button>
      </div>
    </GlassCard>
  );
}
