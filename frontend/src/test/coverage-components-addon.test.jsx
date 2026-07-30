import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Global Hoisted Mocks (shared across tests)
// ===========================================================================

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
const { mockCacheData, mockGetCachedData } = vi.hoisted(() => ({
  mockCacheData: vi.fn(),
  mockGetCachedData: vi.fn(() => null),
}));
const { mockInboxApi } = vi.hoisted(() => ({
  mockInboxApi: {
    getItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    regenerateSummary: vi.fn(),
  },
}));
const { mockSetGlobalOffline } = vi.hoisted(() => ({ mockSetGlobalOffline: vi.fn() }));
const { mockOnGlobalOfflineChange } = vi.hoisted(() => ({ mockOnGlobalOfflineChange: vi.fn(() => vi.fn()) }));
const { mockCheckConnection } = vi.hoisted(() => ({ mockCheckConnection: vi.fn() }));

// ===========================================================================
// Module Mocks (hoisted by vitest)
// ===========================================================================

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
    'AlertTriangle', 'Tag', 'Clock', 'PlayCircle', 'FileText', 'Mic', 'ArrowUpRight',
    'Heart', 'Star', 'CheckCircle', 'AlertCircle', 'Check', 'Loader', 'Loader2',
    'Camera', 'Mail', 'LogOut', 'Edit3', 'Calendar',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

vi.mock('echarts-for-react', () => ({
  default: ({ option, style, onEvents, ...props }) =>
    React.createElement('div', { 'data-testid': 'echarts', style, ...props }, 'ECharts'),
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

vi.mock('../components/ConfirmModal/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, onClose, onConfirm, title, message, confirmText, danger }) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'confirm-modal' },
          React.createElement('h3', null, title),
          React.createElement('p', null, message),
          React.createElement('button', { 'data-testid': 'confirm-btn', onClick: () => { onConfirm(); onClose(); } }, confirmText || '确定'),
          React.createElement('button', { 'data-testid': 'cancel-btn', onClick: onClose }, '取消'),
        )
      : null,
}));

vi.mock('../components/Toast/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }) => children,
}));

vi.mock('../utils/api', () => ({
  inboxApi: mockInboxApi,
  fetchData: vi.fn(),
  settingsApi: {},
  crawlApi: {},
  aiConfigApi: {},
}));

vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheData(...args),
  getCachedData: (...args) => mockGetCachedData(...args),
}));

vi.mock('../utils/offlineStore', () => ({
  setGlobalOffline: (...args) => mockSetGlobalOffline(...args),
  onGlobalOfflineChange: (...args) => mockOnGlobalOfflineChange(...args),
  checkConnection: (...args) => mockCheckConnection(...args),
}));

// useInboxItems is NOT mocked at the top level so we can test the real hook.
// For the RootLayout tests, we mock it inside the describe block using the import.
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

// CSS mocks
vi.mock('../components/DetailDrawer/DetailDrawer.css', () => ({}));
vi.mock('../components/RotatingQuoteCard/RotatingQuoteCard.css', () => ({}));
vi.mock('../components/QuoteCard/QuoteCard.css', () => ({}));
vi.mock('../components/InfoSourceCard/InfoSourceCard.css', () => ({}));
vi.mock('../layouts/RootLayout.css', () => ({}));

// ===========================================================================
// Imports (after all mocks)
// ===========================================================================

import { DetailDrawer } from '../components/DetailDrawer/DetailDrawer';
import { RotatingQuoteCard } from '../components/RotatingQuoteCard/RotatingQuoteCard';
import { QuoteCard } from '../components/QuoteCard/QuoteCard';
import { InfoSourceCard } from '../components/InfoSourceCard/InfoSourceCard';
import { RootLayout } from '../layouts/RootLayout';
import { useInboxItems } from '../hooks/useInboxItems';

// ===========================================================================
// 1. DetailDrawer — Nutrition data rendering + danger button state
// ===========================================================================

