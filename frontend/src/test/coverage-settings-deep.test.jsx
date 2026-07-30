import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Hoisted mocks (must be before vi.mock calls)
// ===========================================================================

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ===========================================================================
// Module-level mocks
// ===========================================================================

// --- react-router-dom ---
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
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
  settingsApi: {
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
  crawlApi: { trigger: vi.fn().mockResolvedValue({ status: 'ok' }) },
  aiConfigApi: {
    getConfig: vi.fn().mockRejectedValue(new Error('No config')),
    saveConfig: vi.fn().mockResolvedValue({}),
    testConfig: vi.fn().mockResolvedValue({ message: '连接成功' }),
  },
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

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Settings } from '../pages/Settings/Settings';
import { settingsApi, crawlApi, aiConfigApi } from '../utils/api';

// ===========================================================================
// Test Data
// ===========================================================================

const defaultPlatformsData = {
  platforms: [
    { key: 'bilibili', connected: false, desc: '未连接' },
    { key: 'zhihu', connected: false, desc: '未连接' },
    { key: 'xiaohongshu', connected: false, desc: '未连接' },
    { key: 'github', connected: false, desc: '未连接' },
  ],
};

const bilibiliConnectedData = {
  platforms: [
    { key: 'bilibili', connected: true, desc: '已连接' },
    { key: 'zhihu', connected: false, desc: '未连接' },
    { key: 'xiaohongshu', connected: false, desc: '未连接' },
    { key: 'github', connected: false, desc: '未连接' },
  ],
};

const zhihuConnectedData = {
  platforms: [
    { key: 'bilibili', connected: false, desc: '未连接' },
    { key: 'zhihu', connected: true, desc: '已连接' },
    { key: 'xiaohongshu', connected: false, desc: '未连接' },
    { key: 'github', connected: false, desc: '未连接' },
  ],
};

// ===========================================================================
// Helpers
// ===========================================================================

function setupDefaultMocks() {
  settingsApi.getPlatforms.mockResolvedValue(defaultPlatformsData);
  settingsApi.getPrivacy.mockResolvedValue({ publicGraph: false });
  settingsApi.updatePrivacy.mockResolvedValue({});
  settingsApi.saveCredential.mockResolvedValue({});
  settingsApi.deleteCredential.mockResolvedValue({});
  settingsApi.clearCredentialOnly.mockResolvedValue({});

  aiConfigApi.getConfig.mockRejectedValue(new Error('No config'));
  aiConfigApi.saveConfig.mockResolvedValue({});
  aiConfigApi.testConfig.mockResolvedValue({ message: '连接成功' });
}

