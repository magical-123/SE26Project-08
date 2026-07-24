import { useState, useEffect, useCallback } from 'react';
import { inboxApi } from '../utils/api';

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

export function useInboxItems() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const pageSize = 1000;

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

  // 合并 API 数据与本地缓存：API 数据为权威来源，缓存仅补充 API 不返回的字段（note/tags）
  const mergeWithCache = useCallback((apiItems) => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return apiItems;
      const cached = JSON.parse(raw);
      if (!Array.isArray(cached) || cached.length === 0) return apiItems;

      const cacheMap = new Map();
      cached.forEach(c => cacheMap.set(c.id, c));

      return apiItems.map(apiItem => {
        const cachedItem = cacheMap.get(apiItem.id);
        if (!cachedItem) return apiItem;
        // 只从缓存补充 note/tags，hasNote 以 API 返回为准
        const result = { ...apiItem };
        if (cachedItem.note !== undefined) {
          result.note = cachedItem.note;
        }
        if (cachedItem.keywords !== undefined) {
          result.keywords = cachedItem.keywords;
        }
        return result;
      });
    } catch {
      return apiItems;
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

    // 2. 请求后端 API，并与缓存合并（保留用户修改的 hasNote/note/tags）
    try {
      const data = await inboxApi.getItems(0, pageSize);
      const formatted = (data.items || []).map(formatItem);
      const merged = mergeWithCache(formatted);
      setItems(merged);
      setHasMore(data.hasMore ?? false);
      setPage(0);
      // 缓存到 localStorage（使用合并后的数据）
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch { /* ignore */ }
    } catch (err) {
      console.warn('API 请求失败，使用缓存/Mock 数据:', err.message);
      // API 失败 → 如果缓存也没数据，用 Mock 兜底
      setItems((prev) => prev);
      setError('API 连接失败，使用本地数据');
    } finally {
      setLoading(false);
      setInitialized(true);
      setRefetching(false);
    }
  }, [initialized, refetching, mergeWithCache]);

  // 自动加载
  useEffect(() => {
    if (refetching || !initialized) {
      loadInitial();
    }
  }, [loadInitial, refetching, initialized]);

  // 实时更新：每 30 秒静默拉取最新数据，替换当前列表
  useEffect(() => {
    if (!initialized) return;
    const timer = setInterval(async () => {
      try {
        const data = await inboxApi.getItems(0, pageSize, true); // silent=true 不触发 auth:expired
        if (data.items && data.items.length > 0) {
          const formatted = (data.items || []).map(formatItem);
          const merged = mergeWithCache(formatted);
          setItems(merged);
          setHasMore(data.hasMore ?? false);
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(timer);
  }, [initialized, pageSize, mergeWithCache]);

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

      // 乐观更新本地
      const updated = prev.map((item) =>
        item.id === id
          ? { ...item, hasNote: newIsPremium, isPremium: newIsPremium }
          : item
      );

      // 同步更新 localStorage 缓存，防止离开页面再回来时丢失状态
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}

      // 同步到后端
      inboxApi.updateItem(id, { isPremium: newIsPremium }).catch((err) => {
        console.error('更新优质信息源状态失败:', err);
        // 失败则回滚本地状态和缓存
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
    // 本地先更新
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
    // 尝试更新后端：笔记存到 userNote 字段，不要覆盖 contentRaw（原始文章内容）
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
    // 本地先更新
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
    // 尝试更新后端
    try {
      const backendPatch = {};
      // 映射前端的 note 到后端的 userNote
      if (patch.note !== undefined) backendPatch.userNote = patch.note;
      if (patch.opened !== undefined) backendPatch.processStatus = 'PROCESSED';
      // 直接映射与后端字段名一致的字段
      if (patch.isPremium !== undefined) backendPatch.isPremium = patch.isPremium;
      if (patch.userNote !== undefined) backendPatch.userNote = patch.userNote;
      if (patch.processStatus !== undefined) backendPatch.processStatus = patch.processStatus;
      if (patch.contentRaw !== undefined) backendPatch.contentRaw = patch.contentRaw;
      
      // 只有确实有需要发到后端的字段时才调 API
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
      // 本地先标记为分析中（去掉旧的空摘要/失败状态提示）
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
    hasMore,
    loadMore,
    createItem,
    togglePremium,
    regenerateSummary,
    saveNote,
    updateItem,
    refetching,
  };
}
