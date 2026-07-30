import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Mocks (hoisted to top)
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
  clearCache: vi.fn(),
  clearAllCache: vi.fn(),
}));

vi.mock('../utils/offlineStore', () => ({
  setGlobalOffline: vi.fn(),
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
  PosterModal: ({ onClose }) =>
    React.createElement('div', { 'data-testid': 'poster-modal' },
      React.createElement('button', { 'data-testid': 'poster-close-btn', onClick: onClose }, '关闭'),
    ),
}));

vi.mock('../components/InsightDrawer/InsightDrawer', () => ({
  InsightDrawer: ({ isOpen, onClose }) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'insight-drawer' },
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
vi.mock('../pages/Profile/ProfilePage.css', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Report } from '../pages/Report/Report';
import { Social } from '../pages/Social/Social';
import { ProfilePage } from '../pages/Profile/ProfilePage';

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
  insightFullText: '详细分析内容...',
  reportDate: '2024-01-07',
  version: 1,
  createdAt: '2024-01-07T12:00:00Z',
  success: true,
  hasReport: true,
  report: {
    insightTitle: '本周数字饮食洞察',
    insightSummary: '你本周的**技术**类内容摄入充足，**娱乐**类占比偏低',
  },
};

const mockWordCloudHistory = [
  { reportDate: '2024-01-01', keywords: [{ word: 'React', value: 10 }, { word: 'TypeScript', value: 8 }] },
  { reportDate: '2024-01-02', keywords: [{ word: 'Vue', value: 7 }, { word: 'Node', value: 6 }] },
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
  { id: 1, username: 'Charlie', direction: 'received' },
  { id: 2, username: 'David', direction: 'sent' },
];

const mockUserProfile = {
  username: 'Alice',
  email: 'alice@example.com',
  avatarUrl: null,
  selfPortrait: '',
  createdAt: '2024-01-01T00:00:00Z',
};

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
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(wordCloudHistory),
      });
    }
    if (url.includes('/wordcloud') && !url.includes('/history') && !url.includes('/sources') && !url.includes('/generate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }
    if (url.includes('/topics')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(topics),
      });
    }
    if (url.includes('/insights/latest')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(insightData || { success: true, hasReport: insightHasReport }),
      });
    }
    if (url.includes('/sources')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

// ===========================================================================
// Report Page Tests
// ===========================================================================

describe('Report Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    mockFetchData.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. 渲染 "数字饮食报告" 标题和周报/日报标签', async () => {
    mockReportApi({ hasData: false });
    render(<Report />);

    expect(screen.getByText('数字饮食报告')).toBeInTheDocument();
    expect(screen.getByText('周报')).toBeInTheDocument();
    expect(screen.getByText('日报')).toBeInTheDocument();
  });

  it('2. 无营养数据时显示空状态提示', async () => {
    mockReportApi({ hasData: false });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('最近 7 天暂无已分析内容')).toBeInTheDocument();
    });
  });

  it('3. 有营养数据时显示图表和统计信息', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('营养分类占比')).toBeInTheDocument();
      expect(screen.getByText('摄入量')).toBeInTheDocument();
      expect(screen.getByText('7.50h')).toBeInTheDocument();
    });

    // Should render ECharts donut chart
    expect(screen.getAllByTestId('echarts').length).toBeGreaterThan(0);
  });

  it('4. 周报/日报标签切换', async () => {
    mockReportApi({ hasData: false });
    render(<Report />);

    // Default is weekly
    const weeklyBtn = screen.getByText('周报');
    const dailyBtn = screen.getByText('日报');

    expect(weeklyBtn.className).toContain('active');
    expect(dailyBtn.className).not.toContain('active');

    // Switch to daily
    fireEvent.click(dailyBtn);

    await waitFor(() => {
      expect(dailyBtn.className).toContain('active');
      expect(weeklyBtn.className).not.toContain('active');
    });

    // Switch back to weekly
    fireEvent.click(weeklyBtn);

    await waitFor(() => {
      expect(weeklyBtn.className).toContain('active');
      expect(dailyBtn.className).not.toContain('active');
    });
  });

  it('5. 有洞察数据时显示 AI 洞察区域', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: true,
      insightData: mockInsight,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('本周数字饮食洞察')).toBeInTheDocument();
    });
  });

  it('6. 无洞察数据时显示空洞察提示', async () => {
    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
      insightHasReport: false,
      insightData: { success: true, hasReport: false },
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('还未有洞察，快去生成吧')).toBeInTheDocument();
    });
  });

  it('7. 生成洞察按钮触发 API 请求', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, report: mockInsight.report }),
    });

    mockReportApi({
      hasData: true,
      nutritionData: mockNutritionData,
      totalHours: 7.5,
    });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('还未有洞察，快去生成吧')).toBeInTheDocument();
    });

    const generateBtn = screen.getByText('生成洞察');
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/insights/generate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('8. 周报模式下显示时间轴滑块', async () => {
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
  });

  it('9. "生成分享海报" 按钮打开海报弹窗', async () => {
    mockReportApi({ hasData: false });
    render(<Report />);

    await waitFor(() => {
      expect(screen.getByText('生成分享海报')).toBeInTheDocument();
    });

    // Initially no poster modal
    expect(screen.queryByTestId('poster-modal')).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(screen.getByText('生成分享海报'));
    expect(screen.getByTestId('poster-modal')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByTestId('poster-close-btn'));
    expect(screen.queryByTestId('poster-modal')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Social Page Tests
// ===========================================================================

describe('Social Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  function mockSocialApi() {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/social/friends')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFriends),
        });
      }
      if (url.includes('/api/social/requests')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRequests),
        });
      }
      if (url.includes('/api/social/users/search')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes('/api/social/request') && url.includes('POST')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  }

  it('1. 渲染 "社交发现" 标题和搜索框、添加好友按钮', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('社交发现')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('搜索知识好友...')).toBeInTheDocument();
    expect(screen.getByText('添加好友')).toBeInTheDocument();
  });

  it('2. 显示好友列表', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('3. 显示收到的好友请求', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('好友请求 (1)')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('接受')).toBeInTheDocument();
      expect(screen.getByText('拒绝')).toBeInTheDocument();
    });
  });

  it('4. 显示已发送的好友请求', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('已发送的请求 (1)')).toBeInTheDocument();
      expect(screen.getByText('David')).toBeInTheDocument();
      expect(screen.getByText('等待对方确认')).toBeInTheDocument();
      expect(screen.getByText('撤回')).toBeInTheDocument();
    });
  });

  it('5. 点击 "查看知识图谱" 打开 FriendGraphView', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Click the first "查看知识图谱" button
    const graphLinks = screen.getAllByText('查看知识图谱');
    fireEvent.click(graphLinks[0]);

    await waitFor(() => {
      expect(screen.getByTestId('friend-graph-view')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice 的知识图谱')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByTestId('graph-close-btn'));
    expect(screen.queryByTestId('friend-graph-view')).not.toBeInTheDocument();
  });

  it('6. 点击 "查看浏览趋势" 打开 FriendTrendView', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const trendBtns = screen.getAllByText('查看浏览趋势');
    fireEvent.click(trendBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('friend-trend-view')).toBeInTheDocument();
    });
    expect(screen.getByText('Alice 的浏览趋势')).toBeInTheDocument();

    // Close
    fireEvent.click(screen.getByTestId('trend-close-btn'));
    expect(screen.queryByTestId('friend-trend-view')).not.toBeInTheDocument();
  });

  it('7. "添加好友" 按钮打开搜索模态框', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('社交发现')).toBeInTheDocument();
    });

    // Modal should NOT be open initially (no modal header)
    const addBtn = screen.getByText('添加好友');
    fireEvent.click(addBtn);

    await waitFor(() => {
      // Modal should now show search input
      expect(screen.getByPlaceholderText('搜索用户名...')).toBeInTheDocument();
    });
  });

  it('8. 好友请求可收起/展开', async () => {
    mockSocialApi();
    render(<Social />);

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    // Click to collapse received requests
    fireEvent.click(screen.getByText('好友请求 (1)'));
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByText('好友请求 (1)'));
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// ProfilePage Tests
// ===========================================================================

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    global.fetch = vi.fn();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. 加载中显示 spinner', () => {
    // Don't resolve fetch so loading persists
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
  });

  it('2. 加载完成后显示个人资料页面', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    // Should show avatar section
    // No avatarUrl so shows initial letter
    expect(screen.getByText('A')).toBeInTheDocument();

    // Should show username
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('3. 显示用户名和邮箱输入框并预填值', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
      expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
    });

    const usernameInput = screen.getByDisplayValue('Alice');
    const emailInput = screen.getByDisplayValue('alice@example.com');

    expect(usernameInput).toHaveAttribute('type', 'text');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('4. "Save Changes" 按钮调用 API 保存资料', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });

    // Change username
    const usernameInput = screen.getByDisplayValue('Alice');
    fireEvent.change(usernameInput, { target: { value: 'AliceUpdated' } });

    // Mock the save response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockUserProfile, username: 'AliceUpdated' }),
    });

    // Click save
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      // Should call fetch with PUT method
      const calls = global.fetch.mock.calls;
      const putCall = calls.find(
        (c) => c[1] && c[1].method === 'PUT' && c[0].includes('/api/user/profile'),
      );
      expect(putCall).toBeTruthy();
    });
  });

  it('5. 保存成功后显示成功消息', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...mockUserProfile, username: 'AliceUpdated' }),
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
  });

  it('6. 保存失败时显示错误消息', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });

    // Mock save failure
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Username already exists'),
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(screen.getByText('Username already exists')).toBeInTheDocument();
    });
  });

  it('7. "Log Out" 按钮清除会话并导航到登录页', async () => {
    sessionStorage.setItem('token', 'test-token');
    sessionStorage.setItem('username', 'Alice');
    sessionStorage.setItem('avatarUrl', 'https://example.com/avatar.png');

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Log Out')).toBeInTheDocument();
    });

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    mockUseNavigate.mockClear();

    fireEvent.click(screen.getByText('Log Out'));

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('username')).toBeNull();
    expect(sessionStorage.getItem('avatarUrl')).toBeNull();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'avatarChanged' }));
    expect(mockUseNavigate).toHaveBeenCalledWith('/login');

    dispatchSpy.mockRestore();
  });

  it('8. 显示用户自画像区域', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUserProfile),
    });
    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('用户自画像')).toBeInTheDocument();
    });

    expect(screen.getByText('保存自画像')).toBeInTheDocument();
    const textarea = document.querySelector('.portrait-textarea');
    expect(textarea).toBeInTheDocument();
  });
});
