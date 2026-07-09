import React from 'react';
import './GlassCard.css';

export function GlassCard({ children, className = '', ...props }) {
  return (
    <div className={`glass-card ${className}`} {...props}>
      {children}
    </div>
  );
}