function clearPollTimers() {
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
// Tests
// ===========================================================================

describe('Settings — Deep Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    clearPollTimers();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. handleDisconnect → confirm → deleteCredential → refreshPlatformStatus
  //    (covers lines 566-583 happy path)
  // ─────────────────────────────────────────────────────────────────────────
  it('disconnect confirm flow calls deleteCredential and refreshes platform status', async () => {
    settingsApi.getPlatforms.mockResolvedValue(bilibiliConnectedData);

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Click disconnect button on Bilibili
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    // Confirm modal appears
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('断开平台连接')).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByTestId('confirm-btn'));

    // Verify deleteCredential was called
    await waitFor(() => {
      expect(settingsApi.deleteCredential).toHaveBeenCalledWith('bilibili');
    });

    // Verify refreshPlatformStatus was triggered (getPlatforms called again)
    expect(settingsApi.getPlatforms).toHaveBeenCalledTimes(2);

    // Toast.error should NOT be called on happy path
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1b. handleDisconnect error path — deleteCredential rejects
  //     (covers line 579: toast.error in catch block)
  // ─────────────────────────────────────────────────────────────────────────
  it('disconnect confirm flow shows error toast when deleteCredential fails', async () => {
    settingsApi.getPlatforms.mockResolvedValue(bilibiliConnectedData);
    settingsApi.deleteCredential.mockRejectedValue(new Error('网络断开异常'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    // Verify toast.error was called with the error message
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('断开失败：网络断开异常');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. handleClearLegacyCredential flow
  //    (covers lines 591-608: clear legacy credential happy path)
  // ─────────────────────────────────────────────────────────────────────────
  it('clear legacy credential flow calls clearCredentialOnly and refreshes status', async () => {
    settingsApi.getPlatforms.mockResolvedValue(zhihuConnectedData);

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Find the clear credential button on Zhihu (browser capture + connected)
    const clearBtn = document.querySelector('.clear-credential-btn');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    // Confirm modal appears with title "清除旧 Cookie"
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: '清除旧 Cookie' })).toBeInTheDocument();

    // Click confirm
    fireEvent.click(screen.getByTestId('confirm-btn'));

    // Verify clearCredentialOnly was called
    await waitFor(() => {
      expect(settingsApi.clearCredentialOnly).toHaveBeenCalledWith('zhihu');
    });

    // Verify refreshPlatformStatus was triggered
    expect(settingsApi.getPlatforms).toHaveBeenCalledTimes(2);

    expect(mockToast.error).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2b. handleClearLegacyCredential error path
  //     (covers line 604: toast.error when clearCredentialOnly fails)
  // ─────────────────────────────────────────────────────────────────────────
  it('clear legacy credential shows error toast on failure', async () => {
    settingsApi.getPlatforms.mockResolvedValue(zhihuConnectedData);
    settingsApi.clearCredentialOnly.mockRejectedValue(new Error('清除失败'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const clearBtn = document.querySelector('.clear-credential-btn');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('清除旧凭据失败：清除失败');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Bilibili QR modal error path
  //    (covers lines 334-336: toast.error when getBilibiliQrcode rejects)
  // ─────────────────────────────────────────────────────────────────────────
  it('shows error toast when Bilibili QR code fetch fails', async () => {
    settingsApi.getBilibiliQrcode.mockRejectedValue(new Error('网络错误，无法获取二维码'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Click Bilibili connect button
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    // Verify toast.error was called
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('获取二维码失败：网络错误，无法获取二维码');
    });

    // QR modal should NOT open
    expect(screen.queryByText('B 站扫码登录')).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. submitPrompt error path
  //    (covers lines 560-563: toast.error when saveCredential rejects)
  // ─────────────────────────────────────────────────────────────────────────
  it('submit prompt shows error toast when saveCredential fails', async () => {
    settingsApi.saveCredential.mockRejectedValue(new Error('凭证保存失败'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Open GitHub prompt modal
    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置 GitHub 访问令牌')).toBeInTheDocument();
    });

    // Fill in a value
    fireEvent.change(screen.getByPlaceholderText('ghp_...'), {
      target: { value: 'ghp_test_token' },
    });

    // Submit
    fireEvent.click(screen.getByText('确定'));

    // Verify error toast
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('保存失败：凭证保存失败');
    });

    // saveCredential should have been called
    expect(settingsApi.saveCredential).toHaveBeenCalledWith('github', 'ghp_test_token');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Privacy toggle error — reverts on API failure
  //    (covers lines 150-155: catch block reverts toggle and shows error)
  // ─────────────────────────────────────────────────────────────────────────
  it('privacy toggle reverts and shows error toast when updatePrivacy fails', async () => {
    settingsApi.updatePrivacy.mockRejectedValue(new Error('隐私设置错误'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPrivacy).toHaveBeenCalled(); });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    // Click toggle
    fireEvent.click(checkbox);

    // Verify it temporarily was checked then reverted
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });

    // Verify toast.error was called
    expect(mockToast.error).toHaveBeenCalledWith('隐私设置保存失败: 隐私设置错误');

    // Verify updatePrivacy was called with true
    expect(settingsApi.updatePrivacy).toHaveBeenCalledWith(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. handleSaveConfig error
  //    (covers lines 288-290: saveStatus set to 'error')
  // ─────────────────────────────────────────────────────────────────────────
  it('save AI config failure sets saveStatus to error and shows error notification', async () => {
    aiConfigApi.saveConfig.mockRejectedValue(new Error('保存配置失败'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Click save config button
    fireEvent.click(screen.getByText('保存配置'));

    // Verify error notification appears
    await waitFor(() => {
      expect(screen.getByText('配置保存失败，请重试')).toBeInTheDocument();
    });

    // Verify saveConfig was called
    expect(aiConfigApi.saveConfig).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. handleTestConfig error
  //    (covers lines 314-316: testResult shows error)
  // ─────────────────────────────────────────────────────────────────────────
  it('test AI config failure shows error message in testResult', async () => {
    aiConfigApi.testConfig.mockRejectedValue(new Error('API 连接超时'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    // Click test config button
    fireEvent.click(screen.getByText('测试连接'));

    // Verify error message appears in the notification
    await waitFor(() => {
      expect(screen.getByText('API 连接超时')).toBeInTheDocument();
    });

    // Verify testConfig was called
    expect(aiConfigApi.testConfig).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Refresh platform status error
  //    (covers lines 187-189: catch block when getPlatforms fails)
  // ─────────────────────────────────────────────────────────────────────────
  it('refreshPlatformStatus logs warning when getPlatforms fails after disconnect', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First call succeeds (initial load), second call fails (refresh)
    settingsApi.getPlatforms
      .mockResolvedValueOnce(bilibiliConnectedData)
      .mockRejectedValueOnce(new Error('网络刷新失败'));

    settingsApi.deleteCredential.mockResolvedValue({});

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalledTimes(1); });

    // Click disconnect
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    // Confirm disconnect → triggers refreshPlatformStatus → getPlatforms fails
    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith('刷新平台状态失败:', '网络刷新失败');
    });

    // deleteCredential should still have been called
    expect(settingsApi.deleteCredential).toHaveBeenCalledWith('bilibili');

    consoleWarnSpy.mockRestore();
  });
});
