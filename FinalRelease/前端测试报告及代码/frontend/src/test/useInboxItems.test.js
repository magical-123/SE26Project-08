import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// ── Mocks (self-contained factories — vi.mock is hoisted above all imports) ──

vi.mock('../utils/api.js', () => ({
  inboxApi: {
    getItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    regenerateSummary: vi.fn(),
  },
}));

vi.mock('../utils/cache.js', () => ({
  getCachedData: vi.fn(),
  cacheData: vi.fn(),
}));

vi.mock('../utils/offlineStore.js', () => ({
  setGlobalOffline: vi.fn(),
}));

// Static import — uses mocked modules via vi.mock hoisting
import { useInboxItems } from '../hooks/useInboxItems';

// Reference to mocked functions (loaded once via dynamic import)
let inboxApi, getCachedData, cacheData, setGlobalOffline;

async function getMocks() {
  if (inboxApi) return;
  const apiMod = await import('../utils/api.js');
  inboxApi = apiMod.inboxApi;
  const cacheMod = await import('../utils/cache.js');
  getCachedData = cacheMod.getCachedData;
  cacheData = cacheMod.cacheData;
  const offlineMod = await import('../utils/offlineStore.js');
  setGlobalOffline = offlineMod.setGlobalOffline;
}

// ── Mock data ────────────────────────────────────────────────────────────────

const mockRawItem = {
  id: 1,
  title: 'Test Video',
  platform: 'BILIBILI',
  author: 'Creator',
  watchDurationSeconds: 120,
  crawledAt: '2026-07-30T10:00:00.000Z',
  isFavorite: false,
  isLiked: false,
  isPremium: false,
  processStatus: 'PROCESSED',
  userNote: '',
  knowledgeScore: 80,
  aiSummary: 'Great content',
};

const mockApiResponse = {
  items: [mockRawItem],
  totalItems: 1,
  totalPages: 1,
  currentPage: 0,
  premiumCount: 0,
  aiSummaryCount: 0,
};

