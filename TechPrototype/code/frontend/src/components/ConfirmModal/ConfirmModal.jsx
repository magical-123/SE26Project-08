import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import './ConfirmModal.css';

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = '确定', cancelText = '取消', danger = false }) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="confirm-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div className="confirm-modal-wrapper">
            <motion.div
              className="confirm-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.8 }}
            >
            <div className="confirm-glow-border" />
            <div className="confirm-icon-wrapper">
              <AlertTriangle size={24} />
            </div>
            <h3 className="confirm-title">{title}</h3>
            <p className="confirm-message">{message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={onClose}>
                {cancelText}
              </button>
              <button
                className={`confirm-btn ${danger ? 'danger' : 'primary'}`}
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
