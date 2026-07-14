import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Edit3, PlayCircle, FileText, Mic, Clock, Calendar } from 'lucide-react';
import './DetailDrawer.css';

const TAG_OPTIONS = ['兴趣', '实用', '震撼', '共鸣'];
const CATEGORY_COLORS = {
  '深度知识': '#10B981',
  '实用技巧': '#0EA5E9',
  '行业资讯': '#F59E0B',
  '娱乐科普': '#F43F5E',
};

const platformIcon = {
  Bilibili: <PlayCircle size={14} />,
  Zhihu: <FileText size={14} />,
  Podcast: <Mic size={14} />,
};

function getTagColor(tag) {
  switch (tag) {
    case '兴趣': return '#8B5CF6';
    case '实用': return '#10B981';
    case '震撼': return '#F43F5E';
    case '共鸣': return '#F59E0B';
    default: return '#0EA5E9';
  }
}

export function DetailDrawer({ isOpen, onClose, data, draftNote, draftTags, onNoteChange, onToggleTag, onUpgrade, onTogglePremium, sourceTitle }) {
  const d = data?.data || data || {};
  const categoryColor = CATEGORY_COLORS[d.category] || '#0EA5E9';
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
            <div className="drawer-glow-border" style={{ '--accent': categoryColor }} />

            <div className="drawer-header">
              <div className="drawer-header-content">
                <span className="drawer-category-pill" style={{ color: categoryColor, borderColor: categoryColor }}>
                  {d.category || '知识节点'}
                </span>
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
                </div>
                <p>
                  {d.summary || '系统已经对该信息源进行了智能解析。本文探讨了相关领域的核心概念和未来发展趋势，是一篇高质量的内容。'}
                </p>
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

              {/* Emotion Tags */}
              <div className="tag-section">
                <div className="tag-section-label">情感标签</div>
                <div className="tag-options">
                  {TAG_OPTIONS.map(tag => {
                    const active = (draftTags || d.tags || []).includes(tag);
                    const color = getTagColor(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`tag-chip ${active ? 'active' : ''}`}
                        style={{ '--tag-color': color }}
                        onClick={() => onToggleTag?.(tag)}

                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>


            </div>

            <div className="drawer-footer">
              {d.hasNote ? (
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
