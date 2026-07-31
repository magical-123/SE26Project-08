import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Mocks
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

const mockSetGlobalOffline = vi.fn();

vi.mock('../utils/offlineStore', () => ({
  setGlobalOffline: (...args) => mockSetGlobalOffline(...args),
}));

const mockFetchData = vi.fn();

vi.mock('../utils/api', () => ({
  fetchData: (...args) => mockFetchData(...args),
}));

vi.mock('echarts-for-react', () => ({
  default: ({ option, style, onEvents, ...props }) =>
    React.createElement('div', {
      'data-testid': 'echarts',
      style,
      ...props,
    }, 'ECharts'),
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
  const icons = [
    'Download', 'ArrowRight', 'Sparkles', 'Info', 'RefreshCw', 'Eye', 'Loader2',
    'UserPlus', 'Search', 'X', 'Check', 'ChevronDown', 'TrendingUp',
    'User', 'Mail', 'LogOut', 'CheckCircle', 'AlertCircle', 'Camera', 'UserCircle',
  ];
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
  PosterModal: ({ pieOption, insight, activeTab, onClose }) =>
    React.createElement('div', {
      'data-testid': 'poster-modal',
      'data-pie-option': JSON.stringify(pieOption),
      'data-active-tab': activeTab,
      'data-has-insight': String(Boolean(insight)),
    },
      React.createElement('button', { 'data-testid': 'poster-close-btn', onClick: onClose }, '关闭'),
    ),
}));

vi.mock('../components/InsightDrawer/InsightDrawer', () => ({
  InsightDrawer: ({ isOpen, onClose, insight, reportType }) =>
    isOpen
      ? React.createElement('div', {
          'data-testid': 'insight-drawer',
          'data-report-type': reportType,
          'data-has-insight': String(Boolean(insight)),
        },
          React.createElement('button', { onClick: onClose }, '关闭'),
        )
      : null,
}));

vi.mock('../components/FriendGraphView/FriendGraphView', () => ({
  FriendGraphView: ({ friendId, friendName, onClose }) =>
    React.createElement('div', { 'data-testid': 'friend-graph-view', 'data-friend-id': friendId },
      React.createElement('span', null, `${friendName} 的知识图谱`),
      React.createElement('button', { 'data-testid': 'graph-close-btn', onClick: onClose }, '关闭'),
    ),
}));

vi.mock('../components/FriendTrendView/FriendTrendView', () => ({
  FriendTrendView: ({ friendId, friendName, onClose }) =>
    React.createElement('div', { 'data-testid': 'friend-trend-view', 'data-friend-id': friendId },
      React.createElement('span', null, `${friendName} 的浏览趋势`),
      React.createElement('button', { 'data-testid': 'trend-close-btn', onClick: onClose }, '关闭'),
    ),
}));

vi.mock('../pages/Report/Report.css', () => ({}));
vi.mock('../pages/Social/Social.css', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Report } from '../pages/Report/Report';
import { Social } from '../pages/Social/Social';

// ===========================================================================
// Mock Data
// ===========================================================================

const mockNutritionData = [
  { name: '技术', value: 30, hours: 2.5, itemStyle: { color: '#4A90E2' } },
  { name: '科学', value: 25, hours: 2.0, itemStyle: { color: '#50C878' } },
  { name: '艺术', value: 20, hours: 1.5, itemStyle: { color: '#F39C12' } },
  { name: '商业', value: 15, hours: 1.0, itemStyle: { color: '#9B59B6' } },
  { name: '娱乐', value: 10, hours: 0.5, itemStyle: { color: '#E74C3C' } },
];

const mockInsight = {
  insightTitle: '本周数字饮食洞察',
  insightSummary: '你本周的**技术**类内容摄入充足，**娱乐**类占比偏低',
  reportDate: '2024-01-07',
};

const mockWordCloudHistory = [
  { reportDate: '2024-01-06', keywords: [{ word: 'React', value: 10 }, { word: 'TypeScript', value: 8 }] },
  { reportDate: '2024-01-07', keywords: [{ word: 'Vue', value: 7 }, { word: 'Node', value: 6 }] },
];

const mockTopicClusters = [
  { name: '前端框架', count: 8, tags: ['React', 'Vue', 'Angular'] },
  { name: '后端开发', count: 5, tags: ['Node.js', 'Python'] },
];

const mockFriends = [
  { id: 1, name: 'Alice', status: '在线', initial: 'A', activeColor: '#4A90E2', isOnline: true, tags: ['React', 'TypeScript'] },
  { id: 2, name: 'Bob', status: '忙碌', initial: 'B', activeColor: '#50C878', isOnline: false, tags: ['Vue', 'Node.js'] },
];