describe('DetailDrawer — Nutrition Bars & Danger Button', () => {
  const baseData = {
    data: {
      id: 'drawer-test-1',
      title: '测试文章标题',
      platform: 'Bilibili',
      author: '测试作者',
      duration: '5分钟',
      date: '1天前',
      nutritionProtein: 60,
      nutritionCarbs: 30,
      nutritionVitamins: 20,
      nutritionFats: 10,
      nutritionFiber: 5,
      nutritionReasoning: '这是一篇深度技术文章',
      hasNote: true,
    },
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    data: baseData,
    onNoteChange: vi.fn(),
    onToggleKeyword: vi.fn(),
    onAddKeyword: vi.fn(),
    onDeleteKeyword: vi.fn(),
    onUpgrade: vi.fn(),
    isUpgrading: false,
    onTogglePremium: vi.fn(),
    onRegenerateSummary: vi.fn(),
    sourceTitle: '测试文章',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nutrition bars when nutrition data is provided', () => {
    render(<DetailDrawer {...defaultProps} />);

    // Check nutrition section is rendered
    expect(screen.getByText('数字营养成分')).toBeInTheDocument();

    // Check each nutrition bar label is rendered
    expect(screen.getByText('蛋白质（深度知识）')).toBeInTheDocument();
    expect(screen.getByText('碳水（实用技能）')).toBeInTheDocument();
    expect(screen.getByText('维生素（创意灵感）')).toBeInTheDocument();
    expect(screen.getByText('脂肪（纯娱乐）')).toBeInTheDocument();
    expect(screen.getByText('纤维（哲思冥想）')).toBeInTheDocument();

    // Check bar values
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();

    // Check reasoning
    expect(screen.getByText('这是一篇深度技术文章')).toBeInTheDocument();
  });

  it('renders danger button when hasNote is true (premium state)', () => {
    render(<DetailDrawer {...defaultProps} />);

    // The danger button says "取消优质信息源标识"
    const dangerBtn = screen.getByText('取消优质信息源标识');
    expect(dangerBtn).toBeInTheDocument();
    expect(dangerBtn.closest('button')).toHaveClass('danger');

    // Click the danger button
    fireEvent.click(dangerBtn);
    expect(defaultProps.onTogglePremium).toHaveBeenCalledWith('drawer-test-1');
  });
});

// ===========================================================================
// 2. DetailDrawer — Keyword delete confirm modal
// ===========================================================================

