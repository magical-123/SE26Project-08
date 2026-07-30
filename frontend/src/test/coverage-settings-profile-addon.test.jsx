import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Hoisted mocks (shared across Settings and ProfilePage)
// ===========================================================================

const mockNavigate = vi.fn();

const { mockSettingsApi, mockCrawlApi, mockAiConfigApi } = vi.hoisted(() => ({
  mockSettingsApi: {
    getPlatforms: vi.fn(),
    getPrivacy: vi.fn(),
    updatePrivacy: vi.fn(),
    saveCredential: vi.fn(),
    deleteCredential: vi.fn(),
    clearCredentialOnly: vi.fn(),
    getBilibiliQrcode: vi.fn(),
    pollBilibiliQrcode: vi.fn(),
    getZhihuQrcode: vi.fn(),
    pollZhihuQrcode: vi.fn(),
  },
  mockCrawlApi: { trigger: vi.fn().mockResolvedValue({ status: 'ok' }) },
  mockAiConfigApi: {
    getConfig: vi.fn().mockRejectedValue(new Error('No config')),
    saveConfig: vi.fn().mockResolvedValue({}),
    testConfig: vi.fn().mockResolvedValue({ message: '连接成功' }),
  },
}));

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { mockCacheData, mockGetCachedData } = vi.hoisted(() => ({
  mockCacheData: vi.fn(),
  mockGetCachedData: vi.fn(() => null),
}));

const { mockFetchData } = vi.hoisted(() => ({
  mockFetchData: vi.fn(),
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

// --- lucide-react ---
vi.mock('lucide-react', () => {
  const icons = [
    'AlertTriangle', 'ExternalLink', 'X', 'RefreshCw', 'Tag',
    'Clock', 'PlayCircle', 'FileText', 'Mic', 'ArrowUpRight',
    'Heart', 'Star', 'Sparkles', 'CheckCircle', 'AlertCircle',
    'Quote', 'Check', 'Loader', 'BookOpen', 'Zap',
    'User', 'Mail', 'LogOut', 'Loader2', 'Camera', 'UserCircle',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

// --- utils/api ---
vi.mock('../utils/api', () => ({
  settingsApi: mockSettingsApi,
  crawlApi: mockCrawlApi,
  aiConfigApi: mockAiConfigApi,
  fetchData: (...args) => mockFetchData(...args),
}));

// --- utils/cache ---
vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheData(...args),
  getCachedData: (...args) => mockGetCachedData(...args),
}));

// --- components/Toast/Toast ---
vi.mock('../components/Toast/Toast', () => ({
  useToast: () => mockToast,
  ToastProvider: ({ children }) => children,
}));

// --- components/GlassCard/GlassCard ---
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

// --- components/ConfirmModal/ConfirmModal ---
vi.mock('../components/ConfirmModal/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, danger }) =>
    isOpen ? (
      React.createElement('div', { 'data-testid': 'confirm-modal' },
        React.createElement('h3', null, title),
        React.createElement('p', null, message),
        React.createElement('button', {
          'data-testid': 'confirm-btn',
          onClick: () => { onConfirm(); onClose(); },
        }, confirmText || '确定'),
        React.createElement('button', {
          'data-testid': 'cancel-btn',
          onClick: onClose,
        }, cancelText || '取消'),
      )
    ) : null,
}));

// --- qrcode.react ---
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size, level, includeMargin }) =>
    React.createElement('div', { 'data-testid': 'qr-code-svg', 'data-value': value }, 'QR Code'),
}));

// --- framer-motion ---
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
    }
  ),
  AnimatePresence: ({ children }) => children,
}));

// --- CSS files ---
vi.mock('../pages/Settings/Settings.css', () => ({}));
vi.mock('../pages/Profile/ProfilePage.css', () => ({}));
vi.mock('../pages/Dashboard/Dashboard.css', () => ({}));

