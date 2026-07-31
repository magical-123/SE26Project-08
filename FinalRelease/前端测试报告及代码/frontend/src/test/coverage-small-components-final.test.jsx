import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Hoisted Mocks (accessible inside vi.mock factories)
// ===========================================================================

const { mockHtml2canvas } = vi.hoisted(() => ({ mockHtml2canvas: vi.fn() }));
const { mockCacheData, mockGetCachedData } = vi.hoisted(() => ({
  mockCacheData: vi.fn(),
  mockGetCachedData: vi.fn(() => null),
}));
const { mockFetchData } = vi.hoisted(() => ({ mockFetchData: vi.fn() }));
const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
const { mockOnGlobalOfflineChange } = vi.hoisted(() => ({ mockOnGlobalOfflineChange: vi.fn(() => vi.fn()) }));
const { mockCheckConnection } = vi.hoisted(() => ({ mockCheckConnection: vi.fn() }));

// Shared variable for echarts click handler (used in Report tests)
let echartsClickHandler = null;

// ===========================================================================
// Module Mocks
// ===========================================================================

vi.mock('html2canvas', () => ({ default: mockHtml2canvas }));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, prop) => {
      if (typeof prop === 'string') {
        return React.forwardRef(({ children, ...p }, ref) => {
          const { whileHover, initial, animate, exit, transition, ...rest } = p;
          return React.createElement(prop, { ...rest, ref }, children);
        });
      }
      return () => null;
    },
  }),
  AnimatePresence: ({ children }) => children,
}));

vi.mock('lucide-react', () => {
  const icons = [
    'ChevronLeft', 'ChevronRight', 'ExternalLink', 'Quote', 'RefreshCw',
    'Download', 'ArrowRight', 'Sparkles', 'Info', 'Eye',
    'Compass', 'BookOpen', 'Search', 'PieChart', 'User', 'Settings', 'UserCircle',
    'Menu', 'X', 'WifiOff',
    'Clock', 'PlayCircle', 'FileText', 'Mic', 'ArrowUpRight',
    'Heart', 'Star',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

// echarts-for-react mock captures the click handler for word cloud tests
vi.mock('echarts-for-react', () => ({
  default: ({ option, style, onEvents, ...props }) => {
    if (onEvents && onEvents.click) {
      echartsClickHandler = onEvents.click;
    }
    return React.createElement('div', {
      'data-testid': 'echarts',
      style,
      ...props,
    }, 'ECharts');
  },
}));

vi.mock('echarts-wordcloud', () => ({}));

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheData(...args),
  getCachedData: (...args) => mockGetCachedData(...args),
}));

vi.mock('../utils/api', () => ({
  fetchData: (...args) => mockFetchData(...args),
}));

vi.mock('../utils/offlineStore', () => ({
  onGlobalOfflineChange: (...args) => mockOnGlobalOfflineChange(...args),
  checkConnection: (...args) => mockCheckConnection(...args),
}));

vi.mock('../components/Toast/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }) => children,
}));

vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className, onClick, style, ...props }) =>
    React.createElement('div', {
      'data-testid': 'glass-card',
      className: `glass-card ${className || ''}`,
      onClick,
      style,
      ...props,
    }, children),
}));

vi.mock('../components/InsightDrawer/InsightDrawer', () => ({
  InsightDrawer: ({ isOpen, onClose }) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'insight-drawer' },
          React.createElement('button', { onClick: onClose }, '关闭'),
        )
      : null,
}));

