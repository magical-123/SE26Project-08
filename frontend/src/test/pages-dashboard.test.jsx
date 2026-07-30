import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard/Dashboard';

// ─── Module-level mocks ───────────────────────────────────────────────────────

// Use vi.hoisted so these variables are available in vi.mock factories below
const mockNavigate = vi.fn();

const { mockGetCachedData: _mockGetCachedData, mockCacheData: _mockCacheData } = vi.hoisted(() => ({
  mockGetCachedData: vi.fn(() => null),
  mockCacheData: vi.fn(),
}));

const { mockFetchData: _mockFetchData } = vi.hoisted(() => ({
  mockFetchData: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="mock-echarts" />,
}));

vi.mock('echarts-wordcloud', () => ({}));

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => {
    // Filter out framer-motion specific props to avoid React warnings
    const { whileHover, initial, animate, exit, transition, ...rest } = props;
    return <div {...rest}>{children}</div>;
  };
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, _prop) => MotionDiv,
      },
    ),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => ({
  BookOpen: () => <span data-testid="icon-bookopen" />,
  Zap: () => <span data-testid="icon-zap" />,
  Clock: () => <span data-testid="icon-clock" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

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

vi.mock('../utils/cache', () => ({
  cacheData: _mockCacheData,
  getCachedData: _mockGetCachedData,
}));

vi.mock('../utils/api', () => ({
  fetchData: _mockFetchData,
}));

// ─── Test data ────────────────────────────────────────────────────────────────

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
    summary: '你最近对「大模型架构」的关注度显著上升',
    fullText: '...',
    sourcePlatform: 'B站 · 深度技术解析',
    tags: ['大模型', 'Transformer'],
  },
];

const mockReviewsData = [
  { title: '什么是 LoRA?', content: '一种微调大模型的高效技术', source: '知乎 · AI 算法工程师' },
  { title: '设计心理学：锚定效应', content: '人们在做决策时过度依赖最初获得的信息', source: 'B站 · 交互设计' },
];

const mockSummaryData = { todayViews: 128, premiumCount: 42, immersionHours: 3.5 };

const mockQuotesData = [
  { id: 1, content: '测试金句', sourcePlatform: '知乎', sourceTitle: '测试来源' },
];

const mockWordCloudHistory = [
  {
    date: 'today',
    keywords: [
      { word: 'React', value: 100 },
      { word: '大模型架构', value: 80 },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockFetchSuccess() {
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

function mockFetchError() {
  global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
}

function mockFetchEmptyData() {
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/dashboard/nutrition')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }
    if (url.includes('/api/dashboard/insights')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('/api/dashboard/reviews/today')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('/api/dashboard/summary')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ todayViews: 0, premiumCount: 0, immersionHours: 0 }),
      });
    }
    if (url.includes('/api/quotes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('/api/dashboard/wordcloud/history')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: false });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');

    // Default: timedFetch resolves with word cloud data
    _mockFetchData.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWordCloudHistory),
    });
  });

  // ── Rendering basics ──────────────────────────────────────────────────────

  test('renders dashboard title', async () => {
    mockFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('仪表盘 (Dashboard)')).toBeInTheDocument();
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  test('shows loading state initially', () => {
    // Keep fetch pending to prevent useEffect from resolving
    global.fetch = vi.fn(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // ── Metrics / Stats ──────────────────────────────────────────────────────

  test('shows metrics and stats from API after data loads', async () => {
    mockFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-badge-浏览总量')).toBeInTheDocument();
    });

    expect(screen.getByTestId('stat-badge-浏览总量')).toHaveTextContent('128');
    expect(screen.getByTestId('stat-badge-优质信息源')).toHaveTextContent('42');
    expect(screen.getByTestId('stat-badge-今日浏览时长')).toHaveTextContent('3.5h');
  });

  // ── Error state ───────────────────────────────────────────────────────────

  test('shows dashboard without loading when API fails', async () => {
    mockFetchError();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // After the failed API call, loading should be false and dashboard should still render
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('仪表盘 (Dashboard)')).toBeInTheDocument();
    // Stats should show initial zeros since API failed
    expect(screen.getByTestId('stat-badge-浏览总量')).toHaveTextContent('0');
  });

  // ── Nutrition label ──────────────────────────────────────────────────────

  test('shows nutrition label with data', async () => {
    mockFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('nutrition-label')).toBeInTheDocument();
    });

    expect(screen.getByTestId('nutrition-label')).toHaveTextContent('Nutrition items: 4');
  });

  // ── AI quote card (RotatingQuoteCard) ────────────────────────────────────

  test('shows AI quote card with quotes from API', async () => {
    mockFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('rotating-quote-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('rotating-quote-card')).toHaveTextContent('Quotes count: 1');
  });

  // ── Today's reviews ──────────────────────────────────────────────────────

  test('shows today review card with title and source', async () => {
    mockFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('什么是 LoRA?')).toBeInTheDocument();
    });

    expect(screen.getByText('知乎 · AI 算法工程师')).toBeInTheDocument();
  });

  // ── Cached data fallback ──────────────────────────────────────────────────

  test('uses cached data for instant display when API fails', async () => {
    const cacheData = {
      nutrition: mockNutritionApiData.data,
      wordCloud: [],
      insights: mockInsightsData,
      quotes: mockQuotesData,
      reviews: mockReviewsData,
      summary: mockSummaryData,
    };

    _mockGetCachedData.mockReturnValue(cacheData);
    mockFetchError();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // Dashboard should render without loading spinner since cache provides data
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('stat-badge-浏览总量')).toHaveTextContent('128');
    expect(screen.getByTestId('stat-badge-优质信息源')).toHaveTextContent('42');
    expect(screen.getByTestId('stat-badge-今日浏览时长')).toHaveTextContent('3.5h');
    expect(screen.getByTestId('nutrition-label')).toHaveTextContent('Nutrition items: 4');
    expect(screen.getByTestId('rotating-quote-card')).toHaveTextContent('Quotes count: 1');
    expect(screen.getByText('什么是 LoRA?')).toBeInTheDocument();
  });

  // ── Empty data ────────────────────────────────────────────────────────────

  test('handles empty data gracefully', async () => {
    mockFetchEmptyData();

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('仪表盘 (Dashboard)')).toBeInTheDocument();

    expect(screen.getByTestId('stat-badge-浏览总量')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-badge-优质信息源')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-badge-今日浏览时长')).toHaveTextContent('0h');

    expect(screen.getByTestId('nutrition-label')).toHaveTextContent('Nutrition items: 0');
    expect(screen.getByTestId('rotating-quote-card')).toHaveTextContent('Quotes count: 0');

    // No review card should render when reviews are empty
    expect(screen.queryByText('什么是 LoRA?')).not.toBeInTheDocument();
  });
});
