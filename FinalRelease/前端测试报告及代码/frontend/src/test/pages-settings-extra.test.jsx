import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Mocks
// ===========================================================================

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

vi.mock('../components/Toast/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
  ToastProvider: ({ children }) => children,
}));

vi.mock('../components/ConfirmModal/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, danger }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button data-testid="confirm-btn" onClick={() => { onConfirm(); onClose(); }}>
          {confirmText || '确定'}
        </button>
        <button data-testid="cancel-btn" onClick={onClose}>
          {cancelText || '取消'}
        </button>
      </div>
    ) : null,
}));

vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className, ...props }) =>
    React.createElement('div', { className: `glass-card ${className || ''}`, ...props }, children),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size, level, includeMargin }) =>
    React.createElement('div', { 'data-testid': 'qr-code-svg', 'data-value': value }, 'QR Code'),
}));

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

vi.mock('lucide-react', () => {
  const icons = [
    'AlertTriangle', 'ExternalLink', 'X', 'RefreshCw', 'Tag',
    'Clock', 'PlayCircle', 'FileText', 'Mic', 'ArrowUpRight',
    'Heart', 'Star', 'Sparkles', 'CheckCircle', 'AlertCircle',
    'Quote', 'Check', 'Loader',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  mock.default = ({ size, ...props }) =>
    React.createElement('span', { ...props, 'data-testid': 'icon-Quote' }, 'Quote');
  return mock;
});

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { Settings } from '../pages/Settings/Settings';
import { settingsApi, crawlApi, aiConfigApi } from '../utils/api';

// ===========================================================================
// Helpers
// ===========================================================================

const defaultPlatformsData = {
  platforms: [
    { key: 'bilibili', connected: false, desc: '未连接' },
    { key: 'zhihu', connected: false, desc: '未连接' },
    { key: 'xiaohongshu', connected: false, desc: '未连接' },
    { key: 'github', connected: false, desc: '未连接' },
  ],
};

function setupMocks(overrides = {}) {
  const {
    platformsData = defaultPlatformsData,
    privacyData = { publicGraph: false },
  } = overrides;

  settingsApi.getPlatforms.mockResolvedValue(platformsData);
  settingsApi.getPrivacy.mockResolvedValue(privacyData);
  settingsApi.updatePrivacy.mockResolvedValue({});
  settingsApi.saveCredential.mockResolvedValue({});
  settingsApi.deleteCredential.mockResolvedValue({});
  settingsApi.clearCredentialOnly.mockResolvedValue({});

  aiConfigApi.getConfig.mockRejectedValue(new Error('No config'));
  aiConfigApi.saveConfig.mockResolvedValue({});
  aiConfigApi.testConfig.mockResolvedValue({ message: '连接成功' });
}

// ===========================================================================
// Tests (grouped: non-fake-timer tests first, fake-timer tests last)
// ===========================================================================

describe('Settings Page - Extra Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (window._bilibiliPollTimer) {
      clearInterval(window._bilibiliPollTimer);
      window._bilibiliPollTimer = null;
    }
    if (window._zhihuPollTimer) {
      clearInterval(window._zhihuPollTimer);
      window._zhihuPollTimer = null;
    }
  });

  // =======================================================================
  // GROUP A: Non-timer tests (use real timers)
  // =======================================================================

  // 1. Github connect shows prompt with correct title and placeholder
  it('Github connect shows prompt with correct title and placeholder', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置 GitHub 访问令牌')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('ghp_...')).toBeInTheDocument();
    expect(screen.getByText(/Personal Access Token/)).toBeInTheDocument();
  });

  // 2. Xiaohongshu connect (via reconnect on connected) shows Cookie prompt
  it('Xiaohongshu connect shows prompt with Cookie description', async () => {
    const xhsConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: false, desc: '未连接' },
        { key: 'xiaohongshu', connected: true, desc: '已连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: xhsConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const xhsItem = screen.getByText('小红书').closest('.platform-item');
    fireEvent.click(xhsItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置小红书 Cookie')).toBeInTheDocument();
    });
    expect(screen.getByText(/xiaohongshu\.com/)).toBeInTheDocument();
    expect(screen.getByText(/document\.cookie/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('a1=...; webId=...')).toBeInTheDocument();
  });

  // 3. Zhihu connect (via reconnect on connected) shows Cookie prompt
  it('Zhihu connect shows prompt with Cookie description', async () => {
    const zhihuConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: zhihuConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    fireEvent.click(zhihuItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置知乎 Cookie')).toBeInTheDocument();
    });
    expect(screen.getByText(/z_c0=/)).toBeInTheDocument();
    expect(screen.getByText(/zhihu\.com/)).toBeInTheDocument();
    expect(screen.getByText(/document\.cookie/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('z_c0=...; d_c0=...')).toBeInTheDocument();
  });

  // 4. Submit prompt with non-empty credential calls saveCredential (Xiaohongshu)
  it('submit prompt with non-empty xiaohongshu credential calls saveCredential', async () => {
    const { location: oldLocation } = window;
    delete window.location;
    window.location = { href: '' };

    const xhsConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: false, desc: '未连接' },
        { key: 'xiaohongshu', connected: true, desc: '已连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: xhsConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const xhsItem = screen.getByText('小红书').closest('.platform-item');
    fireEvent.click(xhsItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置小红书 Cookie')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('a1=...; webId=...'), {
      target: { value: 'a1=test123; webId=test456' },
    });
    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(settingsApi.saveCredential).toHaveBeenCalledWith('xiaohongshu', 'a1=test123; webId=test456');
      expect(crawlApi.trigger).toHaveBeenCalledWith('xiaohongshu');
      expect(window.location.href).toBe('/inbox');
    });

    window.location = oldLocation;
  });

  // 5. Submit prompt for xiaohongshu empty credential
  it('submit empty xiaohongshu credential saves with empty string', async () => {
    const { location: oldLocation } = window;
    delete window.location;
    window.location = { href: '' };

    const xhsConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: false, desc: '未连接' },
        { key: 'xiaohongshu', connected: true, desc: '已连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: xhsConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const xhsItem = screen.getByText('小红书').closest('.platform-item');
    fireEvent.click(xhsItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置小红书 Cookie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(settingsApi.saveCredential).toHaveBeenCalledWith('xiaohongshu', '');
    });

    window.location = oldLocation;
  });

  // 6. Zhihu credential submit triggers crawl
  it('zhihu credential submit triggers crawl and redirects', async () => {
    const { location: oldLocation } = window;
    delete window.location;
    window.location = { href: '' };

    const zhihuConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: zhihuConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    fireEvent.click(zhihuItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置知乎 Cookie')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('z_c0=...; d_c0=...'), {
      target: { value: 'z_c0=test123; d_c0=test456' },
    });
    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(settingsApi.saveCredential).toHaveBeenCalledWith('zhihu', 'z_c0=test123; d_c0=test456');
      expect(crawlApi.trigger).toHaveBeenCalledWith('zhihu');
      expect(window.location.href).toBe('/inbox');
    });

    window.location = oldLocation;
  });

  // 7. Provider change switches models correctly
  it('provider change to google switches to gemini-pro model', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const providerSelect = screen.getByLabelText('供应商');
    const modelSelect = screen.getByLabelText('模型');

    fireEvent.change(providerSelect, { target: { value: 'google' } });
    expect(providerSelect.value).toBe('google');
    expect(modelSelect.value).toBe('gemini-pro');
  });

  it('provider change to qwen switches to first qwen model', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const providerSelect = screen.getByLabelText('供应商');
    const modelSelect = screen.getByLabelText('模型');

    fireEvent.change(providerSelect, { target: { value: 'qwen' } });
    expect(providerSelect.value).toBe('qwen');
    expect(modelSelect.value).toBe('qwen-plus');
  });

  it('model change updates selectedModel state', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const modelSelect = screen.getByLabelText('模型');
    expect(modelSelect.value).toBe('gpt-4');
    fireEvent.change(modelSelect, { target: { value: 'gpt-4-turbo' } });
    expect(modelSelect.value).toBe('gpt-4-turbo');
  });

  // 8. Custom provider shows custom fields
  it('custom provider shows model name and API endpoint input fields', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const providerSelect = screen.getByLabelText('供应商');
    fireEvent.change(providerSelect, { target: { value: 'custom' } });

    await waitFor(() => {
      expect(screen.getByText('模型名称')).toBeInTheDocument();
      expect(screen.getByText('API 端点')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('例如：gpt-4-custom')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：https://api.openai.com/v1/chat/completions')).toBeInTheDocument();
  });

  // 9. Custom provider save sends custom fields
  it('custom provider save includes custom model name, endpoint, and api key', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 'custom' } });

    await waitFor(() => { expect(screen.getByText('模型名称')).toBeInTheDocument(); });

    fireEvent.change(screen.getByPlaceholderText('例如：gpt-4-custom'), { target: { value: 'my-llm-model' } });
    fireEvent.change(screen.getByPlaceholderText('例如：https://api.openai.com/v1/chat/completions'), {
      target: { value: 'https://myapi.example.com/v1/chat' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入您的 API Key'), { target: { value: 'sk-custom-key-789' } });

    fireEvent.click(screen.getByText('保存配置'));

    await waitFor(() => {
      expect(aiConfigApi.saveConfig).toHaveBeenCalledWith({
        modelType: 'CUSTOM',
        apiKey: 'sk-custom-key-789',
        apiEndpoint: 'https://myapi.example.com/v1/chat',
        customModelName: 'my-llm-model',
      });
    });
  });

  // 10. Existing API key shows placeholder with masked hint
  it('existing API key shows masked placeholder and hint text', async () => {
    aiConfigApi.getConfig.mockResolvedValue({
      modelType: 'GPT_4',
      apiKey: 'sk-masked-key-12345',
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      customModelName: 'gpt-4',
    });

    render(<Settings />);
    await waitFor(() => { expect(aiConfigApi.getConfig).toHaveBeenCalled(); });

    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText(/已存储:/);
      expect(apiKeyInput).toBeInTheDocument();
      expect(apiKeyInput.placeholder).toContain('sk-masked-key-12345');
    });
    expect(screen.getByText('留空表示保持原有 API Key 不变，输入新值将覆盖原有配置')).toBeInTheDocument();
  });

  // 11. Test config shows loading "测试中..." state
  it('test config shows loading "测试中..." state and button is disabled', async () => {
    let resolveTest;
    const testPromise = new Promise((resolve) => { resolveTest = resolve; });
    aiConfigApi.testConfig.mockReturnValue(testPromise);

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('测试连接'));

    await waitFor(() => {
      expect(screen.getByText('测试中...')).toBeInTheDocument();
    });
    expect(screen.getByText('测试中...').closest('button')).toBeDisabled();

    resolveTest({ message: '连接成功' });
    await waitFor(() => {
      expect(screen.getByText('测试连接')).toBeInTheDocument();
    });
  });

  // 12. Test config failure shows "连接失败"
  it('test config failure without message shows "连接失败"', async () => {
    aiConfigApi.testConfig.mockRejectedValue(new Error());

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('测试连接'));

    await waitFor(() => {
      expect(screen.getByText('连接失败')).toBeInTheDocument();
    });
  });

  // 13. Clear legacy credential confirmation
  it('clear legacy credential button shows confirm modal and confirms action', async () => {
    const connectedData = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: connectedData });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const clearBtn = document.querySelector('.clear-credential-btn');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: '清除旧 Cookie' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(settingsApi.clearCredentialOnly).toHaveBeenCalledWith('zhihu');
    });
  });

  // 14. Disconnect confirmation cancel
  it('disconnect confirmation cancel does not call deleteCredential', async () => {
    const connectedData = {
      platforms: [
        { key: 'bilibili', connected: true, desc: '已连接' },
        { key: 'zhihu', connected: false, desc: '未连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: connectedData });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    });
    expect(settingsApi.deleteCredential).not.toHaveBeenCalled();
  });

  // 15. Platform description text for browser capture platforms
  it('browser capture platforms show description about browser extension', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    expect(zhihuItem.querySelector('.platform-info p').textContent).toContain('推荐');

    const xhsItem = screen.getByText('小红书').closest('.platform-item');
    expect(xhsItem.querySelector('.platform-info p').textContent).toContain('推荐');

    expect(screen.getByText(/知乎和小红书推荐使用浏览器扩展/)).toBeInTheDocument();
  });

  it('connected browser capture platform shows legacy cookie description', async () => {
    const connectedData = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: connectedData });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    expect(screen.getByText(/旧 Cookie 已保留/)).toBeInTheDocument();
  });

  // 16. Save AI config success/error states
  it('save AI config shows success button text "✓ 已保存"', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('保存配置'));

    await waitFor(() => {
      expect(screen.getByText('✓ 已保存')).toBeInTheDocument();
    });
  });

  it('save AI config error shows failure message', async () => {
    aiConfigApi.saveConfig.mockRejectedValue(new Error('网络异常'));

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('保存配置'));

    await waitFor(() => {
      expect(screen.getByText('配置保存失败，请重试')).toBeInTheDocument();
    });
  });

  // 17. Privacy toggle disabled during saving
  it('privacy toggle is disabled while saving is in progress', async () => {
    let resolvePrivacy;
    const privacyPromise = new Promise((resolve) => { resolvePrivacy = resolve; });
    settingsApi.updatePrivacy.mockReturnValue(privacyPromise);

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPrivacy).toHaveBeenCalled(); });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox).toBeDisabled();
    });

    resolvePrivacy({});
    await waitFor(() => {
      expect(checkbox).not.toBeDisabled();
    });
  });

  // 18. Existing AI config with DEEPSEEK provider
  it('loads AI config for deepseek provider with existing apiKey', async () => {
    aiConfigApi.getConfig.mockResolvedValue({
      modelType: 'DEEPSEEK',
      apiKey: 'sk-deepseek-existing',
      apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
      customModelName: 'deepseek-chat',
    });

    render(<Settings />);
    await waitFor(() => { expect(aiConfigApi.getConfig).toHaveBeenCalled(); });

    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText(/已存储:/);
      expect(apiKeyInput.placeholder).toContain('sk-deepseek-existing');
    });
  });

  // 19. Provider change resets saveStatus
  it('provider change clears save status', async () => {
    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    fireEvent.click(screen.getByText('保存配置'));
    await waitFor(() => {
      expect(screen.getByText('✓ 已保存')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('供应商'), { target: { value: 'anthropic' } });

    await waitFor(() => {
      expect(screen.getByText('保存配置')).toBeInTheDocument();
    });
  });

  // 20. Connected zhihu "管理旧凭据" opens prompt with QR mention
  it('connected zhihu "管理旧凭据" opens cookie prompt modal', async () => {
    const zhihuConnected = {
      platforms: [
        { key: 'bilibili', connected: false, desc: '未连接' },
        { key: 'zhihu', connected: true, desc: '已连接' },
        { key: 'xiaohongshu', connected: false, desc: '未连接' },
        { key: 'github', connected: false, desc: '未连接' },
      ],
    };
    setupMocks({ platformsData: zhihuConnected });

    render(<Settings />);
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    fireEvent.click(zhihuItem.querySelector('.reconnect-btn'));

    await waitFor(() => {
      expect(screen.getByText('配置知乎 Cookie')).toBeInTheDocument();
    });
    expect(screen.getByText(/也可使用顶部的「知乎扫码登录」/)).toBeInTheDocument();
  });

  // =======================================================================
  // GROUP B: Fake-timer tests (QR polling — must be last)
  // =======================================================================

  it('bilibili QR poll reaches max retries and shows expired message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key-max',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    settingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 0, message: '等待扫码' });

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });

    for (let i = 0; i < 61; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    await waitFor(() => {
      expect(screen.getByText('二维码已过期，请重试')).toBeInTheDocument();
    });
    expect(settingsApi.pollBilibiliQrcode).toHaveBeenCalledTimes(60);
  });

  it('bilibili QR poll status=2 stops polling immediately', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key-expired',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    settingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 2, message: '二维码已过期' });

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(settingsApi.pollBilibiliQrcode).toHaveBeenCalledTimes(1);
  });

  it('bilibili QR poll error is caught gracefully without crashing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key-err',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    settingsApi.pollBilibiliQrcode.mockRejectedValue(new Error('网络波动'));

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });

    for (let i = 0; i < 3; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }

    expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
  });

  it('bilibili QR modal shows initial "请使用 B 站 App 扫描二维码" message', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key-init',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    settingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 0, message: '等待扫码' });

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('请使用 B 站 App 扫描二维码')).toBeInTheDocument();
    });
  });

  it('bilibili QR modal can be closed via overlay click when not polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key-overlay',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    settingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 2, message: '二维码已过期' });

    render(<Settings />);
    await act(async () => { await vi.runAllTimersAsync(); });
    await waitFor(() => { expect(settingsApi.getPlatforms).toHaveBeenCalled(); });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    const overlay = screen.getByText('B 站扫码登录').closest('.qr-modal-overlay');
    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByText('B 站扫码登录')).not.toBeInTheDocument();
    });
  });
});
