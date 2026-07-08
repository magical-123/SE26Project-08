import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Edit3 } from 'lucide-react';
import './DetailDrawer.css';

const TAG_OPTIONS = ['兴趣', '实用', '震撼', '共鸣'];

export function DetailDrawer({ isOpen, onClose, data, draftNote, draftTags, onNoteChange, onToggleTag, onSave, sourceTitle }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="detail-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="drawer-header">
              <h2>{sourceTitle || data?.title || '详情'}</h2>
              <button className="close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="ai-summary">
                <div className="ai-summary-header">
                  <Sparkles size={16} />
                  <span>AI 摘要</span>
                </div>
                <p>
                  {data?.summary || '系统已经对该信息源进行了智能解析。本文探讨了相关领域的核心概念和未来发展趋势，是一篇高质量的内容。'}
                </p>
              </div>

              <div className="user-notes">
                <div className="notes-header">
                  <Edit3 size={16} />
                  <span>{data?.hasNote ? '已升格 - 编辑笔记' : '这一刻什么打动了你？记录下来，将其升格为优质信息源...'}</span>
                </div>
                <textarea
                  className="notes-input"
                  placeholder="这一刻什么打动了你？记录下来，将其升格为优质信息源..."
                  value={draftNote ?? data?.note ?? ''}
                  onChange={(e) => onNoteChange?.(e.target.value)}
                  readOnly={!!data?.hasNote}
                />
              </div>

              <div className="tag-section">
                <div className="tag-section-label">情感标签</div>
                <div className="tag-options">
                  {TAG_OPTIONS.map(tag => {
                    const active = (draftTags || data?.tags || []).includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`tag-chip ${active ? 'active' : ''}`}
                        onClick={() => onToggleTag?.(tag)}
                        disabled={!!data?.hasNote}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {data?.note && (
                <div className="existing-note">
                  <div className="existing-note-label">当前笔记</div>
                  <p>{data.note}</p>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              {!data?.hasNote ? (
                <button className="save-btn" onClick={onSave}>
                  保存并升格
                </button>
              ) : (
                <button className="save-btn saved" disabled>
                  已升格
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
