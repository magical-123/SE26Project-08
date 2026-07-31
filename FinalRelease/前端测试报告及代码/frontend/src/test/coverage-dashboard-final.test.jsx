import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard/Dashboard';

// ===========================================================================
// Hoisted mocks (must be before vi.mock calls)
// ===========================================================================

const mockNavigate = vi.fn();

const { _mockGetCachedData, _mockCacheData } = vi.hoisted(() => ({
  _mockGetCachedData: vi.fn(() => null),
  _mockCacheData: vi.fn(),
}));

const { _mockFetchData } = vi.hoisted(() => ({
  _mockFetchData: vi.fn(),
}));

// ===========================================================================
// Module-level mocks
// ===========================================================================

// --- react-router-dom ---
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

// --- echarts-for-react ---
vi.mock('echarts-for-react', () => ({
  default: ({ option }) => {
    const hasData = option?.series?.[0]?.data?.length > 0;
    return <div data-testid="mock-echarts" data-has-data={hasData ? 'true' : 'false'} />;
  },
}));

vi.mock('echarts-wordcloud', () => ({}));

// --- framer-motion ---
vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => {
    const { whileHover, initial, animate, exit, transition, ...rest } = props;
    return <div {...rest}>{children}</div>;
  };
  return {
    motion: new Proxy(
      {},
      {
        get: () => MotionDiv,
      },
    ),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

// --- lucide-react ---
vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-bookopen" />,
  Zap: () => <span data-testid="icon-zap" />,
  Clock: () => <span data-testid="icon-clock" />,
  Compass: () => <span data-testid="icon-compass" />,
  Search: () => <span data-testid="icon-search" />,
  PieChart: () => <span data-testid="icon-piechart" />,
  User: () => <span data-testid="icon-user" />,
  Settings: () => <span data-testid="icon-settings" />,
  UserCircle: () => <span data-testid="icon-usercircle" />,
  Menu: () => <span data-testid="icon-menu" />,
  X: () => <span data-testid="icon-x" />,
  WifiOff: () => <span data-testid="icon-wifioff" />,
  Heart: () => <span data-testid="icon-heart" />,
  Star: () => <span data-testid="icon-star" />,
  CheckCircle: () => <span data-testid="icon-checkcircle" />,
  AlertCircle: () => <span data-testid="icon-alertcircle" />,
  Check: () => <span data-testid="icon-check" />,
  Loader: () => <span data-testid="icon-loader" />,
  Camera: () => <span data-testid="icon-camera" />,
  Mail: () => <span data-testid="icon-mail" />,
  LogOut: () => <span data-testid="icon-logout" />,
  Quote: () => <span data-testid="icon-quote" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Download: () => <span data-testid="icon-download" />,
  ArrowRight: () => <span data-testid="icon-arrowright" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Info: () => <span data-testid="icon-info" />,
  Eye: () => <span data-testid="icon-eye" />,
  ChevronLeft: () => <span data-testid="icon-chevronleft" />,
  ChevronRight: () => <span data-testid="icon-chevronright" />,
  ExternalLink: () => <span data-testid="icon-externallink" />,
  Tag: () => <span data-testid="icon-tag" />,
  PlayCircle: () => <span data-testid="icon-playcircle" />,
  FileText: () => <span data-testid="icon-filetext" />,
  Mic: () => <span data-testid="icon-mic" />,
  ArrowUpRight: () => <span data-testid="icon-arrowupright" />,
}));

// --- Component mocks ---
vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className, ...props }) => {
    const { onClick, style, ...rest } = props;
    return (
      <div data-testid="glass-card" className={className} onClick={onClick} style={style} {...rest}>
        {children}
      </div>
    );
  },
}));

vi.mock('../components/NutritionLabel/NutritionLabel', () => ({
  NutritionLabel: ({ data }) => (
    <div data-testid="nutrition-label">Nutrition items: {data?.length ?? 0}</div>
  ),
}));

