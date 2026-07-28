import { useState, useEffect, useCallback, useRef } from 'react';
import { inboxApi } from '../utils/api';
import { getCachedData } from '../utils/cache';

const STORAGE_KEY = 'infodigest_inbox_cache_v2';

/**
 * 格式化后端的 InformationItem 为前端需要的格式
 */
function formatItem(item) {
  return {
    id: item.id,
    title: item.title,
    platform: formatPlatform(item.platform),
    author: item.author || '未知作者',
    duration: formatWatchDuration(item.watchDurationSeconds),
    watchDurationSeconds: item.watchDurationSeconds,
    date: formatTimeAgo(item.crawledAt),
    isFavorite: item.isFavorite === true,
    isLiked: item.isLiked === true,
    hasNote: item.isPremium === true,
    opened: true,
    note: item.userNote || '',
    keywords: [],
    processStatus: item.processStatus,
    isPremium: item.isPremium === true,
    url: item.url,
    contentRaw: item.contentRaw,
    aiSummary: item.aiSummary || null,
    knowledgeScore: item.knowledgeScore || null,
    // 营养评分字段
    nutritionProtein: item.nutritionProtein,
    nutritionCarbs: item.nutritionCarbs,
    nutritionVitamins: item.nutritionVitamins,
    nutritionFats: item.nutritionFats,
    nutritionFiber: item.nutritionFiber,
    nutritionReasoning: item.nutritionReasoning,
  };
}

