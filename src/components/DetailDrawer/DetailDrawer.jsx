import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Edit3 } from 'lucide-react';
import './DetailDrawer.css';

export function DetailDrawer({ isOpen, onClose, data, title }) {
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
              <h2>{title || data?.title || 'Details'}</h2>
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
                  <span>我的笔记</span>
                </div>
                <textarea 
                  className="notes-input" 
                  placeholder="这一刻什么打动了你？记录下来，将其升格为优质信息源..."
                  defaultValue={data?.note || ''}
                />
              </div>
            </div>
            
            <div className="drawer-footer">
              <button className="save-btn">保存并升格</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
