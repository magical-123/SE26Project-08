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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInboxItems - coverage extras', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await getMocks();
  });

  // ── 1. formatWatchDuration with NaN ───────────────────────────────────────

  it('1. 当 watchDurationSeconds 为 NaN 时 formatWatchDuration 返回 "未记录"', async () => {
    const itemWithNaN = { ...mockRawItem, watchDurationSeconds: NaN };
    const resp = { ...mockApiResponse, items: [itemWithNaN] };
    inboxApi.getItems.mockResolvedValue(resp);
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // NaN 经过 formatWatchDuration 应返回 '未记录'
    expect(result.current.items[0].duration).toBe('未记录');
  });

  // ── 2. fetchPage error fallback to cache ─────────────────────────────────

  it('2. fetchPage API 失败但有缓存时 items 使用缓存数据', async () => {
    const cachedItem = { id: 1, title: 'Cached Title', note: 'cached note', keywords: ['kw'] };
    inboxApi.getItems.mockRejectedValue(new Error('Offline'));
    getCachedData.mockReturnValue([cachedItem]);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.error).toBe('API 连接失败，使用本地数据');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('Cached Title');
    expect(result.current.items[0].note).toBe('cached note');
    expect(setGlobalOffline).toHaveBeenCalledWith(true);
  });

  // ── 3. fetchPage error without cache ─────────────────────────────────────

  it('3. fetchPage API 失败且无缓存时 error 被设置，items 为空数组', async () => {
    inboxApi.getItems.mockRejectedValue(new Error('Network error'));
    getCachedData.mockReturnValue(null);

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => {
      expect(result.current.error).toBe('API 连接失败，使用本地数据');
    });

    expect(result.current.items).toEqual([]);
    expect(setGlobalOffline).toHaveBeenCalledWith(true);
  });

  // ── 4. togglePremium API error rollback ──────────────────────────────────

  it('4. togglePremium API 失败时 hasNote 回滚到原始值 false', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 初始状态 hasNote / isPremium 均为 false
    expect(result.current.items[0].hasNote).toBe(false);
    expect(result.current.items[0].isPremium).toBe(false);

    // togglePremium 先乐观更新为 true，再因 API 失败回滚到 false
    await act(async () => {
      result.current.togglePremium(1);
    });

    await waitFor(() => {
      expect(result.current.items[0].hasNote).toBe(false);
      expect(result.current.items[0].isPremium).toBe(false);
    });
  });

  // ── 5. regenerateSummary error ──────────────────────────────────────────

  it('5. regenerateSummary API 失败时抛出错误', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.regenerateSummary.mockRejectedValue(new Error('Regenerate failed'));

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.regenerateSummary(1)).rejects.toThrow('Regenerate failed');
    });
  });

  // ── 6. updateItem error ──────────────────────────────────────────────────

  it('6. updateItem API 失败时不崩溃，本地乐观更新仍生效', async () => {
    inboxApi.getItems.mockResolvedValue(mockApiResponse);
    getCachedData.mockReturnValue(null);
    inboxApi.updateItem.mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useInboxItems());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // updateItem 先更新本地 state，再调 API（失败时仅 catch log，不抛错）
    await act(async () => {
      await result.current.updateItem(1, { note: 'Optimistic note' });
    });

    // 本地乐观更新应已生效
    expect(result.current.items[0].note).toBe('Optimistic note');
    // 整体未崩溃即测试通过
  });
});