function formatWatchDuration(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '未记录';
  const totalSeconds = Math.max(0, Math.floor(Number(value)));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分钟`;
}

function formatPlatform(platform) {
  const map = {
    'BILIBILI': 'Bilibili',
    'ZHIHU': 'Zhihu',
    'GITHUB': 'GitHub',
    'XIAOHONGSHU': 'Xiaohongshu',
  };
  return map[platform] || platform || '未知';
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs < 1) return '刚刚';
  if (diffHrs < 24) return diffHrs + '小时前';
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return diffDays + '天前';
  if (diffDays < 30) return Math.floor(diffDays / 7) + '周前';
  return date.toLocaleDateString('zh-CN');
}

/** 将前端 filter 值映射为后端 API 参数 */
function filterToApiParams(filter) {
  if (filter === 'All') return {};
  if (filter === 'Premium') return { premium: true };
  // 平台名 → 后端大写枚举
  const platformMap = {
    'Bilibili': 'BILIBILI',
    'Zhihu': 'ZHIHU',
    'Xiaohongshu': 'XIAOHONGSHU',
    'GitHub': 'GITHUB',
  };
  const mapped = platformMap[filter];
  if (mapped) return { platform: mapped };
  return {};
}

export function useInboxItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 100;

  // 当前 filter（由 Inbox.jsx 传入，避免闭包陈旧）
  const currentFilterRef = useRef('All');

  // 检测是否需要自动刷新（从 Settings 页面跳转过来）
  useEffect(() => {
    const shouldRefetch = sessionStorage.getItem('inbox:shouldRefetch');
    const timestamp = sessionStorage.getItem('inbox:refetchTimestamp');
    
    if (shouldRefetch && timestamp) {
      const timeDiff = Date.now() - parseInt(timestamp, 10);
      if (timeDiff < 30000) {
        sessionStorage.removeItem('inbox:shouldRefetch');
        sessionStorage.removeItem('inbox:refetchTimestamp');
        
        setRefetching(true);
        setInitialized(false);
        setItems([]);
        
        // 轮询抓取结果：每 5 秒查一次，最多 12 次（60 秒）
        let pollCount = 0;
        const maxPolls = 12;
        const pollTimer = setInterval(async () => {
          pollCount++;
          try {
            const params = filterToApiParams(currentFilterRef.current);
            const data = await inboxApi.getItems(0, pageSize, params);
            if (data.items && data.items.length > 0) {
              clearInterval(pollTimer);
              setRefetching(false);
              const formatted = (data.items || []).map(formatItem);
              setItems(formatted);
              setTotalItems(data.totalItems ?? 0);
              setTotalPages(data.totalPages ?? 0);
              setCurrentPage(data.currentPage ?? 0);
              setInitialized(true);
            } else if (pollCount >= maxPolls) {
              clearInterval(pollTimer);
              setRefetching(false);
              setInitialized(true);
            }
          } catch {
            if (pollCount >= maxPolls) {
              clearInterval(pollTimer);
              setRefetching(false);
              setInitialized(true);
            }
          }
        }, 5000);
        
        return () => clearInterval(pollTimer);
      }
    }
  }, []);

  // 加载指定页
  const fetchPage = useCallback(async (pageNum, filter) => {
    setLoading(true);
    setError(null);
    currentFilterRef.current = filter || 'All';

    // 先从缓存读取（离线兜底）
    let cacheData = null;
    try {
      cacheData = getCachedData('inbox');
    } catch { /* ignore */ }

    try {
      const params = filterToApiParams(currentFilterRef.current);
      const data = await inboxApi.getItems(pageNum, pageSize, params);
      const formatted = (data.items || []).map(formatItem);

      // 与缓存合并 note/keywords
      let merged = formatted;
      if (cacheData && Array.isArray(cacheData)) {
        const cacheMap = new Map(cacheData.map(c => [c.id, c]));
        merged = formatted.map(item => {
          const cached = cacheMap.get(item.id);
          if (!cached) return item;
          return {
            ...item,
            note: cached.note !== undefined ? cached.note : item.note,
            keywords: cached.keywords !== undefined ? cached.keywords : item.keywords,
          };
        });
      }

      setItems(merged);
      setTotalItems(data.totalItems ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setCurrentPage(data.currentPage ?? pageNum);

      // 缓存当前页（仅缓存 note/keywords 字段供后续合并）
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('API 请求失败:', err.message);
      if (cacheData && Array.isArray(cacheData)) {
        setItems(cacheData);
      }
      setError('API 连接失败，使用本地数据');
    } finally {
      setLoading(false);
      setInitialized(true);
      setRefetching(false);
    }
  }, []);

  // 首次加载
  useEffect(() => {
    if (!initialized || refetching) {
      fetchPage(0, 'All');
    }
  }, [fetchPage, initialized, refetching]);

  // 每 30 秒静默拉取第 0 页（仅当当前在第 0 页且 filter 为 All）
  useEffect(() => {
    if (!initialized) return;
    const timer = setInterval(async () => {
      try {
        const data = await inboxApi.getItems(0, pageSize, { silent: true });
        if (data.items && data.items.length > 0 && currentPage === 0) {
          const formatted = (data.items || []).map(formatItem);
          setItems(formatted);
          setTotalItems(data.totalItems ?? 0);
          setTotalPages(data.totalPages ?? 0);
        }
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(timer);
  }, [initialized, pageSize, currentPage]);

  // 创建信息项（调 real API）
  const createItem = useCallback(async (item) => {
    try {
      const backendItem = {
        title: item.title,
        url: item.url || '',
        platform: item.platform === 'Bilibili' ? 'BILIBILI' : item.platform?.toUpperCase() || 'BILIBILI',
        durationMinutes: parseInt(item.duration) || 1,
        contentRaw: item.contentRaw || '',
      };
      const saved = await inboxApi.createItem(backendItem);
      const formatted = formatItem(saved);
      setItems((prev) => [formatted, ...prev]);
      return formatted;
    } catch (err) {
      console.error('创建信息项失败:', err);
      throw err;
    }
  }, []);

  // togglePremium（标记/取消优质信息源，同步到后端）
  const togglePremium = useCallback(async (id) => {
    setItems((prev) => {
      const current = prev.find(i => i.id === id);
      const newIsPremium = current && current.hasNote ? false : true;

      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, hasNote: newIsPremium, isPremium: newIsPremium }
          : item
      );

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}

      inboxApi.updateItem(id, { isPremium: newIsPremium }).catch((err) => {
        console.error('更新优质信息源状态失败:', err);
        const rolledBack = updated.map((item) =>
          item.id === id
            ? { ...item, hasNote: !newIsPremium, isPremium: !newIsPremium }
            : item
        );
        setItems(rolledBack);
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rolledBack));
        } catch {}
      });

      return updated;
    });
  }, []);

  const saveNote = useCallback(async (id, note, keywords) => {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, hasNote: true, isPremium: true, note, keywords }
          : item
      );
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    try {
      await inboxApi.updateItem(id, {
        userNote: note,
        isPremium: true,
      });
    } catch (err) {
      console.error('保存笔记失败:', err);
    }
  }, []);

  // 更新信息项（调 real API）
  const updateItem = useCallback(async (id, patch) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
    try {
      const backendPatch = {};
      if (patch.note !== undefined) backendPatch.userNote = patch.note;
      if (patch.opened !== undefined) backendPatch.processStatus = 'PROCESSED';
      if (patch.isPremium !== undefined) backendPatch.isPremium = patch.isPremium;
      if (patch.userNote !== undefined) backendPatch.userNote = patch.userNote;
      if (patch.processStatus !== undefined) backendPatch.processStatus = patch.processStatus;
      if (patch.contentRaw !== undefined) backendPatch.contentRaw = patch.contentRaw;
      
      if (Object.keys(backendPatch).length > 0) {
        await inboxApi.updateItem(id, backendPatch);
      }
    } catch (err) {
      console.error('更新信息项失败:', err);
    }
  }, []);

  // 重新生成单条卡片的 AI 摘要
  const regenerateSummary = useCallback(async (id) => {
    try {
      await inboxApi.regenerateSummary(id);
      setItems((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, aiSummary: null, processStatus: 'UNPROCESSED' } : item
        );
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err) {
      console.error('重新生成摘要失败:', err);
      throw err;
    }
  }, []);

  return {
    items,
    setItems,
    loading,
    error,
    totalItems,
    totalPages,
    currentPage,
    fetchPage,
    createItem,
    togglePremium,
    regenerateSummary,
    saveNote,
    updateItem,
    refetching,
  };
}