vi.mock('../components/StatBadge/StatBadge', () => ({
  StatBadge: ({ label, value, unit, icon, onClick }) => (
    <div data-testid={`stat-badge-${label}`} onClick={onClick}>
      {icon}
      {label}: {value}
      {unit || ''}
    </div>
  ),
}));

vi.mock('../components/RotatingQuoteCard/RotatingQuoteCard', () => ({
  RotatingQuoteCard: ({ quotes }) => (
    <div data-testid="rotating-quote-card">Quotes count: {quotes?.length ?? 0}</div>
  ),
}));

vi.mock('../components/ReviewModal/ReviewModal', () => ({
  ReviewModal: ({ cards, onClose }) => (
    <div data-testid="review-modal">ReviewModal cards: {cards?.length ?? 0}</div>
  ),
}));

// --- Utils mocks ---
vi.mock('../utils/cache', () => ({
  cacheData: _mockCacheData,
  getCachedData: _mockGetCachedData,
}));

vi.mock('../utils/api', () => ({
  fetchData: _mockFetchData,
}));

// ===========================================================================
// Test data
// ===========================================================================

const mockNutritionApiData = {
  data: [
    { name: '深度知识 (蛋白质)', value: 35, itemStyle: { color: '#10B981' } },
    { name: '娱乐短剧 (碳水)', value: 45, itemStyle: { color: '#F43F5E' } },
    { name: '行业资讯 (脂肪)', value: 15, itemStyle: { color: '#F59E0B' } },
    { name: '创意灵感 (维生素)', value: 5, itemStyle: { color: '#3B82F6' } },
  ],
};

const mockInsightsData = [
  {
    id: 1,
    summary: 'Test insight',
    fullText: '...',
    sourcePlatform: 'B站',
    tags: ['test'],
  },
];

const mockReviewsData = [
  { title: 'What is LoRA?', content: 'A fine-tuning technique', source: '知乎' },
];

const mockSummaryData = { todayViews: 128, premiumCount: 42, immersionHours: 3.5 };

const mockQuotesData = [
  { id: 1, content: 'Test quote', sourcePlatform: '知乎', sourceTitle: 'Source' },
];

// ===========================================================================
// Helpers
// ===========================================================================