vi.mock('../hooks/useInboxItems', () => ({
  useInboxItems: () => ({
    items: [],
    loading: false,
    error: null,
    loadMore: vi.fn(),
    hasMore: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('cmdk', () => ({
  Command: Object.assign(
    ({ children }) => React.createElement('div', { 'data-testid': 'command' }, children),
    {
      Input: ({ placeholder }) =>
        React.createElement('input', { 'data-testid': 'command-input', placeholder }),
      List: ({ children }) =>
        React.createElement('div', { 'data-testid': 'command-list' }, children),
      Empty: ({ children }) =>
        React.createElement('div', { 'data-testid': 'command-empty' }, children),
      Group: ({ children, heading }) =>
        React.createElement('div', { 'data-testid': 'command-group', 'data-heading': heading }, children),
      Item: ({ children, onSelect }) =>
        React.createElement('div', { 'data-testid': 'command-item', onClick: onSelect }, children),
    },
  ),
}));

// CSS mocks
vi.mock('../components/QuoteCard/QuoteCard.css', () => ({}));
vi.mock('../components/InfoSourceCard/InfoSourceCard.css', () => ({}));
vi.mock('../components/PosterModal/PosterModal.css', () => ({}));
vi.mock('../components/RotatingQuoteCard/RotatingQuoteCard.css', () => ({}));
vi.mock('../components/CommandPalette/CommandPalette.css', () => ({}));
vi.mock('../layouts/RootLayout.css', () => ({}));
vi.mock('../pages/Report/Report.css', () => ({}));

// ===========================================================================
// Imports (after all mocks are defined)
// ===========================================================================

import { QuoteCard } from '../components/QuoteCard/QuoteCard';
import { InfoSourceCard } from '../components/InfoSourceCard/InfoSourceCard';
import { PosterModal } from '../components/PosterModal/PosterModal';
import { RotatingQuoteCard } from '../components/RotatingQuoteCard/RotatingQuoteCard';
import { RootLayout } from '../layouts/RootLayout';
import { Report } from '../pages/Report/Report';

// ===========================================================================
// 1. QuoteCard — sourceUrl is null/undefined (line 28: no link rendered)
// ===========================================================================

describe('QuoteCard — sourceUrl null (line 28)', () => {
  afterEach(() => { cleanup(); });

  it('does not render external link when sourceUrl is null', () => {
    const quote = {
      id: 1,
      content: 'Quote with no source URL',
      sourcePlatform: 'Bilibili',
      sourceTitle: 'No Link Test',
      sourceUrl: null,
      reason: 'Some reason',
    };
    render(<QuoteCard quote={quote} />);

    // The .qe-link anchor should NOT be in the document
    expect(document.querySelector('.qe-link')).not.toBeInTheDocument();
    // Quote content should still render
    expect(screen.getByText('"Quote with no source URL"')).toBeInTheDocument();
  });

  it('does not render external link when sourceUrl is undefined', () => {
    const quote = {
      id: 2,
      content: 'Undefined URL test',
      sourcePlatform: 'Dev.to',
      sourceTitle: 'Undefined',
      reason: null,
    };
    render(<QuoteCard quote={quote} />);
    expect(document.querySelector('.qe-link')).not.toBeInTheDocument();
    expect(screen.getByText('"Undefined URL test"')).toBeInTheDocument();
  });

  it('renders reason text when provided', () => {
    const quote = {
      id: 3,
      content: 'Quote with reason',
      sourcePlatform: 'Zhihu',
      sourceTitle: 'Has Reason',
      sourceUrl: null,
      reason: 'Test reason text',
    };
    render(<QuoteCard quote={quote} />);
    expect(screen.getByText('—— Test reason text')).toBeInTheDocument();
  });

  it('stops propagation on sourceUrl link click (line 28)', () => {
    const quote = {
      content: 'Test click propagation',
      sourcePlatform: 'Medium',
      sourceTitle: 'Test',
      sourceUrl: 'https://example.com',
    };
    render(<QuoteCard quote={quote} />);
    // The link renders with class qe-link when sourceUrl is present
    const link = document.querySelector('.qe-link');
    expect(link).not.toBeNull();
    // Fire click to exercise the stopPropagation handler
    fireEvent.click(link);
    // Handler runs without error; link still in DOM
    expect(document.querySelector('.qe-link')).not.toBeNull();
  });
});

// ===========================================================================
// 2. InfoSourceCard — Premium badge rendering (lines 30-35)
// ===========================================================================

describe('InfoSourceCard — Premium Badge (lines 30-35)', () => {
  const sampleData = {
    id: 'prem-1',
    title: '优质信息源测试',
    platform: 'Zhihu',
    author: '优质作者',
    duration: '15分钟',
    date: '2天前',
    isFavorite: false,
    isLiked: false,
    keywords: ['深度', '科技'],
    aiSummary: 'AI summary here',
    processStatus: 'PROCESSED',
  };

  afterEach(() => { cleanup(); });

  it('renders premium badge when isPremium=true and premiumLabel is provided', () => {
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={vi.fn()}
        onTogglePremium={vi.fn()}
        isPremium={true}
        premiumLabel="优质信息源"
      />
    );

    // Premium badge text should be visible
    expect(screen.getByText('优质信息源')).toBeInTheDocument();
    // Premium sparkles icon should be present inside the badge
    expect(screen.getByTestId('icon-Sparkles')).toBeInTheDocument();
    // Premium indicator bar should be in the document
    expect(document.querySelector('.isc-premium-indicator')).toBeInTheDocument();
  });

  it('renders premium badge with custom label', () => {
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={vi.fn()}
        onTogglePremium={vi.fn()}
        isPremium={true}
        premiumLabel="精选推荐"
      />
    );
    expect(screen.getByText('精选推荐')).toBeInTheDocument();
  });

  it('does NOT render premium badge when isPremium=false', () => {
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={vi.fn()}
        onTogglePremium={vi.fn()}
        isPremium={false}
        premiumLabel="优质信息源"
      />
    );
    expect(screen.queryByText('优质信息源')).not.toBeInTheDocument();
    expect(document.querySelector('.isc-premium-indicator')).not.toBeInTheDocument();
  });

  it('does NOT show premium badge content when premiumLabel is empty', () => {
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={vi.fn()}
        onTogglePremium={vi.fn()}
        isPremium={true}
        premiumLabel=""
      />
    );
    // isPremium && premiumLabel → premiumLabel is falsy, so badge div should NOT render
    expect(document.querySelector('.isc-premium-badge')).not.toBeInTheDocument();
    // The premium indicator bar (line 94) is separate — renders when isPremium is true
    expect(document.querySelector('.isc-premium-indicator')).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. PosterModal — Download button & rendering (lines 53, 71, 79)
// ===========================================================================

describe('PosterModal — Download button state (lines 53, 71, 79)', () => {
  const mockPieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['65%', '90%'], center: ['50%', '50%'], data: [] }],
  };

  afterEach(() => { cleanup(); });

  it('renders poster modal with download button enabled', () => {
    render(
      <PosterModal
        onClose={vi.fn()}
        pieOption={mockPieOption}
        insight={{ insightTitle: 'Test Insight', insightSummary: 'Test summary' }}
        activeTab="weekly"
      />
    );

    // Button should say "保存专属海报" and not be disabled
    const downloadBtn = screen.getByText('保存专属海报');
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn.closest('button')).not.toBeDisabled();
    // Download icon should be present
    expect(screen.getByTestId('icon-Download')).toBeInTheDocument();
  });

  it('renders with daily activeTab and null insight fallback', () => {
    render(
      <PosterModal
        onClose={vi.fn()}
        pieOption={mockPieOption}
        insight={null}
        activeTab="daily"
      />
    );

    expect(screen.getByText('保存专属海报')).toBeInTheDocument();
    // Close button (X icon) should be present
    expect(screen.getByTestId('icon-X')).toBeInTheDocument();
  });
});

// ===========================================================================
// 4. RotatingQuoteCard — Auto-rotation + Modal navigation (lines 63-64, 124-171)
// ===========================================================================

describe('RotatingQuoteCard — Auto-rotation with Fake Timers (lines 63-64)', () => {
  const twoQuotes = [
    {
      id: 1, content: 'First quote content.',
      sourcePlatform: 'Twitter', sourceTitle: 'First', reason: 'Reason 1', sourceUrl: 'https://example.com/1',
    },
    {
      id: 2, content: 'Second quote content.',
      sourcePlatform: 'Medium', sourceTitle: 'Second', reason: null, sourceUrl: null,
    },
  ];

  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('rotates to a different quote after 10 seconds', async () => {
    vi.useFakeTimers();

    // Control Math.random for predictable results:
    // First call (randomIndex on mount) => returns 0 => index 0 => "1/2"
    // Subsequent calls in setInterval => return 0.99 => Math.floor(0.99*2)=1 (different from 0)
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 0.99;
    });

    render(<RotatingQuoteCard quotes={twoQuotes} />);

    // Initial state: index 0 => "1/2"
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Advance timers by 10 seconds => triggers auto-rotation
    await act(() => { vi.advanceTimersByTime(10000); });

    // After rotation, index should have changed to 1 => "2/2"
    expect(screen.getByText('2/2')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

// RotatingQuoteCard modal navigation tests were removed because the component's
// randomIndex() initialization makes the starting index unpredictable.
// Modal coverage is already provided by coverage-boost-final.test.jsx and
// coverage-components-addon.test.jsx

// ===========================================================================
// 5. RootLayout — checkConnection, offline/online events, avatarChanged,
//    mobile nav toggle, NavLink click (lines 28-30, 50-51, 65, 114)
// ===========================================================================

describe('RootLayout — Offline/Online coverage (lines 28-30)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockOnGlobalOfflineChange.mockReturnValue(vi.fn());
    mockCheckConnection.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => { cleanup(); });

  it('calls onGlobalOfflineChange and checkConnection on mount (line 28)', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child</div></RootLayout>
      </MemoryRouter>
    );

    // onGlobalOfflineChange should have been called with a callback
    expect(mockOnGlobalOfflineChange).toHaveBeenCalledOnce();
    // checkConnection should have been called at least once (initial call + interval)
    expect(mockCheckConnection).toHaveBeenCalled();
  });

  it('triggers handleOffline when window offline event fires (line 29)', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child</div></RootLayout>
      </MemoryRouter>
    );

    // Initially no offline banner
    expect(document.querySelector('.sidebar-offline-banner')).not.toBeInTheDocument();

    // Fire offline event -> calls handleOffline -> setGlobalOffline(true)
    fireEvent(window, new Event('offline'));

    // Offline banner should appear
    expect(document.querySelector('.sidebar-offline-banner')).toBeInTheDocument();
    expect(document.querySelector('.sidebar-offline-banner').textContent).toContain('当前离线');
  });

  it('triggers handleOnline when window online event fires (line 30)', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child</div></RootLayout>
      </MemoryRouter>
    );

    // Fire online event -> calls handleOnline -> checkConnection({ optimistic: false })
    fireEvent(window, new Event('online'));
    expect(mockCheckConnection).toHaveBeenCalledWith({ optimistic: false });
  });
});