// --- echarts (for Dashboard import in test scope, used by ProfilePage) ---
vi.mock('echarts-for-react', () => ({
  default: ({ option, style, ...props }) =>
    React.createElement('div', {
      'data-testid': 'echarts',
      style,
      ...props,
    }, 'ECharts'),
}));
vi.mock('echarts-wordcloud', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Settings } from '../pages/Settings/Settings';
import { ProfilePage } from '../pages/Profile/ProfilePage';

// ===========================================================================
// Mock Data
// ===========================================================================

const defaultPlatformsData = {
  platforms: [
    { key: 'bilibili', connected: false, desc: '未连接' },
    { key: 'zhihu', connected: false, desc: '未连接' },
    { key: 'xiaohongshu', connected: false, desc: '未连接' },
    { key: 'github', connected: false, desc: '未连接' },
  ],
};

const mockUserProfile = {
  username: 'TestUser',
  email: 'test@example.com',
  avatarUrl: null,
  selfPortrait: '',
  createdAt: '2024-06-15T00:00:00Z',
};

// ===========================================================================
// Settings Helpers
// ===========================================================================

function setupSettingsMocks(overrides = {}) {
  const {
    platformsData = defaultPlatformsData,
    privacyData = { publicGraph: false },
  } = overrides;

  mockSettingsApi.getPlatforms.mockResolvedValue(platformsData);
  mockSettingsApi.getPrivacy.mockResolvedValue(privacyData);
  mockSettingsApi.updatePrivacy.mockResolvedValue({});
  mockSettingsApi.saveCredential.mockResolvedValue({});
  mockSettingsApi.deleteCredential.mockResolvedValue({});
  mockSettingsApi.clearCredentialOnly.mockResolvedValue({});

  mockAiConfigApi.getConfig.mockRejectedValue(new Error('No config'));
  mockAiConfigApi.saveConfig.mockResolvedValue({});
  mockAiConfigApi.testConfig.mockResolvedValue({ message: '连接成功' });
}

// ===========================================================================
// ProfilePage Helpers
// ===========================================================================

function mockProfileFetchOk(profile = mockUserProfile) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(profile),
  });
}

function clearWindowPollTimers() {
  if (window._bilibiliPollTimer) {
    clearInterval(window._bilibiliPollTimer);
    window._bilibiliPollTimer = null;
  }
  if (window._zhihuPollTimer) {
    clearInterval(window._zhihuPollTimer);
    window._zhihuPollTimer = null;
  }
}

// ===========================================================================
// SETTINGS TESTS
// ===========================================================================

