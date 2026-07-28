import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { InfoSourceCard } from '../../components/InfoSourceCard/InfoSourceCard';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { useInboxItems } from '../../hooks/useInboxItems';
import { graphApi, crawlApi, settingsApi } from '../../utils/api';
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

const toKeywordSuggestions = (concepts = []) => concepts.map(c => ({
  label: c.label,
  isNew: false,
  confidence: c.confidence,
  reason: c.reason,
}));

export function Inbox() {
  const [filter, setFilter] = useState('All');
  const { items, togglePremium, regenerateSummary, saveNote, updateItem, loading, error, totalItems, totalPages, currentPage, fetchPage, refetching } = useInboxItems();
  const [selectedItem, setSelectedItem] = useState(null);
  const [draftNote, setDraftNote] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState([]);

  const aiSummaryCount = items.filter(i => i.aiSummary).length;
  const totalCount = totalItems;

  const unprocessedCount = items.filter(i => !i.aiSummary && i.processStatus === 'UNPROCESSED').length;
  
  const [batchTotal, setBatchTotal] = useState(0);

  const [toast, setToast] = useState(null);
  const reauthNotifiedRef = useRef(false);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    let cancelled = false;

    const checkBilibiliAuthorization = async () => {
      try {
        const status = await settingsApi.getPlatforms();
        if (cancelled) return;
        const bilibili = status.platforms?.find(item => item.key === 'bilibili');
        if (bilibili?.needsReauth && !reauthNotifiedRef.current) {
          reauthNotifiedRef.current = true;
          showToast('B站授权已过期，请前往设置页重新扫码登录', 'error');
        } else if (!bilibili?.needsReauth) {
          reauthNotifiedRef.current = false;
        }
      } catch {
        // 状态查询失败不影响 Inbox 主列表。
      }
    };

    checkBilibiliAuthorization();
    const intervalId = window.setInterval(checkBilibiliAuthorization, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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

  // 切换 filter 时请求后端第 0 页
  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    fetchPage(0, newFilter);
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
      // 根据后端 highlighted 字段决定初始高亮状态
      const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
      setSelectedKeywords(highlighted);
      setSuggestedKeywords(toKeywordSuggestions(concepts));
    } catch (e) {
      console.error('获取关键词失败:', e);
    }

    if (!item.opened) {
      updateItem(item.id, { opened: true });
    }
  };

  const toggleKeyword = (kw) => {
    if (!selectedItem) return;
    // 调用后端切换高亮状态，成功后更新本地状态
    graphApi.toggleItemKeyword(selectedItem.id, kw).then(concepts => {
      const kws = concepts.map(c => c.label);
      const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
      setSelectedKeywords(highlighted);
      setSuggestedKeywords(toKeywordSuggestions(concepts));
    }).catch(e => console.error('切换高亮失败:', e));
  };
  
  const handleAddKeyword = () => {
    const kw = prompt('请输入新关键词：');
    if (kw && !selectedKeywords.includes(kw)) {
      setSelectedKeywords(prev => {
        const updated = [...prev, kw];
        if (selectedItem) {
          graphApi.updateItemKeywords(selectedItem.id, updated.map(label => ({
            label,
            isNew: suggestedKeywords.find(s => s.label === label)?.isNew || false
          }))).catch(e => console.error('添加关键词失败:', e));
        }
        return updated;
      });
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
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  const handleCloseDrawer = () => {
    if (selectedItem) {
      updateItem(selectedItem.id, { note: draftNote });
    }
    setSelectedItem(null);
  };

  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!selectedItem) return;
    
    // 保存本地修改和设为优质信息源
    saveNote(selectedItem.id, draftNote, selectedKeywords);
    
    setIsUpgrading(true);
    let analyzeSuccess = false;
    let newKeywords = [...suggestedKeywords];
    let newSelected = [...selectedKeywords];

    try {
      // 第一步：调用 AI 推荐关键词
      const suggestions = await graphApi.analyzeKeywords(selectedItem.id, draftNote);
      
      suggestions.forEach(s => {
        if (!newKeywords.find(k => k.label === s.label)) {
          newKeywords.push(s);
        }
        // AI 决定是否默认选中（兼容旧数据则默认选中）
        if (s.isSelected !== false && !newSelected.includes(s.label)) {
          newSelected.push(s.label);
        }
      });
      
      // 容错：如果 AI 没选中任何关键词，默认选中最多前两个
      if (newSelected.length === 0 && suggestions.length > 0) {
        newSelected.push(suggestions[0].label);
        if (suggestions.length > 1) newSelected.push(suggestions[1].label);
      }
      
      // 立刻更新 UI 状态，让用户看到推荐的标签
      setSuggestedKeywords(newKeywords);
      setSelectedKeywords(newSelected);
      analyzeSuccess = true;
      
    } catch (e) {
      console.error('AI 推荐关键词失败:', e);
      showToast('AI推荐领域失败，请稍后重试', 'error');
    } finally {
      setIsUpgrading(false);
      
      // 重新拉取以获取正确的 isNew 状态
      try {
        const concepts = await graphApi.getItemKeywords(selectedItem.id);
        const kws = concepts.map(c => c.label);
        const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
        setSelectedKeywords(highlighted);
        setSuggestedKeywords(toKeywordSuggestions(concepts));
      } catch (err) {}
    }

    // 第二步：如果推荐成功，再尝试保存到后端
    if (analyzeSuccess && newSelected.length > 0) {
      try {
        await graphApi.updateItemKeywords(selectedItem.id, newSelected.map(label => ({ 
          label, 
          isNew: newKeywords.find(s => s.label === label)?.isNew || false 
        })));

        // 保存成功后，重新拉取以获取正确的 isNew 状态
        try {
          const concepts = await graphApi.getItemKeywords(selectedItem.id);
          const kws = concepts.map(c => c.label);
          const highlighted = concepts.filter(c => c.highlighted !== false).map(c => c.label);
          if (kws.length > 0) {
            setSelectedKeywords(highlighted);
            setSuggestedKeywords(toKeywordSuggestions(concepts));
          }
        } catch (err) {
          // 拉取失败不影响，保持当前 UI 状态
        }
      } catch (e) {
        console.error('保存关键词到后端失败:', e);
        // 保存失败但不清空 UI 上已展示的推荐标签，让用户仍然能看到并手动操作
      }
    }

    setIsUpgrading(false);
  };

  const handleTogglePremium = (id) => {
    togglePremium(id);
  };

  const handleRegenerateSummary = async (id) => {
    try {
      await regenerateSummary(id);
      showToast('已重新触发该卡片的 AI 摘要生成，请稍后刷新查看', 'info');
    } catch (err) {
      showToast('重新生成摘要失败：' + err.message, 'error');
    }
  };

  const handleManualUpdate = async () => {
    try {
      const platform = ['Bilibili', 'GitHub'].includes(filter)
        ? filter.toLowerCase()
        : 'all';
      await crawlApi.trigger(platform);
      showToast('爬虫已启动，新数据将在几分钟内同步到 Inbox', 'info');

      if (platform === 'bilibili') {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const status = await settingsApi.getPlatforms();
          const bilibili = status.platforms?.find(item => item.key === 'bilibili');
          if (bilibili?.needsReauth) {
            showToast('B站授权已过期，请前往设置页重新扫码登录', 'error');
            break;
          }
        }
      }
    } catch (err) {
      showToast('启动爬虫失败：' + err.message, 'error');
    }
  };

  const getPremiumLabel = (item) => {
    return '优质信息源';
  };

  // 生成分页页码数组（最多显示 7 个页码按钮）
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;
    const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
    let start = Math.max(0, safePage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible);
    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="inbox">
      <header className="inbox-header-wrapper">
        <div className="inbox-header-top">
          <div>
            <h1>捕获箱 (Inbox)</h1>
            <div className="inbox-subtitle">
              共捕获 <strong>{totalCount}</strong> 条内容，其中 <strong>{items.filter(i => i.hasNote).length}</strong> 条优质信息源，<strong>{aiSummaryCount}</strong> 条已生成 AI 摘要
            </div>
          </div>
          <div className="inbox-filters">
            {['All', 'Premium', 'Bilibili', 'Zhihu', 'Xiaohongshu', 'GitHub'].map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                data-premium={f === 'Premium' ? 'true' : undefined}
                onClick={() => handleFilterChange(f)}
              >
                {f === 'Premium' ? '优质信息源' : f}
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

      {/* Toast 通知 */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className={`inbox-banner ${toast.type === 'error' ? 'inbox-banner-error' : 'inbox-banner-info'}`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'} {toast.message}</span>
        </motion.div>
      )}

      {/* 自动抓取提示 */}
      {refetching && (
        <div className="inbox-banner inbox-banner-info">
          <div className="inbox-spinner" />
          <span>正在后台抓取最新数据，请稍候...</span>
        </div>
      )}

      <div className="inbox-scroll-area">
        <motion.div
          className="inbox-grid"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {items.map(item => (
            <motion.div key={item.id} variants={itemVariants}>
              <InfoSourceCard
                data={item}
                isPremium={item.hasNote}
                premiumLabel={getPremiumLabel(item)}
                onTogglePremium={handleTogglePremium}
                onClick={() => openDrawer(item)}
              />
            </motion.div>
          ))}
        </motion.div>

      {/* 加载状态 */}
      {loading && (
        <div className="inbox-banner inbox-banner-loading">
          <div className="inbox-spinner" />
          <span>加载中...</span>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="inbox-banner inbox-banner-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* 自动加载中提示 */}
      {!loading && filter !== 'All' && filter !== 'Premium' && items.length === 0 && totalItems > 0 && (
        <div className="inbox-banner inbox-banner-loading">
          <div className="inbox-spinner" />
          <span>正在加载 {filter} 平台数据...</span>
        </div>
      )}

      </div>

      {/* 分页导航 */}
      {!loading && items.length > 0 && totalPages > 1 && (
        <div className="inbox-pagination">
          <span className="inbox-pagination-info">
            共 {totalItems} 条，第 {currentPage + 1}/{totalPages} 页
          </span>
          <div className="inbox-pagination-nav">
            <button
              className="page-btn"
              onClick={() => fetchPage(0, filter)}
              disabled={currentPage === 0}
              title="第一页"
            >
              «
            </button>
            <button
              className="page-btn"
              onClick={() => fetchPage(currentPage - 1, filter)}
              disabled={currentPage === 0}
              title="上一页"
            >
              ‹
            </button>
            {getPageNumbers().map(pNum => (
              <button
                key={pNum}
                className={`page-btn ${pNum === currentPage ? 'page-btn-active' : ''}`}
                onClick={() => fetchPage(pNum, filter)}
              >
                {pNum + 1}
              </button>
            ))}
            <button
              className="page-btn"
              onClick={() => fetchPage(currentPage + 1, filter)}
              disabled={currentPage >= totalPages - 1}
              title="下一页"
            >
              ›
            </button>
            <button
              className="page-btn"
              onClick={() => fetchPage(totalPages - 1, filter)}
              disabled={currentPage >= totalPages - 1}
              title="最后一页"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!loading && items.length === 0 && totalItems === 0 && (
        <div className="inbox-banner inbox-banner-empty">
          <p>{filter === 'All' ? '📭 暂无捕获的信息项' : filter === 'Premium' ? '📭 暂无优质信息源' : `📭 暂无 ${filter} 平台数据`}</p>
          <p className="inbox-banner-empty-hint">
            {filter === 'All' ? '连接平台授权后，爬虫会自动抓取内容到这里' : filter === 'Premium' ? '将信息源升级为优质信息源后会出现在这里' : '请确认该平台已连接授权，或稍等爬虫完成抓取'}
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