describe('RootLayout — avatarChanged event (lines 50-51)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockOnGlobalOfflineChange.mockReturnValue(vi.fn());
    mockCheckConnection.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => { cleanup(); });

  it('updates avatar and username on avatarChanged event', () => {
    sessionStorage.setItem('avatarUrl', 'https://example.com/old.png');
    sessionStorage.setItem('username', 'OldUser');

    render(
      <MemoryRouter>
        <RootLayout><div>Child</div></RootLayout>
      </MemoryRouter>
    );

    // Old avatar should show
    const img = document.querySelector('.user-avatar-img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/old.png');

    // Update storage and dispatch event
    sessionStorage.setItem('avatarUrl', 'https://example.com/new.png');
    sessionStorage.setItem('username', 'NewUser');
    fireEvent(window, new CustomEvent('avatarChanged'));

    // After event, avatar should be updated
    const updatedImg = document.querySelector('.user-avatar-img');
    expect(updatedImg).toHaveAttribute('src', 'https://example.com/new.png');
  });
});

describe('RootLayout — Mobile nav toggle & NavLink click (lines 65, 114)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockOnGlobalOfflineChange.mockReturnValue(vi.fn());
    mockCheckConnection.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => { cleanup(); });

  it('toggles mobile nav open, closes via nav link click (line 114)', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child Content</div></RootLayout>
      </MemoryRouter>
    );

    // Initially backdrop should not exist
    expect(document.querySelector('.mobile-nav-backdrop')).not.toBeInTheDocument();

    // Open mobile nav
    fireEvent.click(screen.getByLabelText('打开导航菜单'));

    // Backdrop should appear
    expect(document.querySelector('.mobile-nav-backdrop')).toBeInTheDocument();
    expect(document.querySelector('.cascade-nav-container.mobile-nav-open')).toBeInTheDocument();

    // Click a NavLink (DASHBOARD) -> triggers line 114: onClick={() => setMobileNavOpen(false)}
    fireEvent.click(screen.getByText('DASHBOARD'));

    // After clicking nav link, backdrop is gone (mobile nav closed)
    expect(document.querySelector('.mobile-nav-backdrop')).not.toBeInTheDocument();
  });

  it('closes mobile nav via backdrop click', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child Content</div></RootLayout>
      </MemoryRouter>
    );

    // Open mobile nav
    fireEvent.click(screen.getByLabelText('打开导航菜单'));
    expect(document.querySelector('.mobile-nav-backdrop')).toBeInTheDocument();

    // Click backdrop to close
    fireEvent.click(document.querySelector('.mobile-nav-backdrop'));
    expect(document.querySelector('.mobile-nav-backdrop')).not.toBeInTheDocument();
  });

  it('renders all seven nav items (line 65 covered)', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child Content</div></RootLayout>
      </MemoryRouter>
    );

    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
    expect(screen.getByText('INBOX')).toBeInTheDocument();
    expect(screen.getByText('KNOWLEDGE')).toBeInTheDocument();
    expect(screen.getByText('REPORT')).toBeInTheDocument();
    expect(screen.getByText('SOCIAL')).toBeInTheDocument();
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    expect(screen.getByText('PROFILE')).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. Report — Nutrition API error without cache (line 79),
//    Word sources with deleted items (lines 699-706),
//    Info modal close (line 820)
// ===========================================================================

