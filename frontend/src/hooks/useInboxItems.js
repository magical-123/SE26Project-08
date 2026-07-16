import { useState, useEffect, useCallback } from 'react';
import { inboxApi } from '../utils/api';
import { inboxItems as fallbackItems } from '../mock/inboxData';

const STORAGE_KEY = 'infodigest_inbox_cache';

/**
 * 格式化后端的 InformationItem 为前端需要的格式
 */
function formatItem(item) {
  // 后端字段名到前端字段名的映射
  const categoryColors = {
    '深度知识': '#10B981',
    '娱乐短剧': '#F43F5E',
    '行业资讯': '#F59E0B',
    '创意灵感': '#3B82F6',
    '实用技巧': '#0EA5E9',
    '效率与认知': '#EC4899',
    '娱乐科普': '#F43F5E',
  };

  return {
    id: item.id,
    title: item.title,
    platform: formatPlatform(item.platform),
    author: item.platform || '未知来源',
    duration: (item.durationMinutes || 1) + ' 分钟',
    category: item.category || '深度知识',
    color: categoryColors[item.category] || '#10B981',
    date: formatTimeAgo(item.crawledAt),
    isFavorite: false,
    isLiked: false,
    hasNote: item.processStatus === 'PROCESSED',
    opened: true,
    note: '',
    tags: [],
    processStatus: item.processStatus,
    url: item.url,
    contentRaw: item.contentRaw,
  };
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

export function useInboxItems() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const pageSize = 30;

  // 检测是否需要自动刷新（从 Settings 页面跳转过来）
  useEffect(() => {
    const shouldRefetch = sessionStorage.getItem('inbox:shouldRefetch');
    const timestamp = sessionStorage.getItem('inbox:refetchTimestamp');
    
    if (shouldRefetch && timestamp) {
      const timeDiff = Date.now() - parseInt(timestamp, 10);
      // 30 秒内的标记才触发自动刷新
      if (timeDiff < 30000) {
        // 清除标记
        sessionStorage.removeItem('inbox:shouldRefetch');
        sessionStorage.removeItem('inbox:refetchTimestamp');
        
        // 显示「正在抓取」提示
        setRefetching(true);
        setInitialized(false);
        setPage(0);
        setItems([]);
        
        // 轮询抓取结果：每 5 秒查一次，最多 12 次（60 秒）
        let pollCount = 0;
        const maxPolls = 12;
        const pollTimer = setInterval(async () => {
          pollCount++;
          try {
            const data = await inboxApi.getItems(0, pageSize);
            if (data.items && data.items.length > 0) {
              // 有新数据 → 停止轮询
              clearInterval(pollTimer);
              setRefetching(false);
              const formatted = (data.items || []).map(formatItem);
              setItems(formatted);
              setHasMore(data.hasMore ?? false);
              setInitialized(true);
              // 缓存到 localStorage
              try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
              } catch {}
            } else if (pollCount >= maxPolls) {
              // 超时 → 停止轮询
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
        
        // 清理函数
        return () => clearInterval(pollTimer);
      }
    }
  }, []);

  // 首次加载 / 自动刷新：先读缓存，再请求 API
  const loadInitial = useCallback(async () => {
    if (initialized && !refetching) return;
    setLoading(true);
    setError(null);

    // 1. 先从 localStorage 缓存读取（秒现）
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          setItems(cached);
        }
      }
    } catch { /* ignore */ }

    // 2. 请求后端 API
    try {
      const data = await inboxApi.getItems(0, pageSize);
      const formatted = (data.items || []).map(formatItem);
      setItems(formatted);
      setHasMore(data.hasMore ?? false);
      setPage(0);
      // 缓存到 localStorage
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('API 请求失败，使用缓存/Mock 数据:', err.message);
      // API 失败 → 如果缓存也没数据，用 Mock 兜底
      setItems((prev) => prev.length > 0 ? prev : fallbackItems.map(formatItem));
      setError('API 连接失败，使用本地数据');
    } finally {
      setLoading(false);
      setInitialized(true);
      setRefetching(false);
    }
  }, [initialized, refetching]);

  // 自动加载
  useEffect(() => {
    if (refetching || !initialized) {
      loadInitial();
    }
  }, [loadInitial, refetching, initialized]);

  // 实时更新：每 5 分钟静默拉取最新 30 条数据，替换当前列表
  useEffect(() => {
    if (!initialized) return;
    const timer = setInterval(async () => {
      try {
        const data = await inboxApi.getItems(0, pageSize);
        if (data.items && data.items.length > 0) {
          const formatted = (data.items || []).map(formatItem);
          // 直接替换为最新 30 条数据
          setItems(formatted);
          setHasMore(data.hasMore ?? false);
          // 更新缓存
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
          } catch {}
        }
      } catch { /* silent */ }
    }, 300000);
    return () => clearInterval(timer);
  }, [initialized, pageSize]);

  // 加载更多（无限滚动）
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const nextPage = page + 1;
    try {
      const data = await inboxApi.getItems(nextPage, pageSize);
      const formatted = (data.items || []).map(formatItem);
      setItems((prev) => [...prev, ...formatted]);
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
      // 更新缓存
      try {
        const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...formatted]));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('加载更多失败:', err.message);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  // 创建信息项（调 real API）
  const createItem = useCallback(async (item) => {
    try {
      const backendItem = {
        title: item.title,
        url: item.url || '',
        platform: item.platform === 'Bilibili' ? 'BILIBILI' : item.platform?.toUpperCase() || 'BILIBILI',
        category: item.category || '深度知识',
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
    // 先读取当前状态，决定要设置为什么
    setItems((prev) => {
      const current = prev.find(i => i.id === id);
      const newStatus = current && current.hasNote ? 'UNPROCESSED' : 'PROCESSED';
      const newHasNote = current && current.hasNote ? false : true;

      // 乐观更新本地
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, hasNote: newHasNote, processStatus: newStatus }
          : item
      );

      // 同步到后端
      inboxApi.updateItem(id, { processStatus: newStatus }).catch((err) => {
        console.error('更新优质信息源状态失败:', err);
        // 失败则回滚本地状态
        setItems((old) =>
          old.map((item) =>
            item.id === id
              ? { ...item, hasNote: !newHasNote, processStatus: newStatus === 'PROCESSED' ? 'UNPROCESSED' : 'PROCESSED' }
              : item
          )
        );
      });

      return updated;
    });
  }, []);

  // 保存笔记（调 real API）
  const saveNote = useCallback(async (id, note, tags) => {
    // 本地先更新
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, hasNote: true, note, tags }
          : item
      )
    );
    // 尝试更新后端
    try {
      await inboxApi.updateItem(id, {
        contentRaw: note,
        processStatus: 'PROCESSED',
      });
    } catch (err) {
      console.error('保存笔记失败:', err);
    }
  }, []);

  // 更新信息项（调 real API）
  const updateItem = useCallback(async (id, patch) => {
    // 本地先更新
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
    // 尝试更新后端
    try {
      const backendPatch = {};
      if (patch.opened !== undefined) backendPatch.processStatus = 'PROCESSED';
      if (patch.note !== undefined) backendPatch.contentRaw = patch.note;
      await inboxApi.updateItem(id, backendPatch);
    } catch (err) {
      console.error('更新信息项失败:', err);
    }
  }, []);

  return {
    items,
    setItems,
    loading,
    error,
    hasMore,
    loadMore,
    createItem,
    togglePremium,
    saveNote,
    updateItem,
    refetching,
  };
}
