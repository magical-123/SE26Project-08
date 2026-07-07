import React from 'react';
import { GlassCard } from '../GlassCard/GlassCard';
import { Clock, PlayCircle, FileText, Mic, ArrowUpRight } from 'lucide-react';
import './InfoSourceCard.css';

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />,
  Podcast: <Mic size={14} />
};

export function InfoSourceCard({ data, onClick }) {
  return (
    <GlassCard className="info-source-card" onClick={onClick}>
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
        
        <button className="isc-extract-btn">
          <span>提取知识</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </GlassCard>
  );
}
