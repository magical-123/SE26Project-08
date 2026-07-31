import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Hoisted mocks
// ===========================================================================

const mockNavigate = vi.fn();

const { mockCacheData, mockGetCachedData } = vi.hoisted(() => ({
  mockCacheData: vi.fn(),
  mockGetCachedData: vi.fn(() => null),
}));

const { mockFetchData } = vi.hoisted(() => ({
  mockFetchData: vi.fn(),
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ===========================================================================
// Module-level mocks
// ===========================================================================

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('echarts-for-react', () => ({
  default: ({ option, style, ...props }) =>
    React.createElement('div', {
      'data-testid': 'echarts',
      style,
      ...props,
    }, 'ECharts'),
}));

vi.mock('echarts-wordcloud', () => ({}));

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => {
    const { whileHover, initial, animate, exit, transition, ...rest } = props;
    return React.createElement('div', rest, children);
  };
  return {
    motion: new Proxy({}, { get: (_t, _p) => MotionDiv }),
    AnimatePresence: ({ children }) => children,
  };
});

vi.mock('lucide-react', () => {
  const icons = [
    'BookOpen', 'Zap', 'Clock', 'RefreshCw',
    'User', 'Mail', 'LogOut', 'Loader2', 'CheckCircle', 'AlertCircle', 'Camera', 'UserCircle',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = (props) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}` }, name);
  });
  return mock;
});

vi.mock('../components/Toast/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }) => children,
}));

vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className, ...props }) => {
    const { onClick, style, ...rest } = props;
    return React.createElement('div', {
      'data-testid': 'glass-card',
      className: `glass-card ${className || ''}`,
      onClick,
      style,
      ...rest,
    }, children);
  },
}));

vi.mock('../components/NutritionLabel/NutritionLabel', () => ({
  NutritionLabel: ({ data }) =>
    React.createElement('div', { 'data-testid': 'nutrition-label' }, `Nutrition items: ${data?.length ?? 0}`),
}));

vi.mock('../components/StatBadge/StatBadge', () => ({
  StatBadge: ({ label, value, unit, icon, onClick }) =>
    React.createElement('div', {
      'data-testid': `stat-badge-${label}`,
      onClick,
    }, [icon, `${label}: ${value}${unit || ''}`]),
}));

vi.mock('../components/RotatingQuoteCard/RotatingQuoteCard', () => ({
  RotatingQuoteCard: ({ quotes }) =>
    React.createElement('div', { 'data-testid': 'rotating-quote-card' }, `Quotes count: ${quotes?.length ?? 0}`),
}));

vi.mock('../components/ReviewModal/ReviewModal', () => ({
  ReviewModal: ({ cards, onClose }) =>
    React.createElement('div', { 'data-testid': 'review-modal' },
      React.createElement('span', null, `ReviewModal cards: ${cards?.length ?? 0}`),
      React.createElement('button', { 'data-testid': 'review-modal-close', onClick: onClose }, 'Close'),
    ),
}));

vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheData(...args),
  getCachedData: (...args) => mockGetCachedData(...args),
}));

vi.mock('../utils/api', () => ({
  fetchData: (...args) => mockFetchData(...args),
}));

vi.mock('../pages/Dashboard/Dashboard.css', () => ({}));
vi.mock('../pages/Profile/ProfilePage.css', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Dashboard } from '../pages/Dashboard/Dashboard';
import { ProfilePage } from '../pages/Profile/ProfilePage';

// ===========================================================================
// Mock Data
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
      { word: 'TypeScript', value: 60 },
    ],
  },
];

const mockUserProfile = {
  username: 'Alice',
  email: 'alice@example.com',
  avatarUrl: null,
  selfPortrait: '',
  createdAt: '2024-01-15T00:00:00Z',
};

const mockUserProfileWithAvatar = {
  ...mockUserProfile,
  avatarUrl: 'https://example.com/avatar.png',
};

// ===========================================================================
// Dashboard API helpers
// ===========================================================================

function mockDashboardFetchSuccess() {
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
    if (url.includes('/api/dashboard/reviews/generate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
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

function mockDashboardFetchEmpty() {
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
    if (url.includes('/api/dashboard/reviews/generate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    if (url.includes('/api/dashboard/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ todayViews: 0, premiumCount: 0, immersionHours: 0 }) });
    }
    if (url.includes('/api/quotes')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: false });
  });
}

// ===========================================================================
// ProfilePage API helpers
// ===========================================================================

function mockProfileFetchOk(profile = mockUserProfile) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(profile),
  });
}

// ===========================================================================
// DASHBOARD TESTS — New scenarios not covered in pages-dashboard.test.jsx
// ===========================================================================

describe('Dashboard — Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');

    // Default: word cloud fetchData returns data
    mockFetchData.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWordCloudHistory),
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ── 1. Renders word cloud chart when realWordCloudData available ─────────

  it('renders word cloud chart (ECharts) when realWordCloudData is available', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });
  });

  // ── 2. Shows "暂无词云数据" when no word cloud data ──────────────────────

  it('shows "暂无词云数据" when no word cloud data is available', async () => {
    mockDashboardFetchEmpty();
    // fetchData returns empty data for wordcloud/history
    mockFetchData.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('暂无词云数据')).toBeInTheDocument();
    });

    // ECharts should NOT be rendered
    expect(screen.queryByTestId('echarts')).not.toBeInTheDocument();
  });

  // ── 3. Review card section shows first card title and source ─────────────

  it('renders review card section header "待复习卡片"', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('待复习卡片')).toBeInTheDocument();
    });
  });

  // ── 4. Opens ReviewModal when clicking review card ───────────────────────

  it('opens ReviewModal when clicking the review card', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('待复习卡片')).toBeInTheDocument();
    });

    // ReviewModal should not be visible initially
    expect(screen.queryByTestId('review-modal')).not.toBeInTheDocument();

    // Find the review GlassCard and click it
    const glassCards = screen.getAllByTestId('glass-card');
    const reviewCard = glassCards.find(card => card.textContent.includes('待复习卡片'));
    fireEvent.click(reviewCard);

    // ReviewModal should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('review-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('ReviewModal cards: 2')).toBeInTheDocument();
  });

  // ── 5. Regenerate review card button calls POST /api/dashboard/reviews/generate ─

  it('regenerate button calls POST /api/dashboard/reviews/generate', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('待复习卡片')).toBeInTheDocument();
    });

    // Click the regenerate (RefreshCw) button — it's the icon inside the button
    const regenerateBtn = screen.getByTestId('icon-RefreshCw').closest('button');
    expect(regenerateBtn).not.toBeNull();

    global.fetch.mockClear(); // Clear previous fetch calls
    fireEvent.click(regenerateBtn);

    await waitFor(() => {
      const calls = global.fetch.mock.calls;
      const postCall = calls.find(
        (c) => c[1]?.method === 'POST' && c[0]?.includes('/api/dashboard/reviews/generate'),
      );
      expect(postCall).toBeTruthy();
    });
  });

  // ── 6. refreshReviewCards fetches reviews after regenerate ───────────────

  it('fetches /api/dashboard/reviews/today again after regenerate succeeds', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('待复习卡片')).toBeInTheDocument();
    });

    const regenerateBtn = screen.getByTestId('icon-RefreshCw').closest('button');

    // refreshReviewCards uses timedFetch (mockFetchData), not global.fetch
    mockFetchData.mockClear();

    fireEvent.click(regenerateBtn);

    await waitFor(() => {
      // The regenerate POST goes through global.fetch (we verified this in test #5).
      // The subsequent refreshReviewCards calls timedFetch (mockFetchData) for GET /reviews/today
      const calls = mockFetchData.mock.calls;
      const reviewTodayCall = calls.find(
        (c) => c[0]?.includes('/api/dashboard/reviews/today'),
      );
      expect(reviewTodayCall).toBeTruthy();
    });
  });

  // ── 7. Word cloud polling checks sessionStorage for update signal ────────

  it('polling detects wordcloudUpdated in sessionStorage and re-fetches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockDashboardFetchSuccess();
    // Initial word cloud fetch resolves
    mockFetchData.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWordCloudHistory),
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // Wait for initial render with mock data
    await waitFor(() => {
      expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    // Clear previous fetchData calls
    mockFetchData.mockClear();

    // Set the update signal in sessionStorage
    sessionStorage.setItem('dashboard:wordcloudUpdated', Date.now().toString());

    // Advance timers by 5000ms to trigger the interval check
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // fetchData should be called again to refresh word cloud
    await waitFor(() => {
      expect(mockFetchData).toHaveBeenCalledWith(
        '/api/dashboard/wordcloud/history',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        }),
      );
    });

    // The signal should be removed from sessionStorage
    expect(sessionStorage.getItem('dashboard:wordcloudUpdated')).toBeNull();

    vi.useRealTimers();
  });

  // ── 8. Cache fallback when word cloud API response is not ok ────────────

  it('falls back to cached word cloud data when API response is not ok', async () => {
    mockDashboardFetchSuccess();

    // Word cloud API returns not ok
    mockFetchData.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    // Cache contains word cloud data
    const cachedWordCloud = [{ name: 'CachedTopic', value: 200 }];
    mockGetCachedData.mockReturnValue({
      nutrition: mockNutritionApiData.data,
      wordCloud: cachedWordCloud,
      insights: mockInsightsData,
      quotes: mockQuotesData,
      reviews: mockReviewsData,
      summary: mockSummaryData,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    // Should still render ECharts from cached word cloud data
    await waitFor(() => {
      expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });
  });

  // ── 9. Loading state shows "加载中..." ───────────────────────────────────

  it('shows "加载中..." when no cache and fetch is pending', () => {
    mockGetCachedData.mockReturnValue(null);
    // Keep fetch pending forever
    global.fetch = vi.fn(() => new Promise(() => {}));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // ── 10. StatBadge navigation clicks (inbox, graph, report) ──────────────

  it('navigates to /inbox when clicking 浏览总量 StatBadge', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-badge-浏览总量')).toBeInTheDocument();
    });

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('stat-badge-浏览总量'));
    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('navigates to /graph when clicking 优质信息源 StatBadge', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-badge-优质信息源')).toBeInTheDocument();
    });

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('stat-badge-优质信息源'));
    expect(mockNavigate).toHaveBeenCalledWith('/graph');
  });

  it('navigates to /report when clicking 今日浏览时长 StatBadge', async () => {
    mockDashboardFetchSuccess();
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-badge-今日浏览时长')).toBeInTheDocument();
    });

    mockNavigate.mockClear();
    fireEvent.click(screen.getByTestId('stat-badge-今日浏览时长'));
    expect(mockNavigate).toHaveBeenCalledWith('/report');
  });
});

// ===========================================================================
// PROFILEPAGE TESTS — New scenarios not covered in pages-extra.test.jsx
// ===========================================================================

describe('ProfilePage — Extended Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    global.fetch = vi.fn();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // ── 1. Shows avatar letter when no avatarUrl ─────────────────────────────

  it('shows avatar initial letter when user has no avatarUrl', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    // No img tag should be present
    expect(document.querySelector('.profile-avatar-img')).toBeNull();
  });

  // ── 2. Shows avatar image when avatarUrl is present ──────────────────────

  it('shows avatar image when user has avatarUrl', async () => {
    mockProfileFetchOk(mockUserProfileWithAvatar);
    render(<ProfilePage />);

    await waitFor(() => {
      const img = document.querySelector('.profile-avatar-img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
      expect(img).toHaveAttribute('alt', 'avatar');
    });

    // Initial letter should NOT be shown
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  // ── 3. Shows joined date ────────────────────────────────────────────────

  it('shows joined date when user has createdAt', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      // The joined date uses toLocaleDateString() which depends on locale
      expect(screen.getByText(/Joined/)).toBeInTheDocument();
    });
  });

  it('shows "Joined N/A" when user has no createdAt', async () => {
    mockProfileFetchOk({ ...mockUserProfile, createdAt: null });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Joined N/A')).toBeInTheDocument();
    });
  });

  // ── 4. Shows self-portrait textarea with character count ─────────────────

  it('shows self-portrait textarea and character count', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('用户自画像')).toBeInTheDocument();
    });

    const textarea = document.querySelector('.portrait-textarea');
    expect(textarea).toBeInTheDocument();

    // Character count should show 0 when selfPortrait is empty
    expect(screen.getByText('0 字')).toBeInTheDocument();
  });

  it('updates character count when typing in self-portrait', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('0 字')).toBeInTheDocument();
    });

    const textarea = document.querySelector('.portrait-textarea');
    fireEvent.change(textarea, { target: { value: '我是一个全栈开发者' } });

    expect(screen.getByText('9 字')).toBeInTheDocument();
  });

  // ── 5. Save self-portrait button calls API ───────────────────────────────

  it('"保存自画像" button calls PUT /api/user/profile with selfPortrait', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('保存自画像')).toBeInTheDocument();
    });

    // Type in the self-portrait textarea
    const textarea = document.querySelector('.portrait-textarea');
    fireEvent.change(textarea, { target: { value: '我是测试用户' } });

    // Mock the save response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockUserProfile, selfPortrait: '我是测试用户' }),
    });

    // Click save
    fireEvent.click(screen.getByText('保存自画像'));

    await waitFor(() => {
      const calls = global.fetch.mock.calls;
      const putCall = calls.find(
        (c) => c[1]?.method === 'PUT' && c[0]?.includes('/api/user/profile') &&
             c[1]?.body && c[1].body.includes('我是测试用户'),
      );
      expect(putCall).toBeTruthy();

      // Verify the body contains only selfPortrait
      const body = JSON.parse(putCall[1].body);
      expect(body.selfPortrait).toBe('我是测试用户');
    });
  });

  // ── 6. Save self-portrait shows loading state ────────────────────────────

  it('shows "保存中..." and spinner while saving self-portrait', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('保存自画像')).toBeInTheDocument();
    });

    // Mock a slow save
    let resolveSave;
    const savePromise = new Promise((resolve) => { resolveSave = resolve; });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => savePromise.then(() => Promise.resolve({ ...mockUserProfile })),
    });

    fireEvent.click(screen.getByText('保存自画像'));

    // Should show saving state
    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument();
    });

    // The button should be disabled
    const saveBtn = screen.getByText('保存中...').closest('button');
    expect(saveBtn).toBeDisabled();

    // Resolve the save
    await act(async () => {
      resolveSave();
    });

    // After save, button should return to normal
    await waitFor(() => {
      expect(screen.getByText('保存自画像')).toBeInTheDocument();
    });
  });

  // ── 7. Save self-portrait error shows toast ──────────────────────────────

  it('shows error toast when save self-portrait fails', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('保存自画像')).toBeInTheDocument();
    });

    // Mock save failure
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('数据库错误'),
    });

    fireEvent.click(screen.getByText('保存自画像'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('保存失败：数据库错误');
    });
  });

  // ── 8. Avatar click triggers file input ──────────────────────────────────

  it('clicking avatar area triggers hidden file input', async () => {
    mockProfileFetchOk(mockUserProfileWithAvatar);
    render(<ProfilePage />);

    await waitFor(() => {
      const img = document.querySelector('.profile-avatar-img');
      expect(img).toBeInTheDocument();
    });

    // Find the hidden file input
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', 'image/*');

    // Spy on the click method of the fileInput
    const clickSpy = vi.spyOn(fileInput, 'click');

    // Click the avatar wrap area
    const avatarWrap = document.querySelector('.profile-avatar-wrap');
    fireEvent.click(avatarWrap);

    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  // ── 9. File too large shows error (>2MB) ─────────────────────────────────

  it('shows error when selected file exceeds 2MB', async () => {
    mockProfileFetchOk(mockUserProfileWithAvatar);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');

    // Create a mock file > 2MB
    const largeFile = new File(
      ['x'.repeat(3 * 1024 * 1024)], // 3MB
      'large-avatar.png',
      { type: 'image/png' },
    );

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('Image size must be less than 2MB')).toBeInTheDocument();
    });
  });

  // ── 10. Non-image file shows error ───────────────────────────────────────

  it('shows error when selected file is not an image', async () => {
    mockProfileFetchOk(mockUserProfileWithAvatar);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    const fileInput = document.querySelector('input[type="file"]');

    // Create a mock non-image file
    const textFile = new File(
      ['hello world'],
      'document.txt',
      { type: 'text/plain' },
    );

    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await waitFor(() => {
      expect(screen.getByText('Please select an image file')).toBeInTheDocument();
    });
  });

  // ── 11. Success message display after save ───────────────────────────────

  it('displays success message after saving profile changes', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockUserProfile, username: 'AliceUpdated' }),
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });

    // Should show CheckCircle icon alongside success message
    expect(screen.getByTestId('icon-CheckCircle')).toBeInTheDocument();
  });

  // ── 12. Loading state initially ──────────────────────────────────────────

  it('shows loading spinner initially when no cached data', () => {
    mockGetCachedData.mockReturnValue(null);
    global.fetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ProfilePage />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
  });

  // ── 13. Session section with logout button ───────────────────────────────

  it('renders Session section with Log Out button', async () => {
    sessionStorage.setItem('token', 'test-token');
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Session')).toBeInTheDocument();
    });

    const logoutBtn = screen.getByText('Log Out');
    expect(logoutBtn).toBeInTheDocument();
    expect(screen.getByTestId('icon-LogOut')).toBeInTheDocument();
  });

  // ── 14. Account Information section ──────────────────────────────────────

  it('renders Account Information section with form fields', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Account Information')).toBeInTheDocument();
    });

    // Should have username and email fields
    expect(screen.getByPlaceholderText('Enter your username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();

    // Should have User and Mail icons
    expect(screen.getByTestId('icon-User')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Mail')).toBeInTheDocument();
  });

  // ── 15. Error message shows AlertCircle icon ─────────────────────────────

  it('displays AlertCircle icon alongside error messages', async () => {
    mockProfileFetchOk(mockUserProfile);
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Something went wrong'),
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByTestId('icon-AlertCircle')).toBeInTheDocument();
    });
  });
});