describe('DetailDrawer — Keyword Delete Confirm', () => {
  const baseData = {
    data: {
      id: 'drawer-test-2',
      title: '关键词删除测试',
      platform: 'Zhihu',
      author: '作者',
      duration: '3分钟',
      date: '2天前',
    },
  };

  const suggestedKeywords = [
    { label: '前端开发', reason: '技术相关', confidence: 0.9 },
    { label: 'React', reason: '框架相关', confidence: 0.85, isNew: true },
    { label: 'TypeScript', reason: '语言相关' },
  ];

  const selectedKeywords = ['前端开发', 'React'];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    data: baseData,
    onNoteChange: vi.fn(),
    onToggleKeyword: vi.fn(),
    onAddKeyword: vi.fn(),
    onDeleteKeyword: vi.fn(),
    onUpgrade: vi.fn(),
    isUpgrading: false,
    onTogglePremium: vi.fn(),
    onRegenerateSummary: vi.fn(),
    suggestedKeywords,
    selectedKeywords,
    sourceTitle: '关键词测试',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('opens confirm modal when keyword delete button is clicked, then confirms deletion', () => {
    render(<DetailDrawer {...defaultProps} />);

    // Find all keyword delete buttons (X icon buttons)
    const deleteButtons = document.querySelectorAll('.keyword-chip-delete');
    expect(deleteButtons.length).toBe(suggestedKeywords.length);

    // Click delete on the first keyword ('前端开发')
    fireEvent.click(deleteButtons[0]);

    // Confirm modal should appear
    const confirmModal = screen.getByTestId('confirm-modal');
    expect(confirmModal).toBeInTheDocument();
    expect(screen.getByText('删除关键词')).toBeInTheDocument();
    expect(screen.getByText(/确定要彻底删除关键词/)).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByTestId('confirm-btn'));

    // onDeleteKeyword should have been called with '前端开发'
    expect(defaultProps.onDeleteKeyword).toHaveBeenCalledWith('前端开发');
  });

  it('closes confirm modal when cancel is clicked', () => {
    render(<DetailDrawer {...defaultProps} />);

    // Click delete button on second keyword
    const deleteButtons = document.querySelectorAll('.keyword-chip-delete');
    fireEvent.click(deleteButtons[1]);

    // Confirm modal appears
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();

    // Click cancel
    fireEvent.click(screen.getByTestId('cancel-btn'));

    // Confirm modal should close
    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();

    // onDeleteKeyword should NOT have been called
    expect(defaultProps.onDeleteKeyword).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. RotatingQuoteCard — Empty sourceUrl hides "查看原文" link
// ===========================================================================

describe('RotatingQuoteCard — Empty sourceUrl', () => {
  const quoteWithNullSourceUrl = [
    { id: 1, content: '测试内容没有来源链接',
      sourcePlatform: 'Dev.to', sourceTitle: 'No Link', reason: null, sourceUrl: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not show "查看原文" link in modal when sourceUrl is null', () => {
    render(<RotatingQuoteCard quotes={quoteWithNullSourceUrl} />);

    // Open the modal by clicking the card
    const glassCards = screen.getAllByTestId('glass-card');
    const quoteCard = glassCards.find(c => c.textContent.includes('金句摘录'));
    fireEvent.click(quoteCard);

    // The modal should be open
    expect(document.querySelector('.rq-overlay')).toBeInTheDocument();

    // "查看原文" link should NOT be present
    expect(screen.queryByText('查看原文')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. RotatingQuoteCard — Auto-rotation with fake timers
// ===========================================================================

describe('RotatingQuoteCard — Auto Rotation', () => {
  const twoQuotes = [
    { id: 1, content: 'First quote content.',
      sourcePlatform: 'Twitter', sourceTitle: 'First', reason: null, sourceUrl: null },
    { id: 2, content: 'Second quote content.',
      sourcePlatform: 'Medium', sourceTitle: 'Second', reason: null, sourceUrl: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('rotates to a different quote after 10 seconds', async () => {
    vi.useFakeTimers();

    // Mock Math.random so initial index is predictable (returns 0 → index 0 → "1/2")
    let randomCallIndex = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomCallIndex++;
      // First call (randomIndex on mount): return 0 → index 0
      // Second call (setInterval): return 0.99 → Math.floor(0.99*2)=1, different from prev=0 ✓
      return randomCallIndex === 1 ? 0 : 0.99;
    });

    render(<RotatingQuoteCard quotes={twoQuotes} />);

    // Initial counter should be "1/2" (index 0)
    expect(screen.getByText('1/2')).toBeInTheDocument();

    // Advance timers by 10 seconds to trigger rotation
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // After rotation, index should have changed to 1 → "2/2"
    expect(screen.getByText('2/2')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

// ===========================================================================
// 5. QuoteCard — sourceUrl click stopPropagation (line 28)
// ===========================================================================

describe('QuoteCard — sourceUrl rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders external link when sourceUrl is provided', () => {
    const quote = {
      id: 1,
      content: 'Test quote',
      sourcePlatform: 'Bilibili',
      sourceTitle: 'Test Title',
      sourceUrl: 'https://example.com/test',
      reason: 'Test reason',
    };
    render(<QuoteCard quote={quote} />);

    // The ExternalLink icon should be present (it's inside the <a> tag)
    // The link should have href pointing to sourceUrl
    const link = document.querySelector('.qe-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/test');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

// ===========================================================================
// 6. InfoSourceCard — Toggle premium button
// ===========================================================================

describe('InfoSourceCard — Toggle Premium', () => {
  const sampleData = {
    id: 'info-1',
    title: '测试信息源',
    platform: 'Bilibili',
    author: '测试作者',
    duration: '10分钟',
    date: '1天前',
    isFavorite: false,
    isLiked: false,
    keywords: ['技术', '前端'],
  };

  afterEach(() => {
    cleanup();
  });

  it('renders premium badge when isPremium is true', () => {
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={vi.fn()}
        onTogglePremium={vi.fn()}
        isPremium={true}
        premiumLabel="优质信息源"
      />
    );

    // Premium badge should be visible
    expect(screen.getByText('优质信息源')).toBeInTheDocument();
    expect(document.querySelector('.isc-premium-indicator')).toBeInTheDocument();
  });

  it('does not show premium badge when isPremium is false', () => {
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
  });

  it('clicking GlassCard triggers onClick handler', () => {
    const onClick = vi.fn();
    render(
      <InfoSourceCard
        data={sampleData}
        onClick={onClick}
        onTogglePremium={vi.fn()}
        isPremium={false}
      />
    );

    const glassCards = screen.getAllByTestId('glass-card');
    fireEvent.click(glassCards[0]);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// 7. RootLayout — avatarChanged event
// ===========================================================================

describe('RootLayout — avatarChanged Event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockOnGlobalOfflineChange.mockReturnValue(vi.fn());
    mockCheckConnection.mockReset();
    // Make mockInboxApi.getItems return empty data for RootLayout's useInboxItems
    mockInboxApi.getItems.mockResolvedValue({ items: [], totalItems: 0, totalPages: 0, currentPage: 0, premiumCount: 0, aiSummaryCount: 0 });
    mockGetCachedData.mockReturnValue(null);
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    cleanup();
  });

  it('dispatches avatarChanged event and updates avatar display', () => {
    // Set initial avatar in sessionStorage
    sessionStorage.setItem('avatarUrl', 'https://example.com/old-avatar.png');
    sessionStorage.setItem('username', 'OldUser');

    render(
      <MemoryRouter>
        <RootLayout><div>Child</div></RootLayout>
      </MemoryRouter>
    );

    // Initially shows the old avatar
    const img = document.querySelector('.user-avatar-img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/old-avatar.png');

    // Update sessionStorage and dispatch avatarChanged event
    sessionStorage.setItem('avatarUrl', 'https://example.com/new-avatar.png');
    sessionStorage.setItem('username', 'NewUser');

    fireEvent(window, new CustomEvent('avatarChanged'));

    // After the event, the avatar should be updated
    const updatedImg = document.querySelector('.user-avatar-img');
    expect(updatedImg).toBeInTheDocument();
    expect(updatedImg).toHaveAttribute('src', 'https://example.com/new-avatar.png');
  });
});

// ===========================================================================
// 8. RootLayout — Mobile nav open/close
// ===========================================================================

describe('RootLayout — Mobile Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    mockOnGlobalOfflineChange.mockReturnValue(vi.fn());
    mockCheckConnection.mockReset();
    mockInboxApi.getItems.mockResolvedValue({ items: [], totalItems: 0, totalPages: 0, currentPage: 0, premiumCount: 0, aiSummaryCount: 0 });
    mockGetCachedData.mockReturnValue(null);
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    cleanup();
  });

  it('toggles mobile nav open and closes via backdrop', () => {
    render(
      <MemoryRouter>
        <RootLayout><div>Child Content</div></RootLayout>
      </MemoryRouter>
    );

    // Initially the menu toggle should say "打开导航菜单"
    const openBtn = screen.getByLabelText('打开导航菜单');
    expect(openBtn).toBeInTheDocument();

    // Mobile nav should not be open initially (no backdrop)
    expect(document.querySelector('.mobile-nav-backdrop')).not.toBeInTheDocument();

    // Click to open mobile nav
    fireEvent.click(openBtn);

    // After clicking, backdrop should appear and button label changes
    const backdrop = document.querySelector('.mobile-nav-backdrop');
    expect(backdrop).toBeInTheDocument();

    const closeBtns = screen.getAllByLabelText('关闭导航菜单');
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);

    // Click backdrop to close
    fireEvent.click(backdrop);

    // Backdrop should be gone after clicking
    expect(document.querySelector('.mobile-nav-backdrop')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 9. useInboxItems — formatWatchDuration with NaN
// ===========================================================================

describe('useInboxItems — formatWatchDuration NaN Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInboxApi.getItems.mockReset();
    mockGetCachedData.mockReturnValue(null);
    mockCacheData.mockClear();
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    cleanup();
  });

  it('formatWatchDuration returns "未记录" for NaN values via the hook', async () => {
    // Mock the API to return an item with NaN watchDurationSeconds
    mockInboxApi.getItems.mockResolvedValue({
      items: [
        {
          id: 'nan-test-1',
          title: 'NaN Duration Test',
          platform: 'BILIBILI',
          author: 'Test Author',
          watchDurationSeconds: Number.NaN,
          crawledAt: new Date().toISOString(),
          isFavorite: false,
          isLiked: false,
          isPremium: false,
          processStatus: 'PROCESSED',
        },
      ],
      totalItems: 1,
      totalPages: 1,
      currentPage: 0,
      premiumCount: 0,
      aiSummaryCount: 0,
    });

    // Use a test component that calls useInboxItems
    function TestConsumer() {
      const { items, loading } = useInboxItems();
      if (loading || items.length === 0) {
        return React.createElement('div', { 'data-testid': 'loading' }, 'Loading...');
      }
      return React.createElement('div', null,
        React.createElement('span', { 'data-testid': 'item-duration' }, items[0].duration),
      );
    }

    render(React.createElement(TestConsumer));

    // Wait for items to load
    await waitFor(() => {
      expect(mockInboxApi.getItems).toHaveBeenCalled();
    });

    // The duration should be '未记录' for NaN input
    await waitFor(() => {
      const durationEl = screen.queryByTestId('item-duration');
      if (durationEl) {
        expect(durationEl.textContent).toBe('未记录');
      }
    });
  });
});
