import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Mocks (independent of other test files)
// ===========================================================================

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock('../components/Toast/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }) => children,
}));

const mockCacheData = vi.fn();
const mockGetCachedData = vi.fn(() => null);

vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheData(...args),
  getCachedData: (...args) => mockGetCachedData(...args),
}));

const mockFetchData = vi.fn();

vi.mock('../utils/api', () => ({
  fetchData: (...args) => mockFetchData(...args),
}));

// Store echarts click handler so tests can simulate word cloud clicks
let echartsClickHandler = null;

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

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return React.forwardRef(({ children, ...props }, ref) => {
            const { whileHover, initial, animate, exit, transition, ...rest } = props;
            return React.createElement(prop, { ...rest, ref }, children);
          });
        }
        return () => null;
      },
    },
  ),
  AnimatePresence: ({ children }) => children,
}));

vi.mock('lucide-react', () => {
  const icons = ['Download', 'ArrowRight', 'Sparkles', 'Info', 'RefreshCw', 'Eye'];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

const mockUseNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: (...args) => {
    mockUseNavigate(...args);
    return mockUseNavigate;
  },
}));

vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className, ...props }) =>
    React.createElement('div', { className: `glass-card ${className || ''}`, ...props }, children),
}));

vi.mock('../components/PosterModal/PosterModal', () => ({
  PosterModal: ({ onClose }) =>
    React.createElement('div', { 'data-testid': 'poster-modal' },
      React.createElement('button', { 'data-testid': 'poster-close-btn', onClick: onClose }, '关闭'),
    ),
}));

vi.mock('../components/InsightDrawer/InsightDrawer', () => ({
  InsightDrawer: ({ isOpen, onClose, insight, reportType }) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'insight-drawer', 'data-report-type': reportType },
          React.createElement('button', { onClick: onClose }, '关闭'),
        )
      : null,
}));

vi.mock('../pages/Report/Report.css', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Report } from '../pages/Report/Report';

// ===========================================================================
// Tests
// ===========================================================================

describe('Report — Coverage Addon', () => {
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

  // ── Test 1: Nutrition API error without cache (line 79) ────────────────
  it('1. 营养 API 非 ok 且无缓存时触发 line 79 的空数据分支', async () => {
    // Arrange: nutrition API returns ok:false, all other APIs return empty
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

    // getCachedData returns null (set in beforeEach), so cached is null
    // This means !cached is true → line 79 branch executes

    render(<Report />);

    // Verification: empty state is shown because hasNutritionData is false
    await waitFor(() => {
      expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
    });

    // Verify nutrition data state is empty (no crash)
    expect(screen.queryByText('摄入量')).not.toBeInTheDocument();
  });

  // ── Test 2: Word sources with deleted items (lines 699-706) ────────────
  it('2. 溯源列表渲染含已删除标记的来源项', async () => {
    // Arrange: set up daily mode with word cloud data
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

    // Switch to daily mode for simpler word sources URL construction
    fireEvent.click(screen.getByText('日报'));

    // Wait for the daily word cloud header to render
    await waitFor(() => {
      expect(screen.getByText('今日关注点 (词云)')).toBeInTheDocument();
    });

    // Simulate word cloud click - trigger the stored echarts click handler
    expect(echartsClickHandler).toBeDefined();

    // Mock global.fetch for the word sources API call
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSourcesData),
    });

    // Trigger word click
    await act(() => {
      echartsClickHandler({ name: 'React' });
    });

    // Wait for the source list card to appear with the deleted count text
    await waitFor(() => {
      expect(screen.getByText(/🔍 溯源:/)).toBeInTheDocument();
    });

    // Verify line 699: the deleted count text
    expect(screen.getByText(/2 条原始数据已删除/)).toBeInTheDocument();

    // Verify lines 703-706: source items are rendered
    expect(screen.getByText('React 18 新特性解析')).toBeInTheDocument();
    expect(screen.getByText('Vue 3 组合式 API 指南')).toBeInTheDocument();
    expect(screen.getByText('已删除且无快照的文章')).toBeInTheDocument();

    // Verify deleted items show snapshot fallback text
    expect(screen.getByText('原始数据已删除，当前显示报告生成时保存的来源快照。')).toBeInTheDocument();
    expect(screen.getByText('原始数据已删除，旧报告未保存来源快照。')).toBeInTheDocument();

    // Verify non-deleted items have a link (ArrowRight icon)
    const arrowIcons = screen.getAllByTestId('icon-ArrowRight');
    expect(arrowIcons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Test 3: Info modal open/close via overlay click (line 820) ─────────
  it('3. 信息弹窗通过点击遮罩层关闭', async () => {
    // Arrange: nutrition API returns data so the Info icon is visible
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

    // Wait for the nutrition card to render with the Info icon
    await waitFor(() => {
      expect(screen.getByTestId('icon-Info')).toBeInTheDocument();
    });

    // Click Info icon to open the modal
    fireEvent.click(screen.getByTestId('icon-Info'));

    // Verify modal appears (createPortal renders into document.body)
    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).toBeInTheDocument();
    });
    expect(document.body.querySelector('.info-modal-container').textContent).toContain('数字饮食营养素指南');

    // Close by clicking the overlay (line 820 onClick handler)
    const overlay = document.body.querySelector('.info-modal-overlay');
    fireEvent.click(overlay);

    // Verify modal is closed
    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).not.toBeInTheDocument();
    });
  });
});