const expectedFormatted = {
  id: 1,
  title: 'Test Video',
  platform: 'Bilibili',
  author: 'Creator',
  duration: '2 分钟',
  watchDurationSeconds: 120,
  isFavorite: false,
  isLiked: false,
  hasNote: false,
  opened: true,
  note: '',
  keywords: [],
  processStatus: 'PROCESSED',
  isPremium: false,
  url: undefined,
  contentRaw: undefined,
  aiSummary: 'Great content',
  knowledgeScore: 80,
  nutritionProtein: undefined,
  nutritionCarbs: undefined,
  nutritionVitamins: undefined,
  nutritionFats: undefined,
  nutritionFiber: undefined,
  nutritionReasoning: undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInboxItems', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await getMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Initial load ───────────────────────────────────────────────────────

  it('1. 初始加载时调用 inboxApi.getItems 并正确设置 items 和 loading', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, {});
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('Test Video');
    expect(result.current.items[0].platform).toBe('Bilibili');
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.currentPage).toBe(0);
    expect(result.current.premiumCount).toBe(0);
    expect(result.current.aiSummaryCount).toBe(0);
    expect(typeof result.current.items[0].date).toBe('string');
    expect(result.current.items[0].date.length).toBeGreaterThan(0);
  });

  // ── 2. Loading state ──────────────────────────────────────────────────────

  it('2. 在 API 请求期间 loading 应为 true，完成后恢复 false', async () => {
    let resolvePromise;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    inboxApi.getItems.mockReturnValue(fetchPromise);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePromise(mockApiResponse);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  // ── 3. Error state ────────────────────────────────────────────────────────

  it('3. API 失败时设置错误信息并调用 setGlobalOffline', async () => {
    inboxApi.getItems.mockRejectedValue(new Error('Network error'));
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.error).toBe('API 连接失败，使用本地数据');
    });

    expect(setGlobalOffline).toHaveBeenCalledWith(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  // ── 4. Cache fallback ─────────────────────────────────────────────────────

  it('4. API 失败但有缓存时展示缓存数据', async () => {
    const cachedItem = { ...expectedFormatted, note: 'Cached note' };
    inboxApi.getItems.mockRejectedValue(new Error('Offline'));
    getCachedData.mockReturnValue([cachedItem]);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.error).toBe('API 连接失败，使用本地数据');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(1);
    expect(result.current.items[0].note).toBe('Cached note');
    expect(setGlobalOffline).toHaveBeenCalledWith(true);
  });

  // ── 5. Pagination ─────────────────────────────────────────────────────────

  it('5. fetchPage 使用指定页码', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    // 等待首次加载完成
    await waitFor(() => expect(result.current.loading).toBe(false));

    const page2Response = { ...mockApiResponse, currentPage: 2 };
    inboxApi.getItems.mockResolvedValue(page2Response);

    await act(async () => {
      result.current.fetchPage(2, 'All');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(inboxApi.getItems).toHaveBeenCalledWith(2, 100, {});
    expect(result.current.currentPage).toBe(2);
  });

  // ── 6. Filter Premium ────────────────────────────────────────────────────

  it('6. fetchPage 使用 filter Premium 发送 premium:true 参数', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    inboxApi.getItems.mockClear();

    await act(async () => {
      result.current.fetchPage(0, 'Premium');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, { premium: true });
  });

  // ── 7. Filter Bilibili ─────────────────────────────────────────────────────

  it('7. fetchPage 使用 filter Bilibili 发送 platform 参数', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    inboxApi.getItems.mockClear();

    await act(async () => {
      result.current.fetchPage(0, 'Bilibili');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, { platform: 'BILIBILI' });
  });

  // ── 8. Create item ────────────────────────────────────────────────────────

  it('8. createItem 调用 inboxApi.createItem 并将结果前置到列表', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });

    const newRawItem = {
      id: 99,
      title: 'New Item',
      platform: 'ZHIHU',
      author: 'New Author',
      watchDurationSeconds: 300,
      crawledAt: new Date().toISOString(),
      isFavorite: false,
      isLiked: false,
      isPremium: true,
      processStatus: 'PROCESSED',
      userNote: 'My note',
      knowledgeScore: 90,
      aiSummary: 'New summary',
    };

    inboxApi.createItem.mockResolvedValue(newRawItem);

    let created;
    await act(async () => {
      created = await result.current.createItem({
        title: 'New Item',
        platform: 'Zhihu',
        duration: '5',
      });
    });

    expect(inboxApi.createItem).toHaveBeenCalledWith({
      title: 'New Item',
      url: '',
      platform: 'ZHIHU',
      durationMinutes: 5,
      contentRaw: '',
    });

    expect(created.title).toBe('New Item');
    expect(created.platform).toBe('Zhihu');

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe(99);
    expect(result.current.items[0].title).toBe('New Item');
    expect(result.current.items[1].id).toBe(1);
  });

  // ── 9. Toggle premium ─────────────────────────────────────────────────────

  it('9. togglePremium 调用 inboxApi.updateItem 切换 isPremium', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockResolvedValue({});

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items[0].hasNote).toBe(false);
    expect(result.current.items[0].isPremium).toBe(false);

    await act(async () => {
      result.current.togglePremium(1);
    });

    expect(result.current.items[0].hasNote).toBe(true);
    expect(result.current.items[0].isPremium).toBe(true);
    expect(inboxApi.updateItem).toHaveBeenCalledWith(1, { isPremium: true });

    await act(async () => {
      result.current.togglePremium(1);
    });

    expect(result.current.items[0].hasNote).toBe(false);
    expect(result.current.items[0].isPremium).toBe(false);
    expect(inboxApi.updateItem).toHaveBeenCalledWith(1, { isPremium: false });
  });

  // ── 10. Toggle premium rollback ──────────────────────────────────────────

  it('10. togglePremium API 失败时回滚本地状态', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items[0].hasNote).toBe(false);
    expect(result.current.items[0].isPremium).toBe(false);

    // 触发 toggle — 乐观更新立即生效，但 .catch 中的回滚会在同一微任务中执行
    // 因此无法观察到中间乐观状态，直接验证最终回滚结果
    await act(async () => {
      result.current.togglePremium(1);
    });

    // 等待 API 失败后回滚
    await waitFor(() => {
      expect(result.current.items[0].hasNote).toBe(false);
      expect(result.current.items[0].isPremium).toBe(false);
    });
  });

  // ── 11. Save note ─────────────────────────────────────────────────────────

  it('11. saveNote 更新 item 的 note 并调用 updateItem', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockResolvedValue({});

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items[0].note).toBe('');

    await act(async () => {
      await result.current.saveNote(1, 'My great note', ['kw1', 'kw2']);
    });

    expect(result.current.items[0].note).toBe('My great note');
    expect(result.current.items[0].keywords).toEqual(['kw1', 'kw2']);
    expect(result.current.items[0].hasNote).toBe(true);
    expect(result.current.items[0].isPremium).toBe(true);

    expect(inboxApi.updateItem).toHaveBeenCalledWith(1, {
      userNote: 'My great note',
      isPremium: true,
    });

    expect(cacheData).toHaveBeenCalledWith('inbox', expect.any(Array));
  });

  // ── 12. Regenerate summary ────────────────────────────────────────────────

  it('12. regenerateSummary 调用 API 并重置 aiSummary 和 processStatus', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.regenerateSummary.mockResolvedValue({});

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items[0].aiSummary).toBe('Great content');
    expect(result.current.items[0].processStatus).toBe('PROCESSED');

    await act(async () => {
      await result.current.regenerateSummary(1);
    });

    expect(inboxApi.regenerateSummary).toHaveBeenCalledWith(1);
    expect(result.current.items[0].aiSummary).toBeNull();
    expect(result.current.items[0].processStatus).toBe('UNPROCESSED');
    expect(cacheData).toHaveBeenCalledWith('inbox', expect.any(Array));
  });

  // ── 13. Refetching — sessionStorage shouldRefetch ─────────────────────────

  it('13. sessionStorage 设置 shouldRefetch 后每 5 秒轮询', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T10:00:00.500Z'));

    sessionStorage.setItem('inbox:shouldRefetch', 'true');
    sessionStorage.setItem('inbox:refetchTimestamp', String(Date.now() - 100));

    // 前 2 次返回空（模拟轮询中），之后返回有数据
    inboxApi.getItems
      .mockResolvedValueOnce({ items: [], totalItems: 0, totalPages: 0, currentPage: 0, premiumCount: 0, aiSummaryCount: 0 })
      .mockResolvedValueOnce({ items: [], totalItems: 0, totalPages: 0, currentPage: 0, premiumCount: 0, aiSummaryCount: 0 })
      .mockResolvedValue(mockApiResponse);

    const { result } = renderHook(() => useInboxItems());

    // 应进入 refetching 状态
    await vi.waitFor(() => {
      expect(result.current.refetching).toBe(true);
    });

    // 第 1 次 tick (5s) — 返回空 → 继续轮询
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // 第 2 次 tick (10s) — 返回 mockApiResponse → 轮询结束
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    await vi.waitFor(() => {
      expect(result.current.refetching).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('Test Video');

    // 确认轮询结束后不再继续
    const callsBefore = inboxApi.getItems.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(inboxApi.getItems.mock.calls.length).toBe(callsBefore);
  });

  // ── 14. Periodic refresh ──────────────────────────────────────────────────

  it('14. 初始化后每 30 秒静默拉取最新数据', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T10:00:00.500Z'));

    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    // 等待首次加载完成（fake timer 下需要用 vi.waitFor）
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(inboxApi.getItems).toHaveBeenCalledTimes(1);

    inboxApi.getItems.mockClear();
    inboxApi.getItems.mockResolvedValue(mockApiResponse);

    // 快进 30s → 应触发一次静默拉取
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, { silent: true });

    inboxApi.getItems.mockClear();
    inboxApi.getItems.mockResolvedValue(mockApiResponse);

    // 再快进 30s → 再次触发
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, { silent: true });
  });

  // ── 15. updateItem ────────────────────────────────────────────────────────

  it('15. updateItem 更新本地状态并同步到后端', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockResolvedValue({});

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateItem(1, { note: 'Updated note', opened: true });
    });

    expect(result.current.items[0].note).toBe('Updated note');
    expect(inboxApi.updateItem).toHaveBeenCalledWith(1, {
      userNote: 'Updated note',
      processStatus: 'PROCESSED',
    });
  });

  // ── 16. Edge: fetchPage with unknown filter ───────────────────────────────

  it('16. 未知 filter 值传递空对象作为参数', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    inboxApi.getItems.mockClear();

    await act(async () => {
      result.current.fetchPage(0, 'NonExistentFilter');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(inboxApi.getItems).toHaveBeenCalledWith(0, 100, {});
  });
});
