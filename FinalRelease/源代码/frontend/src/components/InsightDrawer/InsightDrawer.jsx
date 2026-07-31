import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Calendar, Clock } from 'lucide-react';
import './InsightDrawer.css';

export function InsightDrawer({ isOpen, onClose, insight, reportType }) {
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!insight) return null;

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
            className="insight-drawer"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 32, stiffness: 300, mass: 0.9 }}
          >
            <div className="drawer-glow-border" style={{ '--accent': '#8B5CF6' }} />

            <div className="drawer-header">
              <div className="drawer-header-content">
                <span className="drawer-category-pill" style={{ color: '#8B5CF6', borderColor: '#8B5CF6' }}>
                  {reportType === 'weekly' ? '周报洞察' : '日报洞察'}
                </span>
                <h2>{insight.insightTitle}</h2>
              </div>
              <button className="close-btn" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-meta">
                <div className="meta-item">
                  <Calendar size={13} />
                  <span>{insight.reportDate}</span>
                </div>
                <span className="meta-divider" />
                <div className="meta-item">
                  <Clock size={13} />
                  <span>版本 {insight.version}</span>
                </div>
                <span className="meta-divider" />
                <div className="meta-item">
                  <span>{new Date(insight.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>

              <div className="ai-summary-card">
                <div className="ai-summary-glow" />
                <div className="ai-summary-header">
                  <Sparkles size={16} />
                  <span>AI 洞察详情</span>
                </div>
                <div className="insight-full-text">
                  {insight.insightFullText.split('\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
