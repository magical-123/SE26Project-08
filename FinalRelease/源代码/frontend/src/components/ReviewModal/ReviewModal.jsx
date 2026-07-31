import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './ReviewModal.css';

export function ReviewModal({ cards, onClose }) {
  const [sessionCards, setSessionCards] = useState([...cards]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSessionCards([...cards]);
  }, [cards]);

  const currentCard = sessionCards[0];
  const isDefaultCard = currentCard && currentCard.id === -1;

  const handleFeedback = async (e, remembered) => {
    e.stopPropagation();
    if (submitting || isDefaultCard) return;

    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await fetch(`/api/dashboard/reviews/${currentCard.id}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ remembered })
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
      setIsFlipped(false);
      setTimeout(() => {
        setSessionCards(prev => prev.slice(1));
      }, 150);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (submitting || isDefaultCard) return;

    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await fetch(`/api/dashboard/reviews/${currentCard.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to delete card:', error);
    } finally {
      setSubmitting(false);
      setIsFlipped(false);
      setTimeout(() => {
        setSessionCards(prev => prev.slice(1));
      }, 150);
    }
  };

  const toggleFlip = (e) => {
    e.stopPropagation();
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <button className="review-close-btn" onClick={onClose}>
        <X size={32} />
      </button>

      {sessionCards.length > 0 ? (
        <>
          <div className="review-progress">
            剩余 {sessionCards.length} 张
          </div>

          <div className="review-content-area" onClick={(e) => e.stopPropagation()}>
            <div className="review-scene" onClick={toggleFlip}>
              <motion.div
                className="review-card-container"
                initial={false}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                {/* Front of the card (Question/Title) */}
                <div className="rc-face rc-front">
                  <span className="rc-hint">点击翻转查看背面</span>
                  <h2>{currentCard.title}</h2>
                  <div className="rc-source">{currentCard.source}</div>
                </div>

                {/* Back of the card (Answer/Content) */}
                <div className="rc-face rc-back">
                  <div className="rc-back-content">
                    <p>{currentCard.content}</p>
                  </div>
                  {!isDefaultCard && (
                    <div className="rc-actions">
                      <button 
                        className="memory-btn hard" 
                        onClick={(e) => handleFeedback(e, false)}
                        disabled={submitting}
                      >
                        忘记了
                      </button>
                      <button 
                        className="memory-btn good" 
                        onClick={(e) => handleFeedback(e, true)}
                        disabled={submitting}
                      >
                        记住了
                      </button>
                      <button 
                        className="memory-btn delete" 
                        style={{ background: '#4b5563' }}
                        onClick={handleDelete}
                        disabled={submitting}
                        title="不再复习此卡片"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </>
      ) : (
        <div className="review-content-area" onClick={(e) => e.stopPropagation()}>
          <div className="review-scene">
             <div className="review-card-container">
                <div className="rc-face rc-front" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <h2>太棒了！</h2>
                  <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>今天的复习任务已全部完成。</p>
                  <button 
                    style={{ marginTop: '2rem', padding: '0.8rem 1.5rem', background: 'var(--primary)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    onClick={onClose}
                  >
                    关闭
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