const mockRequests = [
  { id: 101, username: 'Charlie', direction: 'received' },
  { id: 102, username: 'David', direction: 'sent' },
];

// ===========================================================================
// Helpers
// ===========================================================================

function mockReportApi(options = {}) {
  const {
    hasData = false,
    nutritionData = [],
    totalHours = 0,
    insightHasReport = false,
    insightData = null,
    wordCloudHistory = [],
    dailyWordCloud = [],
    topics = [],
  } = options;

  mockFetchData.mockImplementation((url) => {
    if (url.includes('/nutrition')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: nutritionData, totalHours, hasData }),
      });
    }
    if (url.includes('/wordcloud/history')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(wordCloudHistory) });
    }
    if (url.includes('/wordcloud') && !url.includes('/history') && !url.includes('/sources') && !url.includes('/generate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(dailyWordCloud) });
    }
    if (url.includes('/topics') && !url.includes('/generate')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(topics) });
    }
    if (url.includes('/insights/latest')) {
      if (insightData) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(insightData) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, hasReport: insightHasReport, report: insightHasReport ? mockInsight : null }),
      });
    }
    if (url.includes('/sources')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function mockSocialApi(options = {}) {
  const { friends = mockFriends, requests = mockRequests, failFriends = false, failRequests = false } = options;
  global.fetch.mockImplementation((url, init) => {
    const urlStr = typeof url === 'string' ? url : '';
    if (urlStr.includes('/api/social/friends') && !urlStr.includes('/requests')) {
      return failFriends
        ? Promise.reject(new Error('Network error'))
        : Promise.resolve({ ok: true, json: () => Promise.resolve(friends) });
    }
    if (urlStr.includes('/api/social/requests') && urlStr.includes('/accept')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (urlStr.includes('/api/social/requests')) {
      return failRequests
        ? Promise.resolve({ ok: false, text: () => Promise.resolve('Error') })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(requests) });
    }
    if (urlStr.includes('/api/social/users/search')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (urlStr.includes('/api/social/request') && init && init.method === 'POST') {
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// ===========================================================================
// Report Page — Additional Tests (to boost coverage beyond existing)
// ===========================================================================

describe('Report Page — Extra Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    mockFetchData.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Test 1: Handles nutrition API non-ok response gracefully ────────────
  it('1. 营养数据 API 返回非 ok 时显示空状态', async () => {
    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      if (url.includes('/wordcloud/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/wordcloud')) {
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

    await waitFor(() => {
      expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
    });
  });

  // ── Test 2: Handles nutrition API catch error ───────────────────────────
  it('2. 营养数据 API 抛出异常时优雅降级', async () => {
    mockFetchData.mockRejectedValue(new Error('Network error'));

    render(<Report />);

    // Should still render the page without crashing
    await waitFor(() => {
      expect(screen.getByText('数字饮食报告')).toBeInTheDocument();
    });

    // Should show empty state since API failed and no cache
    expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
  });

  // ── Test 3: Nutrition pie chart data transform when empty ──────────────
  it('3. 营养饼图在数据为空时使用默认占位数据', async () => {
    mockReportApi({
      hasData: false,
      nutritionData: [],
      totalHours: 0,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
    });

    // Empty state message is shown instead of nutrition table
    expect(screen.queryByText('摄入量')).not.toBeInTheDocument();
  });

  // ── Test 4: Word cloud renders in daily mode ──────────────────────────
  it('4. 日报模式下词云使用日报数据渲染', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      dailyWordCloud: [{ word: 'JavaScript', value: 15 }],
    });
    render(<Report />);

    // Switch to daily mode
    const dailyBtn = screen.getByText('日报');
    fireEvent.click(dailyBtn);

    // Should show "今日关注点 (词云)" heading
    await waitFor(() => {
      expect(screen.getByText('今日关注点 (词云)')).toBeInTheDocument();
    });

    // ECharts should still be present
    expect(screen.getAllByTestId('echarts').length).toBeGreaterThan(0);
  });

  // ── Test 5: Word cloud renders in weekly mode with history ─────────────
  it('5. 周报模式下词云使用滑块选择的历史数据', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      wordCloudHistory: mockWordCloudHistory,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('近期关注点流变 (词云)')).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('echarts').length).toBeGreaterThan(0);
  });

  // ── Test 6: Timeline slider exists in weekly mode with history ─────────
  it('6. 周报模式有词云历史数据时显示时间轴滑块和日期标签', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      wordCloudHistory: mockWordCloudHistory,
    });
    render(<Report />);

    await waitFor(() => {
      const slider = document.querySelector('.timeline-slider');
      expect(slider).toBeInTheDocument();
    });

    // Check timeline labels exist
    const labels = document.querySelectorAll('.timeline-labels span');
    expect(labels.length).toBe(2);
  });

  // ── Test 7: Timeline slider does NOT show in daily mode ───────────────
  it('7. 日报模式下不显示时间轴滑块', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      dailyWordCloud: [{ word: 'Test', value: 5 }],
      wordCloudHistory: mockWordCloudHistory,
    });
    render(<Report />);

    // Switch to daily
    fireEvent.click(screen.getByText('日报'));

    await waitFor(() => {
      expect(screen.getByText('今日关注点 (词云)')).toBeInTheDocument();
    });

    // No timeline slider in daily mode
    expect(document.querySelector('.timeline-slider')).not.toBeInTheDocument();
  });

  // ── Test 8: "生成分享海报" opens PosterModal and passes correct props ──
  it('8. "生成分享海报" 打开 PosterModal 并传递正确的 props', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: true,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('生成分享海报')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('生成分享海报'));

    const modal = screen.getByTestId('poster-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.dataset.activeTab).toBe('weekly');
    expect(modal.dataset.hasInsight).toBe('true');
  });

  // ── Test 9: API fetch error for insights shows graceful state ──────────
  it('9. 洞察 API 失败时显示空洞察界面', async () => {
    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockNutritionData, totalHours: 7.5, hasData: true }),
        });
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
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<Report />);

    await waitFor(() => {
      // Should show the "no insight" empty message
      expect(screen.getByText('还未有洞察，快去生成吧')).toBeInTheDocument();
    });

    // Should have "生成洞察" button since hasNutritionData is true
    expect(screen.getByText('生成洞察')).toBeInTheDocument();
  });

  // ── Test 10: Insight cache fallback when nutrition API fails ───────────
  it('10. 营养 API 失败但有缓存时使用缓存数据', async () => {
    const cachedData = {
      nutritionData: mockNutritionData,
      totalHours: 7.5,
    };
    mockGetCachedData.mockReturnValue(cachedData);
    mockFetchData.mockRejectedValue(new Error('Network error'));

    render(<Report />);

    await waitFor(() => {
      // Should show nutrition data from cache
      expect(screen.getByText('营养分类占比')).toBeInTheDocument();
      expect(screen.getByText('摄入量')).toBeInTheDocument();
    });

    expect(screen.getByText('7.50h')).toBeInTheDocument();
  });

  // ── Test 11: Insight cache fallback when insight API fails ─────────────
  it('11. 洞察 API 失败但有缓存时显示缓存的洞察', async () => {
    const cachedData = {
      insight: mockInsight,
      hasInsight: true,
    };
    mockGetCachedData.mockReturnValue(cachedData);

    mockFetchData.mockImplementation((url) => {
      if (url.includes('/nutrition')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockNutritionData, totalHours: 7.5, hasData: true }),
        });
      }
      if (url.includes('/wordcloud/history')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/wordcloud') && !url.includes('/history') && !url.includes('/sources')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/topics')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/insights/latest')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });

    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('本周数字饮食洞察')).toBeInTheDocument();
    });
  });

  // ── Test 12: Regenerate insight button success flow ────────────────────
  it('12. 重新生成洞察按钮成功更新洞察内容', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: true,
    });

    const newInsight = { insightTitle: '更新后的洞察', insightSummary: '新的摘要' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, report: newInsight }),
    });

    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('重新生成')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('重新生成'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/insights/generate?type=WEEKLY'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockToast.success).toHaveBeenCalledWith('洞察生成成功！');
    });
  });

  // ── Test 13: Regenerate insight button failure shows error toast ──────
  it('13. 重新生成洞察失败时显示错误提示', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ success: false, error: '服务不可用' }),
    });

    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('重新生成')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('重新生成'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('生成失败: 服务不可用');
    });
  });

  // ── Test 14: Topic clusters render correctly ───────────────────────────
  it('14. 话题聚类数据正确渲染', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      topics: mockTopicClusters,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('高频话题聚类')).toBeInTheDocument();
    });

    expect(screen.getByText('前端框架')).toBeInTheDocument();
    expect(screen.getByText('后端开发')).toBeInTheDocument();
    // Count display
    expect(screen.getByText('8 篇')).toBeInTheDocument();
    expect(screen.getByText('5 篇')).toBeInTheDocument();
    // Tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
  });

  // ── Test 15: Empty topic clusters shows placeholder ────────────────────
  it('15. 话题聚类数据为空时显示占位提示', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      topics: [],
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('暂无话题聚类数据')).toBeInTheDocument();
    });
  });

  // ── Test 16: Info modal (nutrient guide) opens and closes ──────────────
  it('16. 营养素指南信息弹窗打开和关闭', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByTestId('icon-Info')).toBeInTheDocument();
    });

    // Click the Info icon
    fireEvent.click(screen.getByTestId('icon-Info'));

    // Modal should appear in document.body (portalled)
    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).toBeInTheDocument();
    });
    expect(document.body.querySelector('.info-modal-container').textContent).toContain('数字饮食营养素指南');

    // Close via the close button
    const closeBtn = document.body.querySelector('.info-modal-close');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(document.body.querySelector('.info-modal-overlay')).not.toBeInTheDocument();
    });
  });

  // ── Test 17: Nutrition table shows correct category names and values ───
  it('17. 营养成分表正确显示分类名称和数值', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('技术')).toBeInTheDocument();
    });

    expect(screen.getByText('科学')).toBeInTheDocument();
    expect(screen.getByText('艺术')).toBeInTheDocument();
    expect(screen.getByText('商业')).toBeInTheDocument();
    expect(screen.getByText('娱乐')).toBeInTheDocument();

    // Percentage values
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Hours
    expect(screen.getByText('2.5h')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getAllByText('0.5h')).toHaveLength(1);
  });

  // ── Test 18: Daily mode shows correct empty text ──────────────────────
  it('18. 日报模式无数据时显示正确的空状态文案', async () => {
    mockReportApi({ hasData: false });

    // Switch to daily first
    render(<Report />);

    const dailyBtn = screen.getByText('日报');
    fireEvent.click(dailyBtn);

    await waitFor(() => {
      expect(screen.getByText('今日暂无已分析内容')).toBeInTheDocument();
    });
  });

  // ── Test 19: Stats summary shows correct totalHours ────────────────────
  it('19. 统计摘要正确显示总耗时', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 12.34,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('12.34h')).toBeInTheDocument();
    });
  });

  // ── Test 20: Insight drawer opens from detail button ──────────────────
  it('20. 查看洞察详情按钮打开 InsightDrawer', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: true,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('查看洞察详情')).toBeInTheDocument();
    });

    // Drawer should not be open initially
    expect(screen.queryByTestId('insight-drawer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('查看洞察详情'));

    await waitFor(() => {
      expect(screen.getByTestId('insight-drawer')).toBeInTheDocument();
    });

    // Close the drawer
    fireEvent.click(screen.getByText('关闭'));
    expect(screen.queryByTestId('insight-drawer')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Social Page — Additional Tests (to boost coverage beyond existing)
// ===========================================================================

describe('Social Page — Extra Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    global.fetch = vi.fn();
    sessionStorage.setItem('token', 'test-token');
    mockSetGlobalOffline.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Test 1: Show loading state while data is being fetched ─────────────
  it('1. 数据加载中显示 loading 状态', () => {
    // Never resolve the fetch to keep it pending
    global.fetch = vi.fn(() => new Promise(() => {}));

    render(<Social />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
    expect(screen.getByText('社交发现')).toBeInTheDocument();
  });

  // ── Test 2: API fetch error triggers offline state ─────────────────────
  it('2. API 获取失败时触发离线状态', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<Social />);

    await waitFor(() => {
      expect(mockSetGlobalOffline).toHaveBeenCalledWith(true);
    });
  });

  // ── Test 3: Loading state disappears after API fetch completes ────────
  it('3. 数据加载完成后 loading 状态消失', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('社交发现')).toBeInTheDocument();
  });

  // ── Test 4: Accept friend request triggers correct API call ────────────
  it('4. 接受好友请求触发正确的 API 调用', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    const acceptBtn = screen.getByText('接受');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/social/requests/101/accept'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  // ── Test 5: Reject friend request triggers correct API call ────────────
  it('5. 拒绝好友请求触发正确的 API 调用', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    const rejectBtn = screen.getByText('拒绝');
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/social/requests/101'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── Test 6: Withdraw sent friend request triggers correct API call ─────
  it('6. 撤回已发送的好友请求触发正确的 API 调用', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('David')).toBeInTheDocument();
    });

    const withdrawBtn = screen.getByText('撤回');
    fireEvent.click(withdrawBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/social/requests/102'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── Test 7: Empty state when no friends and no requests ───────────────
  it('7. 没有好友和请求时显示空状态', async () => {
    mockSocialApi({ friends: [], requests: [] });
    render(<Social />);

    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });

    // Title is still visible
    expect(screen.getByText('社交发现')).toBeInTheDocument();

    // No friend cards
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();

    // No request sections
    expect(screen.queryByText('好友请求 (')).not.toBeInTheDocument();
    expect(screen.queryByText('已发送的请求 (')).not.toBeInTheDocument();
  });

  // ── Test 8: Send friend request via AddFriendModal ─────────────────────
  it('8. 添加好友搜索弹窗发送好友请求', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('添加好友')).toBeInTheDocument();
    });

    // Open modal - use the button, not the h2 that appears in modal
    const addFriendBtn = screen.getByText('添加好友');
    fireEvent.click(addFriendBtn);

    // Verify modal is open by checking the search input appears
    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索用户名...')).toBeInTheDocument();
    });

    // Search for a user
    global.fetch.mockImplementation((url, init) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/api/social/users/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 200, username: 'Emily' }]),
        });
      }
      if (urlStr.includes('/api/social/request') && init && init.method === 'POST') {
        return Promise.resolve({ ok: true });
      }
      if (urlStr.includes('/api/social/friends')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFriends) });
      }
      if (urlStr.includes('/api/social/requests')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRequests) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const searchInput = screen.getByPlaceholderText('搜索用户名...');
    fireEvent.change(searchInput, { target: { value: 'Emily' } });

    await waitFor(() => {
      expect(screen.getByText('Emily')).toBeInTheDocument();
    });

    // Click the add button
    const addBtns = screen.getAllByText('添加');
    fireEvent.click(addBtns[addBtns.length - 1]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/social/request'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ receiverId: 200 }),
        }),
      );
    });
  });

  // ── Test 9: AddFriendModal can be closed ──────────────────────────────
  it('9. 添加好友弹窗可以关闭', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('添加好友')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('添加好友'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索用户名...')).toBeInTheDocument();
    });

    // Close via overlay click
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('搜索用户名...')).not.toBeInTheDocument();
    });
  });

  // ── Test 10: Collapse sent requests section ───────────────────────────
  it('10. 已发送请求可收起/展开', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('David')).toBeInTheDocument();
    });

    // Click to collapse sent requests
    fireEvent.click(screen.getByText('已发送的请求 (1)'));
    expect(screen.queryByText('David')).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByText('已发送的请求 (1)'));
    await waitFor(() => {
      expect(screen.getByText('David')).toBeInTheDocument();
    });
  });

  // ── Test 11: Friend cards display correct info ─────────────────────────
  it('11. 好友卡片显示正确的信息（姓名、状态、标签）', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Online/offline status
    expect(screen.getByText('在线')).toBeInTheDocument();
    expect(screen.getByText('忙碌')).toBeInTheDocument();

    // Tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();

    // "Ta 最近在刷：" label
    expect(screen.getAllByText('Ta 最近在刷：').length).toBeGreaterThan(0);

    // Initial letters
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  // ── Test 12: Cached social data used for instant display ──────────────
  it('12. 缓存数据用于即时展示', async () => {
    const cachedData = {
      friends: mockFriends,
      requests: mockRequests,
    };
    mockGetCachedData.mockReturnValue(cachedData);

    // API also returns data (won't cause a race issue)
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/social/friends')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFriends) });
      }
      if (url.includes('/api/social/requests')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRequests) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<Social />);

    // Friends should appear immediately from cache
    await waitFor(() => {
      expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  // ── Test 13: Sent requests section shows pending label ────────────────
  it('13. 已发送请求显示"等待对方确认"标签', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('等待对方确认')).toBeInTheDocument();
    });
  });

  // ── Test 14: Accept request refreshes friends list ─────────────────────
  it('14. 接受请求后重新拉取好友列表', async () => {
    global.fetch.mockImplementation((url, init) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/api/social/requests/101/accept')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (urlStr.includes('/api/social/friends')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFriends) });
      }
      if (urlStr.includes('/api/social/requests') && !urlStr.includes('/accept')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRequests) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('接受')).toBeInTheDocument();
    });

    const fetchCallCountBefore = global.fetch.mock.calls.filter(
      c => c[0].includes('/api/social/friends')
    ).length;

    fireEvent.click(screen.getByText('接受'));

    await waitFor(() => {
      const fetchCallCountAfter = global.fetch.mock.calls.filter(
        c => c[0].includes('/api/social/friends')
      ).length;
      expect(fetchCallCountAfter).toBeGreaterThan(fetchCallCountBefore);
    });
  });

  // ── Test 15: Single friend shows view graph button ────────────────────
  it('15. 单个好友卡片显示查看知识图谱和浏览趋势按钮', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Both buttons should be present
    expect(screen.getAllByText('查看知识图谱').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('查看浏览趋势').length).toBeGreaterThanOrEqual(1);
  });
});
