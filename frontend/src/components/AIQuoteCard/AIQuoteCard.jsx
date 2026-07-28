import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, X, Tag, RefreshCw } from 'lucide-react';
import { GlassCard } from '../GlassCard/GlassCard';
import './AIQuoteCard.css';

const API_BASE = '';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function AIQuoteCard({ quote, onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async (e) => {
    e.stopPropagation(); // 防止触发卡片点击
    setIsRegenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/insights/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        // 重新生成成功，触发父组件刷新数据
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        console.error('Failed to regenerate insight');
      }
    } catch (error) {
      console.error('Error regenerating insight:', error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      {/* The Card in the Bento Grid - 只显示摘要 */}
      <motion.div
        whileHover={{ y: -4 }}
        className="ai-quote-wrapper"
        onClick={() => setIsModalOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        <GlassCard className="ai-quote-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3>💡 AI 洞察金句</h3>
            <button
              className="regenerate-btn"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              title="重新生成洞察"
            >
              <RefreshCw size={16} className={isRegenerating ? 'spinning' : ''} />
            </button>
          </div>

          <p className="quote-text">{quote.summary}</p>
        </GlassCard>
      </motion.div>

      {/* Full Modal - 点击卡片时显示 */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="ai-quote-modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="ai-quote-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>

              <div className="modal-header">
                <h2>💡 深度洞察笔记</h2>
                <div className="modal-tags">
                  {quote.tags.map(tag => (
                    <span key={tag} className="modal-tag">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="modal-body">
                <p className="modal-full-text">{quote.fullText}</p>

                <div className="modal-source-card">
                  <div className="ms-info">
                    <span className="ms-label">信息溯源</span>
                    <span className="ms-platform">{quote.sourcePlatform}</span>
                  </div>
                  <a href={quote.sourceLink} target="_blank" rel="noreferrer" className="ms-link-btn">
                    前往原文 <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
