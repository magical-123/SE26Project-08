import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, X, Tag } from 'lucide-react';
import { GlassCard } from '../GlassCard/GlassCard';
import './AIQuoteCard.css';

export function AIQuoteCard({ quote }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Level 1 & 2: The Card in the Bento Grid */}
      <motion.div
        layoutId={`quote-${quote.id}`}
        className={`ai-quote-wrapper ${isHovered ? 'hover-active' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsModalOpen(true)}
        whileHover={{ y: -4 }}
      >
        <GlassCard className={`ai-quote-card ${isHovered ? 'hovered' : ''}`}>
          <motion.h3 layout="position">💡 AI 洞察金句</motion.h3>
          
          <motion.p layout="position" className="quote-text">
            {isHovered ? quote.fullText : quote.summary}
          </motion.p>

          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="quote-hover-details"
              >
                <div className="quote-tags">
                  {quote.tags.map(tag => (
                    <span key={tag} className="quote-tag"><Tag size={10} style={{marginRight: 4}}/> {tag}</span>
                  ))}
                </div>
                <div className="quote-source-mini">
                  {quote.sourcePlatform}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* Level 3: The Full Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="ai-quote-modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div
              layoutId={`quote-${quote.id}`}
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
