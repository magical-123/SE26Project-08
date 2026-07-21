import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Edit3, PlayCircle, FileText, Mic, Clock, Calendar } from 'lucide-react';
import './DetailDrawer.css';

import { Tag } from 'lucide-react';

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />,
};

export function DetailDrawer({ isOpen, onClose, data, draftNote, suggestedKeywords, selectedKeywords, onNoteChange, onToggleKeyword, onAddKeyword, onDeleteKeyword, onUpgrade, isUpgrading, onTogglePremium, onRegenerateSummary, sourceTitle }) {
  const d = data?.data || data || {};
  const isPremium = !!d.hasNote;

  // 打开抽屉时锁定 body 滚动，防止滚动栏影响抽屉显示
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
          />
          <motion.div
            className="detail-drawer"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 32, stiffness: 300, mass: 0.9 }}
          >
            <div className="drawer-glow-border" style={{ '--accent': '#0EA5E9' }} />

            <div className="drawer-header">
              <div className="drawer-header-content">
                <h2>{sourceTitle || d.sourceTitle || data?.title || '详情'}</h2>
              </div>
              <button className="close-btn" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              {/* Metadata */}
              <div className="drawer-meta">
                <div className="meta-item meta-platform">
                  {platformIcon[d.platform] || <FileText size={14} />}
                  <span>{d.platform || '未知平台'}</span>
                </div>
                <span className="meta-divider" />
                <div className="meta-item">
                  <span className="meta-label">作者</span>
                  <span>{d.author || '-'}</span>
                </div>
                <span className="meta-divider" />
                <div className="meta-item">
                  <Clock size={13} />
                  <span>{d.duration || '-'}</span>
                </div>
                <span className="meta-divider" />
                <div className="meta-item">
                  <Calendar size={13} />
                  <span>{d.date || '-'}</span>
                </div>
              </div>

              {/* AI Summary Card */}
              <div className="ai-summary-card">
                <div className="ai-summary-glow" />
                <div className="ai-summary-header">
                  <Sparkles size={16} />
                  <span>AI 智能摘要</span>
                  {d.knowledgeScore != null && (
                    <span className="ai-score-tag">知识评分：{d.knowledgeScore}</span>
                  )}
                </div>
                {(!d.aiSummary && d.processStatus === 'UNPROCESSED') ? (
                  <div className="drawer-skeleton-container">
                    <div className="drawer-skeleton-line title"></div>
                    <div className="drawer-skeleton-line full"></div>
                    <div className="drawer-skeleton-line medium"></div>
                    <div className="drawer-skeleton-line long"></div>
                    <div className="drawer-skeleton-text">正在全力分析知识结构...</div>
                  </div>
                ) : (
                  <p>
                    {d.aiSummary || (d.processStatus === 'FAILED' ? '生成摘要失败' : '暂无摘要')}
                  </p>
                )}
                {!d.aiSummary && d.processStatus !== 'UNPROCESSED' && onRegenerateSummary && (
                  <button
                    className="regenerate-summary-btn"
                    onClick={() => onRegenerateSummary(d.id)}
                  >
                    <Sparkles size={14} />
                    <span>重新生成摘要</span>
                  </button>
                )}
              </div>

              {/* User Notes */}
              <div className="user-notes">
                <div className="notes-header">
                  <Edit3 size={16} />
                  <span>这一刻什么打动了你？记录下来，将其升格为优质信息源...</span>
                </div>
                <textarea
                  className="notes-input"
                  placeholder="这一刻什么打动了你？记录下来，将其升格为优质信息源..."
                  value={draftNote ?? d.note ?? ''}
                  onChange={(e) => onNoteChange?.(e.target.value)}

                />
              </div>

              {/* Keyword Tags */}
              <div className="keyword-section">
                <div className="keyword-section-label">
                  <Tag size={14} /> 关键词（领域）
                </div>
                <div className="keyword-options">
                  {(suggestedKeywords || []).map(kw => {
                    const active = (selectedKeywords || []).includes(kw.label);
                    return (
                      <div
                        key={kw.label}
                        className={`keyword-chip ${active ? 'active' : ''}`}
                        onClick={() => onToggleKeyword?.(kw.label)}
                      >
                        {kw.label} {kw.isNew && <span className="new-badge">新</span>}
                        <button 
                          className="keyword-chip-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要彻底删除关键词“${kw.label}”吗？这将从系统中移除该领域。`)) {
                              onDeleteKeyword?.(kw.label);
                            }
                          }}
                          title="彻底删除该关键词"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button className="add-keyword-btn" onClick={onAddKeyword}>
                  + 添加关键词
                </button>
              </div>


            </div>

            <div className="drawer-footer">
              {isUpgrading ? (
                <button className="save-btn primary" disabled>
                   <div className="isc-spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />
                   AI 正在分析领域...
                </button>
              ) : d.hasNote ? (
                <button className="save-btn danger" onClick={() => onTogglePremium?.(d.id)}>
                  取消优质信息源标识
                </button>
              ) : (
                <button className="save-btn primary" onClick={onUpgrade}>
                  升格为优质信息源
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
