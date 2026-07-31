import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, BrainCircuit, Quote, Loader2, RefreshCw } from 'lucide-react';
import { personaApi } from '../../utils/api';
import './AIPersonaWidget.css';

export const AIPersonaWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [personaData, setPersonaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const safeString = (val, defaultVal = '') => {
    if (!val) return defaultVal;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.text || val.content || val.name || val.title || val.quote || JSON.stringify(val);
    }
    return String(val);
  };

  useEffect(() => {
    let ignore = false;
    
    const fetchPersona = async (forceRefresh = false) => {
      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        
        const res = await personaApi.getPersona(forceRefresh);
        if (!ignore) {
          if (res.success && res.data) {
            setPersonaData(res.data);
          } else {
            setError('无法生成画像');
          }
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch AI persona:', err);
          setError('加载失败，请检查网络或后端服务');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    fetchPersona(false);
    
    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    if (!refreshing) {
      try {
        setRefreshing(true);
        const res = await personaApi.getPersona(true);
        if (res.success && res.data) {
          setPersonaData(res.data);
        } else {
          setError('无法生成画像');
        }
      } catch (err) {
        console.error('Failed to refresh AI persona:', err);
        setError('刷新失败，请检查网络或后端服务');
      } finally {
        setRefreshing(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="ai-persona-container">
        <motion.div className="ai-persona-collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="ai-persona-collapsed-inner">
            <div className="ai-pulse-orb">
              <Loader2 size={18} className="ai-icon sparkle-icon" />
            </div>
            <div className="ai-persona-brief">
              <span className="ai-title">AI 正在凝视你的灵魂...</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error || !personaData) {
    // Optionally return nothing or an error state pill
    return null; 
  }

  return (
    <div className="ai-persona-container">
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            className="ai-persona-collapsed"
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
          >
            <div className="ai-persona-collapsed-inner">
              <div className="ai-pulse-orb">
                <BrainCircuit size={18} className="ai-icon" />
              </div>
              <div className="ai-persona-brief">
                <span className="ai-title">AI 眼中的你</span>
                <span className="ai-subtitle">{safeString(personaData.personaTitle, '暂无称号')}</span>
              </div>
              <Sparkles size={16} className="sparkle-icon" />
            </div>
            <div className="ai-hover-glow" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="ai-persona-expanded"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <div className="ai-persona-actions">
              <button 
                className="ai-action-btn" 
                onClick={handleRefresh} 
                title="重新生成画像"
                disabled={refreshing}
              >
                <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
              </button>
              <button className="ai-action-btn" onClick={() => setIsExpanded(false)} title="关闭">
                <X size={20} />
              </button>
            </div>
            
            <div className={`ai-persona-header ${refreshing ? 'refreshing-overlay' : ''}`}>
              <div className="ai-avatar-wrapper">
                <div className="ai-avatar-glow" />
                <BrainCircuit size={32} className="ai-avatar-icon" />
              </div>
              <h2 className="ai-hero-title">{safeString(personaData.personaTitle, '暂无称号')}</h2>
              <p className="ai-poetic-summary">{safeString(personaData.poeticSummary)}</p>
              {refreshing && (
                <div className="refreshing-text">
                  <Loader2 size={16} className="sparkle-icon" />
                  <span>AI 正在重新凝视...</span>
                </div>
              )}
            </div>

            <div className={`ai-persona-body ${refreshing ? 'blur-content' : ''}`}>
              <div className="ai-section">
                <h3 className="ai-section-title">核心灵魂标签</h3>
                <div className="ai-traits-list">
                  {(Array.isArray(personaData.coreTraits) 
                    ? personaData.coreTraits 
                    : (typeof personaData.coreTraits === 'string' 
                        ? personaData.coreTraits.split(/[,，\s]+/).filter(Boolean) 
                        : [])
                  ).map((trait, index) => {
                    const label = typeof trait === 'string' ? trait : (trait?.name || trait?.label || JSON.stringify(trait));
                    return (
                      <span key={index} className="ai-trait-badge">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="ai-section ai-insight-section">
                <h3 className="ai-section-title">
                  <Sparkles size={16} className="insight-icon" />
                  深度洞察
                </h3>
                <p className="ai-insight-text">
                  {safeString(personaData.deepInsight, '暂无洞察')}
                </p>
              </div>

              {personaData.goldenQuote && (
                <div className="ai-section ai-quote-section">
                  <Quote size={24} className="quote-icon-bg" />
                  <p className="ai-golden-quote">
                    "{safeString(personaData.goldenQuote)}"
                  </p>
                </div>
              )}
            </div>
            <div className="ai-persona-footer">
              基于你近期的优质阅读生成
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
