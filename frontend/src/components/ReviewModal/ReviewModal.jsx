import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import './ReviewModal.css';

export function ReviewModal({ cards, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = cards[currentIndex];

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 150);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex - 1), 150);
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

      <div className="review-progress">
        {currentIndex + 1} / {cards.length}
      </div>

      <div className="review-content-area" onClick={(e) => e.stopPropagation()}>
        <button 
          className="nav-btn prev-btn" 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={32} />
        </button>

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
            </div>
          </motion.div>
        </div>

        <button 
          className="nav-btn next-btn" 
          onClick={handleNext} 
          disabled={currentIndex === cards.length - 1}
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </div>
  );
}
