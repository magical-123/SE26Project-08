import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { ChevronLeft, ChevronRight, ExternalLink, Quote as QuoteIcon, RefreshCw } from 'lucide-react';
import './RotatingQuoteCard.css';

/**
 * 旋转金句卡片组件
 * - bento 网格中每次随机显示一条金句
 * - 每 10 秒自动轮换
 * - 点击卡片打开复习卡片界面，可前后翻阅
 */
export function RotatingQuoteCard({ quotes }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // 随机选一个初始索引
  const randomIndex = useCallback(() => Math.floor(Math.random() * Math.max(quotes.length, 1)), [quotes.length]);

  useEffect(() => {
    if (quotes.length === 0) return;
    setCurrentIndex(randomIndex());
  }, [quotes.length, randomIndex]);

  // 自动轮换
  useEffect(() => {
    if (quotes.length < 2) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        let next;
        do { next = Math.floor(Math.random() * quotes.length); } while (next === prev && quotes.length > 1);
        return next;
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [quotes.length]);

  if (!quotes || quotes.length === 0) {
    return (
      <div className="bento-rotating-quote">
        <GlassCard className="rq-card rq-empty">
          <QuoteIcon size={24} className="rq-empty-icon" />
          <p>暂无金句摘录</p>
        </GlassCard>
      </div>
    );
  }

  const currentQuote = quotes[currentIndex];

  const handleCardClick = () => {
    setModalIndex(currentIndex);
    setIsModalOpen(true);
  };

  const navigatePrev = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev - 1 + quotes.length) % quotes.length);
  };

  const navigateNext = (e) => {
    e.stopPropagation();
    setModalIndex(prev => (prev + 1) % quotes.length);
  };

  return (
    <>
      <div className="bento-rotating-quote">
        <motion.div
          whileHover={{ y: -4 }}
          style={{ cursor: 'pointer', height: '100%' }}
          onClick={handleCardClick}
        >
          <GlassCard className="rq-card">
            <div className="rq-header">
              <div className="rq-header-left">
                <QuoteIcon size={14} className="rq-icon" />
                <span className="rq-title">金句摘录</span>
              </div>
              <span className="rq-counter">{currentIndex + 1}/{quotes.length}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.blockquote
                key={currentIndex}
                className="rq-content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                "{currentQuote.content}"
              </motion.blockquote>
            </AnimatePresence>

            <div className="rq-footer">
              <span className="rq-source">
                {currentQuote.sourcePlatform} · {currentQuote.sourceTitle?.substring(0, 16)}
                {currentQuote.sourceTitle?.length > 16 ? '...' : ''}
              </span>
              <span className="rq-hint">点击翻阅</span>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* 复习卡片弹窗 */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="rq-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              className="rq-modal"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* 导航头部 */}
              <div className="rq-modal-header">
                <button className="rq-nav-btn" onClick={navigatePrev}>
                  <ChevronLeft size={20} />
                </button>
                <span className="rq-modal-counter">
                  {modalIndex + 1} / {quotes.length}
                </span>
                <button className="rq-nav-btn" onClick={navigateNext}>
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* 金句内容区域 */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={modalIndex}
                  className="rq-modal-body"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                >
                  <QuoteIcon size={28} className="rq-modal-quote-icon" />
                  <blockquote className="rq-modal-quote">
                    "{quotes[modalIndex].content}"
                  </blockquote>
                  {quotes[modalIndex].reason && (
                    <p className="rq-modal-reason">—— {quotes[modalIndex].reason}</p>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* 底部来源信息 */}
              <div className="rq-modal-footer">
                <div className="rq-modal-source">
                  <span className="rq-modal-platform">{quotes[modalIndex].sourcePlatform}</span>
                  <span className="rq-modal-title">{quotes[modalIndex].sourceTitle}</span>
                </div>
                {quotes[modalIndex].sourceUrl && (
                  <a
                    href={quotes[modalIndex].sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rq-modal-link"
                    onClick={e => e.stopPropagation()}
                  >
                    查看原文 <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