function mockMainFetchSuccess() {
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/dashboard/nutrition')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockNutritionApiData) });
    }
    if (url.includes('/api/dashboard/insights')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockInsightsData) });
    }
    if (url.includes('/api/dashboard/reviews/today')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockReviewsData) });
    }
    if (url.includes('/api/dashboard/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummaryData) });
    }
    if (url.includes('/api/quotes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuotesData) });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
  });
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Dashboard Coverage - Final', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  // ── Test 1: Duplicate keywords aggregation ──────────────────────────────
  // 目标: 覆盖 line 74 — aggregatedWords[word] += kw.value (关键词跨天重复)
  test('aggregates duplicate keywords across multiple days', async () => {
    _mockFetchData.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            date: '2026-07-28',
            keywords: [
              { word: 'React', value: 100 },
              { word: 'Vue', value: 50 },
            ],
          },
          {
            date: '2026-07-29',
            keywords: [
              { word: 'React', value: 200 },
              { word: 'Angular', value: 30 },
            ],
          },
        ]),
    });
    mockMainFetchSuccess();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    // React 跨天出现，aggregatedWords["React"] = 100 + 200 = 300
    // 词云应有数据，echarts 渲染，无 "暂无词云数据"
    const chart = screen.queryByTestId('mock-echarts');
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute('data-has-data', 'true');
    expect(screen.queryByText('暂无词云数据')).not.toBeInTheDocument();
  });

  // ── Test 2: Empty word cloud after API success ─────────────────────────
  // 目标: 覆盖 line 92 — API 返回空数据后显示 "暂无词云数据"
  test('shows empty word cloud placeholder when API returns empty keywords', async () => {
    _mockFetchData.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { date: '2026-07-28', keywords: [] },
          { date: '2026-07-29', keywords: [] },
        ]),
    });
    mockMainFetchSuccess();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    // 聚合后 keyword 数组为空，应显示占位文本
    expect(screen.getByText('暂无词云数据')).toBeInTheDocument();
  });

  // ── Test 3: Word cloud API failure with cache fallback ─────────────────
  // 目标: 覆盖 lines 95-99 (API not ok → cache fallback)
  //       覆盖 lines 102-105 (catch error → cache fallback)
  test('falls back to cached word cloud data when API fails', async () => {
    // Mock cache to return data with wordCloud (used by both main fetch and word cloud fallback)
    _mockGetCachedData.mockReturnValue({
      nutrition: mockNutritionApiData.data,
      wordCloud: [{ name: 'Cached', value: 5 }],
      insights: mockInsightsData,
      quotes: mockQuotesData,
      reviews: mockReviewsData,
      summary: mockSummaryData,
    });

    // Make the word cloud API call reject (catch block)
    _mockFetchData.mockRejectedValue(new Error('Network error'));

    // Make the main data API calls fail too
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
    );

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // Cache provides instant data; no loading spinner
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    // Word cloud API failed; falls back to cached wordCloud data
    // echarts 应使用缓存数据渲染
    const chart = screen.queryByTestId('mock-echarts');
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute('data-has-data', 'true');
    // 检查缓存数据被使用（getCachedData 至少被调用来获取 word cloud 回退）
    expect(_mockGetCachedData).toHaveBeenCalledWith('dashboard');
    // 没有显示 "暂无词云数据"
    expect(screen.queryByText('暂无词云数据')).not.toBeInTheDocument();
  });

  // ── Test 4: Navigation on StatBadge click ──────────────────────────────
  // 目标: 覆盖 lines 161, 197-198 — StatBadge 点击导航
  test('navigates to /inbox when clicking 浏览总量 StatBadge', async () => {
    _mockFetchData.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { date: 'today', keywords: [{ word: 'Test', value: 10 }] },
        ]),
    });
    mockMainFetchSuccess();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    // 点击 "浏览总量" StatBadge，导航到 /inbox
    const badge = screen.getByTestId('stat-badge-浏览总量');
    fireEvent.click(badge);

    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
  });

  // ── Test 5: checkWordCloudUpdate sessionStorage logic ──────────────────
  // 目标: 覆盖 lines 114-119 — checkWordCloudUpdate 读取 sessionStorage
  test('checkWordCloudUpdate fires and clears sessionStorage on interval', async () => {
    vi.useFakeTimers();

    _mockFetchData.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { date: 'today', keywords: [{ word: 'Test', value: 10 }] },
        ]),
    });
    mockMainFetchSuccess();

    // 渲染前设置 sessionStorage
    sessionStorage.setItem('dashboard:wordcloudUpdated', '12345');

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // 初始 useEffect 执行:
    //   1. sessionStorage.removeItem('dashboard:wordcloudUpdated') 清除 '12345'
    //   2. fetchWordCloud() 第一次调用
    //   3. setInterval(checkWordCloudUpdate, 5000) 设置定时器

    // 等待第一次 fetchWordCloud 完成（flush microtasks）
    await act(async () => {
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    // 现在 fetchWordCloud 已经调用过一次
    expect(_mockFetchData).toHaveBeenCalledTimes(1);

    // 重新设置 sessionStorage，让 interval 检测到
    sessionStorage.setItem('dashboard:wordcloudUpdated', '67890');

    // 推进 5 秒触发 interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
      // 关键：flush microtasks 使得 checkWordCloudUpdate 内 async fetchWordCloud 执行完毕
      await Promise.resolve();
    });

    // checkWordCloudUpdate 应该已被调用:
    //   - 发现 'dashboard:wordcloudUpdated' = '67890'
    //   - 执行 sessionStorage.removeItem
    //   - 调用 fetchWordCloud()
    expect(_mockFetchData).toHaveBeenCalledTimes(2);

    // sessionStorage 应被清除
    expect(sessionStorage.getItem('dashboard:wordcloudUpdated')).toBeNull();

    vi.useRealTimers();
  });
});
