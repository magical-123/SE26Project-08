import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { ExternalLink, Quote as QuoteIcon } from 'lucide-react';
import './QuoteCard.css';

export function QuoteCard({ quote }) {
  if (!quote) return null;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="quote-extract-wrapper"
    >
      <GlassCard className="quote-extract-card">
        <div className="qe-header">
          <QuoteIcon size={16} className="qe-icon" />
          <span className="qe-source">
            {quote.sourcePlatform} · {quote.sourceTitle?.substring(0, 20)}
            {quote.sourceTitle?.length > 20 ? '...' : ''}
          </span>
          {quote.sourceUrl && (
            <a
              href={quote.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="qe-link"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <blockquote className="qe-content">
          "{quote.content}"
        </blockquote>
        {quote.reason && (
          <p className="qe-reason">—— {quote.reason}</p>
        )}
      </GlassCard>
    </motion.div>
  );
}