describe('Report — Nutrition API error without cache (line 79)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    mockFetchData.mockReset();
    echartsClickHandler = null;
  });

  afterEach(() => {
    cleanup();
    echartsClickHandler = null;
  });

  it('shows empty state when nutrition API fails and no cache exists', async () => {
    // Nutrition API returns ok:false, all other APIs return empty ok responses
    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      if (url.includes('/wordcloud/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/wordcloud') && !url.includes('/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/topics')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/insights/latest')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    // getCachedData returns null (set in beforeEach), so the
    // else-if branch at line 79 (!cached || !cached.nutritionData) executes

    render(<Report />);

    // Wait for the empty state message (weekly default)
    await waitFor(() => {
      expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
    });

    // Verify nutrition data is empty (no nutrition card rendered)
    expect(screen.queryByText('摄入量')).not.toBeInTheDocument();
  });
});

describe('Report — Word sources with deleted items (lines 699-706)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    mockFetchData.mockReset();
    echartsClickHandler = null;
  });

  afterEach(() => {
    cleanup();
    echartsClickHandler = null;
  });

  it('renders source list with deleted items and count', async () => {
    const dailyWordData = [{ word: 'React', value: 10 }, { word: 'Vue', value: 8 }];

    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [], totalHours: 0, hasData: false }),
        });
      }
      if (url.includes('/wordcloud') && !url.includes('/history') && !url.includes('/sources') && !url.includes('/generate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(dailyWordData) });
      }
      if (url.includes('/wordcloud/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/topics')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/insights/latest')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<Report />);

    // Switch to daily mode
    fireEvent.click(screen.getByText('日报'));

    // Wait for daily word cloud header
    await waitFor(() => {
      expect(screen.getByText('今日关注点 (词云)')).toBeInTheDocument();
    });

    // Source data with deleted items (line 699-706 coverage)
    const mockSourcesData = [
      {
        title: 'React 18 新特性解析',
        platform: '技术博客',
        summary: '深度解析 React 18 的并发模式',
        deleted: true,
        snapshot: 'React 18 快照内容',
        completionRate: 0.85,
        link: 'https://example.com/react18',
      },
      {
        title: 'Vue 3 组合式 API 指南',
        platform: '前端周刊',
        summary: 'Vue 3 组合式 API 最佳实践',
        deleted: false,
        completionRate: 0.92,
        link: 'https://example.com/vue3',
      },
      {
        title: '已删除且无快照的文章',
        platform: '论坛',
        deleted: true,
        snapshot: null,
      },
    ];

    // Mock global.fetch for the word sources API call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSourcesData),
    });

    // Trigger word cloud click
    await act(() => {
      echartsClickHandler({ name: 'React' });
    });

    // Wait for source list card
    await waitFor(() => {
      expect(screen.getByText(/🔍 溯源:/)).toBeInTheDocument();
    });

    // Line 699: deleted count text
    expect(screen.getByText(/2 条原始数据已删除/)).toBeInTheDocument();

    // Lines 703-706: all source items rendered
    expect(screen.getByText('React 18 新特性解析')).toBeInTheDocument();
    expect(screen.getByText('Vue 3 组合式 API 指南')).toBeInTheDocument();
    expect(screen.getByText('已删除且无快照的文章')).toBeInTheDocument();

    // Deleted item with snapshot
    expect(screen.getByText('原始数据已删除，当前显示报告生成时保存的来源快照。')).toBeInTheDocument();
    // Deleted item without snapshot
    expect(screen.getByText('原始数据已删除，旧报告未保存来源快照。')).toBeInTheDocument();

    // Non-deleted items have ArrowRight link icon
    const arrowIcons = screen.getAllByTestId('icon-ArrowRight');
    expect(arrowIcons.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Report — Info modal close via overlay click (line 820)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    mockFetchData.mockReset();
    echartsClickHandler = null;
  });

  afterEach(() => {
    cleanup();
    echartsClickHandler = null;
  });

  it('opens and closes info modal via overlay click', async () => {
    // Nutrition API returns data so the Info icon is visible
    const nutritionData = [
      { name: '技术', value: 30, hours: 2.5, itemStyle: { color: '#4A90E2' } },
    ];

    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: nutritionData, totalHours: 2.5, hasData: true }),
        });
      }
      if (url.includes('/wordcloud/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/wordcloud') && !url.includes('/history') && !url.includes('/sources') && !url.includes('/generate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/topics')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/insights/latest')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<Report />);

    // Wait for Info icon to appear
    await waitFor(() => {
      expect(screen.getByTestId('icon-Info')).toBeInTheDocument();
    });

    // Click Info icon to open the modal
    fireEvent.click(screen.getByTestId('icon-Info'));

    // Modal appears via createPortal into document.body
    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).toBeInTheDocument();
    });
    expect(document.body.querySelector('.info-modal-container').textContent).toContain('数字饮食营养素指南');

    // Close by clicking overlay -> line 820: onClick={() => setShowInfo(false)}
    const overlay = document.body.querySelector('.info-modal-overlay');
    fireEvent.click(overlay);

    // Modal should be closed
    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).not.toBeInTheDocument();
    });
  });
});