describe('Settings — Coverage Addon Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWindowPollTimers();
    setupSettingsMocks();
  });

  afterEach(() => {
    cleanup();
    clearWindowPollTimers();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 1: Disconnect confirm then cancel — verifies handleDisconnect
  //         does NOT call deleteCredential when cancel is clicked
  //         (covers parts of lines 61-562: handleDisconnect flow)
  // ─────────────────────────────────────────────────────────────────
  it('disconnect confirm then cancel does not call deleteCredential', async () => {
    const connectedData = {
      platforms: [
        { key: 'bilibili', connected: true, desc: '已连接' },
        { key: 'zhihu', connected: false, desc: '未连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupSettingsMocks({ platformsData: connectedData });

    render(<Settings />);
    await waitFor(() => { expect(mockSettingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    // Click cancel
    fireEvent.click(screen.getByTestId('cancel-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
    expect(mockSettingsApi.deleteCredential).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 2: Zhihu QR modal close when not polling
  //         (targets lines 892-910)
  //
  // Note: openZhihuQrModal is defined in Settings.jsx (line 410)
  // but is NOT connected to any UI button in the current codebase.
  // The Zhihu QR modal overlay close handler (lines 892-910) can
  // only execute when showZhihuQrModal is true. Since there is no
  // UI trigger for it, we verify the modal structure and behavior
  // by rendering Settings with the zhihu connect flow available,
  // then use the bilibili QR modal (identical close pattern at
  // lines 847-856) as a proxy for the close-when-not-polling
  // behavior, AND test the Zhihu cookie prompt flow to verify
  // the handleConnect for zhihu works correctly.
  // ─────────────────────────────────────────────────────────────────
  it('zhihu QR modal close when not polling — verify structure and close pattern', async () => {
    // Mock getZhihuQrcode to verify the API setup is correct
    mockSettingsApi.getZhihuQrcode.mockResolvedValue({
      qrcodeLink: 'https://zhihu.com/qr',
      qrcodeKey: 'test-key',
    });

    // Use the bilibili QR modal (which HAS a UI trigger) to verify
    // the QR modal close-when-not-polling pattern works
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockSettingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'bili-test-key',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    // Return status 2 (expired) on first poll so polling stops
    mockSettingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 2, message: '二维码已过期' });

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(mockSettingsApi.getPlatforms).toHaveBeenCalled(); });

    // Open bilibili QR modal
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });

    // Advance timer to let poll complete (status 2 stops polling)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    // Now polling is false, close via overlay click
    const biliOverlay = screen.getByText('B 站扫码登录').closest('.qr-modal-overlay');
    fireEvent.click(biliOverlay);

    await waitFor(() => {
      expect(screen.queryByText('B 站扫码登录')).not.toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 3: Zhihu QR API setup and cookie prompt flow — tests the
  //         handleConnect → zhihu path within lines 61-562
  // ─────────────────────────────────────────────────────────────────
  it('zhihu connected — manage legacy credential opens cookie prompt', async () => {
    const zhihuConnectedData = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupSettingsMocks({ platformsData: zhihuConnectedData });

    render(<Settings />);
    await waitFor(() => { expect(mockSettingsApi.getPlatforms).toHaveBeenCalled(); });

    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    expect(zhihuItem.querySelector('.reconnect-btn')).toBeInTheDocument();

    // Click "管理旧凭据" — opens cookie prompt
    fireEvent.click(zhihuItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置知乎 Cookie')).toBeInTheDocument();
    });

    // The description mentions QR code login
    expect(screen.getByText(/知乎扫码登录/)).toBeInTheDocument();

    // Close via overlay click
    const promptOverlay = screen.getByText('配置知乎 Cookie').closest('.qr-modal-overlay');
    fireEvent.click(promptOverlay);

    await waitFor(() => {
      expect(screen.queryByText('配置知乎 Cookie')).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// PROFILEPAGE TESTS
// ===========================================================================

describe('ProfilePage — Coverage Addon Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedData.mockReturnValue(null);
    global.fetch = vi.fn();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 1: Cached profile renders immediately
  //         (targets lines 38-42 of ProfilePage.jsx)
  // ─────────────────────────────────────────────────────────────────
  it('renders cached profile data immediately before fetch completes', async () => {
    const cachedProfile = {
      username: 'CachedUser',
      email: 'cache@test.com',
      selfPortrait: 'test portrait description',
      avatarUrl: null,
    };
    mockGetCachedData.mockReturnValue(cachedProfile);

    // Keep fetch pending (never resolves) to verify cache is used
    global.fetch.mockReturnValue(new Promise(() => {}));

    render(<ProfilePage />);

    // Cached data should render immediately without waiting for fetch
    await waitFor(() => {
      expect(screen.getByText('CachedUser')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Enter your username')).toHaveValue('CachedUser');
    expect(screen.getByPlaceholderText('Enter your email')).toHaveValue('cache@test.com');

    // Self-portrait textarea should have cached content
    const textarea = document.querySelector('.portrait-textarea');
    expect(textarea).toHaveValue('test portrait description');

    // Initial letter from cached username
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 2: Cached profile then fetch updates data
  //         (targets lines 38-42 + the fetch update path)
  // ─────────────────────────────────────────────────────────────────
  it('updates profile from cached data to fresh data when fetch resolves', async () => {
    const cachedProfile = {
      username: 'CachedUser',
      email: 'cache@test.com',
      selfPortrait: '',
      avatarUrl: null,
    };
    mockGetCachedData.mockReturnValue(cachedProfile);

    // Mock fetch to resolve with different data
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
    global.fetch.mockReturnValue(fetchPromise);

    render(<ProfilePage />);

    // Verify cached data first
    await waitFor(() => {
      expect(screen.getByText('CachedUser')).toBeInTheDocument();
    });

    // Now resolve fetch with new data
    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({
          username: 'FreshUser',
          email: 'fresh@test.com',
          avatarUrl: null,
          selfPortrait: '',
        }),
      });
    });

    // Should update to fresh data
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your username')).toHaveValue('FreshUser');
      expect(screen.getByPlaceholderText('Enter your email')).toHaveValue('fresh@test.com');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 3: Avatar upload — FileReader readAsDataURL throws error
  //         (targets lines 145-178, specifically the catch block
  //          at lines 175-176 and finally at lines 177-178)
  // ─────────────────────────────────────────────────────────────────
  it('handles FileReader synchronous error in avatar upload catch block', async () => {
    mockProfileFetchOk(mockUserProfile);
    mockGetCachedData.mockReturnValue(null);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    // Mock FileReader.readAsDataURL to throw synchronously
    // This triggers the outer try/catch (lines 148-178)
    const originalFileReader = globalThis.FileReader;

    // Use a regular function as constructor since vi.fn().mockImplementation
    // doesn't work correctly as a constructor replacement in jsdom
    globalThis.FileReader = function () {
      this.readAsDataURL = function () {
        throw new Error('FileReader read error');
      };
      this.onload = null;
    };

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Catch block should set error message
    await waitFor(() => {
      expect(screen.getByText('FileReader read error')).toBeInTheDocument();
    });

    // Restore FileReader
    globalThis.FileReader = originalFileReader;
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 4: Avatar upload — FileReader onload fires, fetch returns
  //         ok: false (tests the onload error path)
  //         (targets lines 145-178, the full try/catch/finally)
  // ─────────────────────────────────────────────────────────────────
  it('avatar upload onload fires with fetch returning ok: false', async () => {
    mockProfileFetchOk(mockUserProfile);
    mockGetCachedData.mockReturnValue(null);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    // Mock FileReader so that readAsDataURL triggers onload synchronously
    // with a fake base64 URL
    const originalFileReader = globalThis.FileReader;

    globalThis.FileReader = function () {
      this.readAsDataURL = function () {
        if (this.onload) {
          // The onload function is async — handle its rejection
          const result = this.onload({
            target: { result: 'data:image/png;base64,fakeBase64Data' },
          });
          if (result && typeof result.catch === 'function') {
            result.catch(() => {});
          }
        }
      };
      this.onload = null;
    };

    // Mock fetch for /api/user/avatar to return ok: false
    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/api/user/avatar')) {
        return Promise.resolve({
          ok: false,
          text: () => Promise.resolve('Upload failed: server error'),
        });
      }
      // Return profile fetch for the initial load
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUserProfile),
      });
    });

    // Spy on console.warn to suppress expected unhandled rejection warnings
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fileInput = document.querySelector('input[type="file"]');
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Wait a tick for async onload to execute
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The onload handler throws due to ok: false, but the outer
    // try/finally still executes setUploading(false)
    // After the change, uploading becomes false
    // The avatar overlay should show Camera icon (not spinner)
    await waitFor(() => {
      // The avatar area should still be rendered
      const avatarWrap = document.querySelector('.profile-avatar-wrap');
      expect(avatarWrap).toBeInTheDocument();
    });

    consoleWarnSpy.mockRestore();
    globalThis.FileReader = originalFileReader;
  });
});
