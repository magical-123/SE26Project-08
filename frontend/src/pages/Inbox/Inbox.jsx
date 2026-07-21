import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { InfoSourceCard } from '../../components/InfoSourceCard/InfoSourceCard';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { graphApi, crawlApi } from '../../utils/api';
import './Inbox.css';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Inbox() {
  const [filter, setFilter] = useState('All');
  const { items, togglePremium, toggleLike, toggleFavorite, regenerateSummary, saveNote, updateItem, loading, error, hasMore, loadMore, refetching } = useInboxItems();
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftNote, setDraftNote] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState([]);

  const filteredItems = filter === 'All' ? items : items.filter(item => item.platform === filter);
  const aiSummaryCount = items.filter(i => i.aiSummary).length;
  const totalCount = items.length;

  const unprocessedCount = items.filter(i => !i.aiSummary && i.processStatus === 'UNPROCESSED').length;
  
  const [batchTotal, setBatchTotal] = useState(0);

  useEffect(() => {
    if (unprocessedCount > batchTotal) {
      setBatchTotal(unprocessedCount);
    } else if (unprocessedCount === 0 && batchTotal !== 0) {
      setBatchTotal(0);
    }
  }, [unprocessedCount, batchTotal]);

  const batchProcessedCount = Math.max(0, batchTotal - unprocessedCount);
  const processingPercent = batchTotal === 0 ? 0 : Math.round((batchProcessedCount / batchTotal) * 100);
  const isProcessing = unprocessedCount > 0;

  // 切换平台筛选时，如果当前过滤结果为空且还有更多数据，自动加载更多
  useEffect(() => {
    if (filter === 'All') return;
    if (filteredItems.length > 0) return;
    if (!hasMore || loading) return;

    const key = `inbox:autoload:${filter}`;
    const attempts = parseInt(sessionStorage.getItem(key) || '0', 10);
    if (attempts >= 10) return; // 最多自动加载 10 页，防止无限请求

    sessionStorage.setItem(key, (attempts + 1).toString());
    const timer = setTimeout(() => loadMore(), 100);
    return () => clearTimeout(timer);
  }, [filter, filteredItems.length, hasMore, loading]);

  // 切换 filter 时重置自动加载计数
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    if (newFilter !== 'All') {
      sessionStorage.removeItem(`inbox:autoload:${newFilter}`);
    }
  };

  const openDrawer = async (item) => {
    setSelectedItem(item);
    setDraftNote(item.note || '');
    
    // 初始化空状态
    setSelectedKeywords([]);
    setSuggestedKeywords([]);
    
    // 获取关键词
    try {
      const concepts = await graphApi.getItemKeywords(item.id);
      const kws = concepts.map(c => c.label);
      setSelectedKeywords(kws);
      setSuggestedKeywords(kws.map(label => ({ label, isNew: false }))); 
    } catch (e) {
      console.error('获取关键词失败:', e);
    }

    if (!item.opened) {
      updateItem(item.id, { opened: true });
    }
  };

  const toggleKeyword = (kw) => {
    setSelectedKeywords(prev =>
      prev.includes(kw) ? prev.filter(t => t !== kw) : [...prev, kw]
    );
  };
  
  const handleAddKeyword = () => {
    const kw = prompt('请输入新关键词：');
    if (kw && !selectedKeywords.includes(kw)) {
      setSelectedKeywords(prev => [...prev, kw]);
      if (!suggestedKeywords.find(s => s.label === kw)) {
        setSuggestedKeywords(prev => [...prev, { label: kw, isNew: true }]);
      }
    }
  };

  const handleDeleteKeyword = async (label) => {
    if (!label) return;
    try {
      await graphApi.deleteKeyword(label);
      // Update local state to remove the deleted keyword
      setSelectedKeywords(prev => prev.filter(k => k !== label));
      setSuggestedKeywords(prev => prev.filter(k => k.label !== label));
      // Optionally trigger refetch if you want the graph to update immediately
      sessionStorage.setItem('inbox:shouldRefetch', 'true');
    } catch (e) {
      console.error('删除关键词失败:', e);
      alert('删除失败，请稍后重试');
    }
  };

  const handleCloseDrawer = () => {
    if (selectedItem) {
      updateItem(selectedItem.id, { note: draftNote, keywords: selectedKeywords });
      graphApi.updateItemKeywords(selectedItem.id, selectedKeywords.map(label => ({ 
        label, 
        isNew: suggestedKeywords.find(s => s.label === label)?.isNew || false 
      })));
    }
    setSelectedItem(null);
  };

  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!selectedItem) return;
    
    // 保存本地修改和设为优质信息源
    saveNote(selectedItem.id, draftNote, selectedKeywords);
    
    setIsUpgrading(true);
    try {
      const suggestions = await graphApi.analyzeKeywords(selectedItem.id, draftNote);
      
      const newKeywords = [...suggestedKeywords];
      const newSelected = [...selectedKeywords];
      
      suggestions.forEach(s => {
        if (!newKeywords.find(k => k.label === s.label)) {
          newKeywords.push(s);
        }
        if (!newSelected.includes(s.label)) {
          newSelected.push(s.label);
        }
      });
      
      setSuggestedKeywords(newKeywords);
      setSelectedKeywords(newSelected);
      
      // 更新到后端
      await graphApi.updateItemKeywords(selectedItem.id, newSelected.map(label => ({ 
        label, 
        isNew: newKeywords.find(s => s.label === label)?.isNew || false 
      })));
      
    } catch (e) {
      console.error(e);
      alert('AI推荐领域失败，请稍后重试');
    } finally {
      setIsUpgrading(false);
      
      // 重新拉取以获取正确的 isNew 状态
      try {
        const concepts = await graphApi.getItemKeywords(selectedItem.id);
        const kws = concepts.map(c => c.label);
        setSelectedKeywords(kws);
        setSuggestedKeywords(kws.map(label => ({ label, isNew: false }))); 
      } catch (err) {}
    }
  };

  const handleTogglePremium = (id) => {
    togglePremium(id);
  };

  const handleToggleLike = (id) => {
    toggleLike(id);
  };

  const handleToggleFavorite = (id) => {
    toggleFavorite(id);
  };

  const handleRegenerateSummary = async (id) => {
    try {
      await regenerateSummary(id);
      alert('已重新触发该卡片的 AI 摘要生成，请稍后刷新查看');
    } catch (err) {
      alert('重新生成摘要失败：' + err.message);
    }
  };

  const handleManualUpdate = async () => {
    try {
      await crawlApi.trigger('all');
      alert('爬虫已启动，新数据将在几分钟内同步到 Inbox');
    } catch (err) {
      alert('启动爬虫失败：' + err.message);
    }
  };

  const getPremiumLabel = (item) => {
    return '优质信息源';
  };

  return (
    <div className="inbox">
      <header className="inbox-header-wrapper">
        <div className="inbox-header-top">
          <div>
            <h1>捕获箱 (Inbox)</h1>
            <div className="inbox-subtitle">
              共捕获 <strong>{totalCount}</strong> 条内容，其中 <strong>{aiSummaryCount}</strong> 条已生成 AI 摘要
            </div>
          </div>
          <div className="inbox-filters">
            {['All', 'Bilibili', 'Zhihu', 'Xiaohongshu', 'GitHub'].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => handleFilterChange(f)}
              >
                {f}
              </button>
            ))}
            <button className="filter-btn manual-update-btn" onClick={handleManualUpdate}>
              🔄 手动更新
            </button>
          </div>
        </div>
        
        {isProcessing && (
          <div className="inbox-progress-container">
            <div className="inbox-progress-header">
              <span className="progress-label">✨ AI 正在努力分析中...</span>
              <span className="progress-text">{batchProcessedCount} / {batchTotal}</span>
            </div>
            <div className="inbox-progress-bar-bg">
              <motion.div 
                className="inbox-progress-bar-fill" 
                initial={{ width: 0 }}
                animate={{ width: `${processingPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
          </div>
        )}
      </header>

      {/* 自动抓取提示 */}
      {refetching && (
        <div className="inbox-refetching-banner">
          <div className="refetching-spinner" />
          <span>正在后台抓取最新数据，请稍候...</span>
        </div>
      )}

      <motion.div
        className="inbox-grid"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {filteredItems.map(item => (
          <motion.div key={item.id} variants={itemVariants}>
            <InfoSourceCard
              data={item}
              isPremium={item.hasNote}
              premiumLabel={getPremiumLabel(item)}
              onTogglePremium={handleTogglePremium}
              onToggleLike={handleToggleLike}
              onToggleFavorite={handleToggleFavorite}
              onClick={() => openDrawer(item)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* 加载状态 */}
      {loading && (
        <div className="inbox-loading">
          <div className="loading-spinner" />
          <span>加载中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="inbox-error">
          ⚠️ {error}
        </div>
      )}

      {/* 自动加载中提示 */}
      {!loading && filter !== 'All' && hasMore && filteredItems.length === 0 && items.length > 0 && (
        <div className="inbox-loading">
          <div className="loading-spinner" />
          <span>正在加载 {filter} 平台数据...</span>
        </div>
      )}

      {/* 加载更多 */}
      {!loading && hasMore && (filter === 'All' || filteredItems.length > 0) && (
        <div className="inbox-load-more">
          <button className="load-more-btn" onClick={loadMore} disabled={loading}>
            加载更多 ↓
          </button>
          <span className="load-more-count">
            已显示 {filter === 'All' ? items.length : filteredItems.length} 条
          </span>
        </div>
      )}

      {/* 全部加载完成 */}
      {!loading && !hasMore && items.length > 0 && (
        <div className="inbox-load-more">
          <span className="load-more-count">
            已显示全部 {filter === 'All' ? items.length : filteredItems.length} 条
          </span>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !hasMore && filteredItems.length === 0 && (
        <div className="inbox-empty">
          <p>{filter === 'All' ? '📭 暂无捕获的信息项' : `📭 暂无 ${filter} 平台数据`}</p>
          <p className="inbox-empty-hint">
            {filter === 'All' ? '连接平台授权后，爬虫会自动抓取内容到这里' : '请确认该平台已连接授权，或稍等爬虫完成抓取'}
          </p>
        </div>
      )}

      <DetailDrawer
        isOpen={!!selectedItem}
        onClose={handleCloseDrawer}
        data={selectedItem}
        draftNote={draftNote}
        suggestedKeywords={suggestedKeywords}
        selectedKeywords={selectedKeywords}
        onNoteChange={setDraftNote}
        onToggleKeyword={toggleKeyword}
        onAddKeyword={handleAddKeyword}
        onDeleteKeyword={handleDeleteKeyword}
        onUpgrade={handleUpgrade}
        isUpgrading={isUpgrading}
        onTogglePremium={(id) => {
          handleTogglePremium(id);
          setSelectedItem(null);
        }}
        onRegenerateSummary={handleRegenerateSummary}
        sourceTitle={selectedItem?.title}
      />
    </div>
  );
}
