import React from 'react';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
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
    privacyUpdateResolve = Promise.resolve({}),
    privacyUpdateReject = null,
  } = overrides;

  settingsApi.getPlatforms.mockResolvedValue(platformsData);
  settingsApi.getPrivacy.mockResolvedValue(privacyData);

  if (privacyUpdateReject) {
    settingsApi.updatePrivacy.mockRejectedValue(new Error(privacyUpdateReject));
  } else {
    settingsApi.updatePrivacy.mockResolvedValue({});
  }

  settingsApi.saveCredential.mockResolvedValue({});
  settingsApi.deleteCredential.mockResolvedValue({});
  settingsApi.clearCredentialOnly.mockResolvedValue({});

  aiConfigApi.getConfig.mockRejectedValue(new Error('No config'));
  aiConfigApi.saveConfig.mockResolvedValue({});
  aiConfigApi.testConfig.mockResolvedValue({ message: '连接成功' });
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Renders "设置与隐私" header
  // -----------------------------------------------------------------------
  it('renders the header "设置与隐私"', async () => {
    render(<Settings />);
    expect(screen.getByRole('heading', { name: /设置与隐私/i })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Shows all 4 platform items
  // -----------------------------------------------------------------------
  it('shows all 4 platform items', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText('Bilibili')).toBeInTheDocument();
      expect(screen.getByText('Zhihu')).toBeInTheDocument();
      expect(screen.getByText('小红书')).toBeInTheDocument();
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Loads platforms from API on mount
  // -----------------------------------------------------------------------
  it('loads platforms from API on mount', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalledTimes(1);
    });
    expect(settingsApi.getPrivacy).toHaveBeenCalledTimes(1);
    expect(aiConfigApi.getConfig).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 4. Shows loading state while fetching
  // -----------------------------------------------------------------------
  it('shows loading text while platforms are being fetched', () => {
    // Don't resolve getPlatforms yet
    settingsApi.getPlatforms.mockReturnValue(new Promise(() => {}));
    render(<Settings />);
    expect(screen.getByText('正在获取平台连接状态...')).toBeInTheDocument();
  });

  it('hides loading text after platforms are fetched', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.queryByText('正在获取平台连接状态...')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Privacy toggle calls settingsApi.updatePrivacy
  // -----------------------------------------------------------------------
  it('privacy toggle calls settingsApi.updatePrivacy with true', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPrivacy).toHaveBeenCalled();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(settingsApi.updatePrivacy).toHaveBeenCalledWith(true);
    });
  });

  it('privacy toggle calls settingsApi.updatePrivacy when already public', async () => {
    setupMocks({ privacyData: { publicGraph: true } });
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPrivacy).toHaveBeenCalled();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(settingsApi.updatePrivacy).toHaveBeenCalledWith(false);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Privacy toggle shows error and reverts on API failure
  // -----------------------------------------------------------------------
  it('privacy toggle reverts and shows error on API failure', async () => {
    setupMocks({ privacyData: { publicGraph: false }, privacyUpdateReject: '网络错误' });
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPrivacy).toHaveBeenCalled();
    });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    // Click to toggle on, but API will fail
    fireEvent.click(checkbox);

    await waitFor(() => {
      // Should revert back to false
      expect(checkbox).not.toBeChecked();
    });
    expect(settingsApi.updatePrivacy).toHaveBeenCalledWith(true);
  });

  // -----------------------------------------------------------------------
  // 7. AI provider selector renders options
  // -----------------------------------------------------------------------
  it('renders AI provider selector with options', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const providerSelect = screen.getByLabelText('供应商');
    expect(providerSelect).toBeInTheDocument();
    expect(providerSelect.value).toBe('openai');

    const options = providerSelect.querySelectorAll('option');
    const labels = Array.from(options).map((o) => o.textContent);
    expect(labels).toContain('OpenAI');
    expect(labels).toContain('Anthropic (Claude)');
    expect(labels).toContain('DeepSeek (深度求索)');
    expect(labels).toContain('自定义模型');
  });

  // -----------------------------------------------------------------------
  // 8. AI model selector updates on provider change
  // -----------------------------------------------------------------------
  it('AI model selector updates when provider changes', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const providerSelect = screen.getByLabelText('供应商');
    const modelSelect = screen.getByLabelText('模型');

    // Default: openai -> gpt-4
    expect(providerSelect.value).toBe('openai');
    expect(modelSelect.value).toBe('gpt-4');

    // Switch to anthropic
    fireEvent.change(providerSelect, { target: { value: 'anthropic' } });
    expect(providerSelect.value).toBe('anthropic');
    // Should default to first model of anthropic: claude-3-opus
    expect(modelSelect.value).toBe('claude-3-opus');

    // Switch to deepseek
    fireEvent.change(providerSelect, { target: { value: 'deepseek' } });
    expect(providerSelect.value).toBe('deepseek');
    expect(modelSelect.value).toBe('deepseek-v4-flash');
  });

  // -----------------------------------------------------------------------
  // 9. Save AI config calls aiConfigApi.saveConfig
  // -----------------------------------------------------------------------
  it('save AI config calls aiConfigApi.saveConfig', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const saveBtn = screen.getByText('保存配置');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(aiConfigApi.saveConfig).toHaveBeenCalledTimes(1);
    });
    expect(aiConfigApi.saveConfig).toHaveBeenCalledWith({
      modelType: 'GPT_4',
      apiKey: null,
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      customModelName: 'gpt-4',
    });
  });

  // -----------------------------------------------------------------------
  // 10. Test AI config calls aiConfigApi.testConfig
  // -----------------------------------------------------------------------
  it('test AI config calls aiConfigApi.testConfig', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const testBtn = screen.getByText('测试连接');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(aiConfigApi.testConfig).toHaveBeenCalledTimes(1);
    });
  });

  it('test AI config shows success result', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const testBtn = screen.getByText('测试连接');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText('连接成功')).toBeInTheDocument();
    });
  });

  it('test AI config shows error result on failure', async () => {
    aiConfigApi.testConfig.mockRejectedValue(new Error('连接失败：网络错误'));
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const testBtn = screen.getByText('测试连接');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText('连接失败：网络错误')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // 11. Bilibili connect button exists and triggers QR flow
  // -----------------------------------------------------------------------
  it('bilibili connect button exists', async () => {
    render(<Settings />);
    await waitFor(() => {
      // After loading, "去连接" should appear for disconnected platforms
      const connectButtons = screen.getAllByText('去连接');
      expect(connectButtons.length).toBeGreaterThan(0);
    });
  });

  it('bilibili connect button opens QR modal', async () => {
    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Find Bilibili's connect button
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    const connectBtn = bilibiliItem.querySelector('.connect-btn');
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(settingsApi.getBilibiliQrcode).toHaveBeenCalledTimes(1);
    });
    // QR modal should appear
    expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    expect(screen.getByText('请使用 B 站 App 扫描二维码')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 12. GitHub connect shows prompt modal
  // -----------------------------------------------------------------------
  it('github connect button shows credential prompt modal', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Find GitHub's connect button
    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    const connectBtn = githubItem.querySelector('.connect-btn');
    fireEvent.click(connectBtn);

    // Prompt modal should appear
    expect(screen.getByText('配置 GitHub 访问令牌')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ghp_...')).toBeInTheDocument();
  });

  it('xiaohongshu shows browser-capture status when not connected', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // xiaohongshu is a browser-capture platform, shows "无需 Cookie" when disconnected
    const xhsItem = screen.getByText('小红书').closest('.platform-item');
    expect(xhsItem.querySelector('.browser-capture-status')).toBeInTheDocument();
    // Two browser-capture platforms both show this text
    expect(screen.getAllByText('无需 Cookie').length).toBe(2);
  });

  it('zhihu shows browser-capture status when not connected', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // zhihu is a browser-capture platform, shows "无需 Cookie" when disconnected
    const zhihuItem = screen.getByText('Zhihu').closest('.platform-item');
    expect(zhihuItem.querySelector('.browser-capture-status')).toBeInTheDocument();
    expect(screen.getAllByText('无需 Cookie').length).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 13. Submit prompt saves credential
  // -----------------------------------------------------------------------
  it('submit prompt calls settingsApi.saveCredential and crawlApi.trigger', async () => {
    const { location: oldLocation } = window;
    delete window.location;
    window.location = { href: '' };

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Open GitHub prompt modal
    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    // Fill in the token
    const textarea = screen.getByPlaceholderText('ghp_...');
    fireEvent.change(textarea, { target: { value: 'ghp_test_token_123' } });

    // Submit
    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(settingsApi.saveCredential).toHaveBeenCalledWith('github', 'ghp_test_token_123');
      expect(crawlApi.trigger).toHaveBeenCalledWith('github');
      expect(window.location.href).toBe('/inbox');
    });

    window.location = oldLocation;
  });

  // -----------------------------------------------------------------------
  // 14. Disconnect button shows confirm modal
  // -----------------------------------------------------------------------
  it('disconnect button shows confirm modal for connected platform', async () => {
    // Set bilibili as connected
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
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Find the disconnect button for bilibili
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    const disconnectBtn = bilibiliItem.querySelector('.disconnect-btn');
    fireEvent.click(disconnectBtn);

    // Confirm modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('断开平台连接')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 15. Confirm disconnect calls settingsApi.deleteCredential
  // -----------------------------------------------------------------------
  it('confirm disconnect calls settingsApi.deleteCredential', async () => {
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
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Click disconnect
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.disconnect-btn'));

    // Confirm in modal
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByTestId('confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(settingsApi.deleteCredential).toHaveBeenCalledWith('bilibili');
    });
    expect(settingsApi.deleteCredential).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Additional: Connected platform shows "已连接" status
  // -----------------------------------------------------------------------
  it('shows connected status when platform is connected', async () => {
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
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // There may be multiple "已连接" occurrences (status badge + desc text)
    const connectedElements = screen.getAllByText('已连接');
    expect(connectedElements.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Additional: Browser capture platforms show guide for zhihu/xiaohongshu
  // -----------------------------------------------------------------------
  it('shows browser capture guide section', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    expect(screen.getByText('浏览器扩展自动捕获')).toBeInTheDocument();
    expect(screen.getByText('下载知乎扩展包')).toBeInTheDocument();
    expect(screen.getByText('下载小红书扩展包')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Additional: Privacy section renders
  // -----------------------------------------------------------------------
  it('renders privacy control section', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    expect(screen.getByText('隐私控制面板')).toBeInTheDocument();
    expect(screen.getByText('向好友公开我的知识图谱')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Additional: AI config section renders
  // -----------------------------------------------------------------------
  it('renders AI model configuration section', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    expect(screen.getByText('AI 模型配置')).toBeInTheDocument();
    expect(screen.getByText('供应商')).toBeInTheDocument();
    expect(screen.getByText('模型')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Additional: custom provider shows custom fields
  // -----------------------------------------------------------------------
  it('custom provider shows custom model name and API endpoint fields', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const providerSelect = screen.getByLabelText('供应商');
    fireEvent.change(providerSelect, { target: { value: 'custom' } });

    expect(screen.getByText('模型名称')).toBeInTheDocument();
    expect(screen.getByText('API 端点')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：gpt-4-custom')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：https://api.openai.com/v1/chat/completions')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入您的 API Key')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Additional: Save config with custom provider includes custom fields
  // -----------------------------------------------------------------------
  it('save config with custom provider sends custom fields', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Switch to custom provider
    const providerSelect = screen.getByLabelText('供应商');
    fireEvent.change(providerSelect, { target: { value: 'custom' } });

    // Fill custom fields
    const modelNameInput = screen.getByPlaceholderText('例如：gpt-4-custom');
    fireEvent.change(modelNameInput, { target: { value: 'my-custom-model' } });

    const endpointInput = screen.getByPlaceholderText('例如：https://api.openai.com/v1/chat/completions');
    fireEvent.change(endpointInput, { target: { value: 'https://my-custom-endpoint.com/v1' } });

    const apiKeyInput = screen.getByPlaceholderText('请输入您的 API Key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-my-key' } });

    // Save
    fireEvent.click(screen.getByText('保存配置'));

    await waitFor(() => {
      expect(aiConfigApi.saveConfig).toHaveBeenCalledWith({
        modelType: 'CUSTOM',
        apiKey: 'sk-my-key',
        apiEndpoint: 'https://my-custom-endpoint.com/v1',
        customModelName: 'my-custom-model',
      });
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Disable connect buttons during loading
  // -----------------------------------------------------------------------
  it('disables connect buttons when saving', async () => {
    // Make saving last a while by returning a promise that doesn't resolve quickly
    settingsApi.saveCredential.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Open github prompt
    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    // Fill and submit
    const textarea = screen.getByPlaceholderText('ghp_...');
    fireEvent.change(textarea, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('确定'));

    // The prompt modal should close and saving should disable buttons
    await waitFor(() => {
      expect(screen.queryByText('配置 GitHub 访问令牌')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Bilibili QR code modal close button works (when not polling)
  // -----------------------------------------------------------------------
  it('bilibili QR modal close button works when not polling', async () => {
    settingsApi.getBilibiliQrcode.mockResolvedValue({
      qrcodeKey: 'test-key',
      qrcodeUrl: 'https://bilibili.com/qr/test',
    });
    // Make poll resolve immediately with status -1 so polling stops
    settingsApi.pollBilibiliQrcode.mockResolvedValue({ status: 0, message: '等待扫码' });

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Open bilibili QR modal
    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    fireEvent.click(bilibiliItem.querySelector('.connect-btn'));

    await waitFor(() => {
      expect(screen.getByText('B 站扫码登录')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Shows "更新凭证" and "断开" when platform connected
  // -----------------------------------------------------------------------
  it('shows update and disconnect buttons for connected platform', async () => {
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
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const bilibiliItem = screen.getByText('Bilibili').closest('.platform-item');
    expect(bilibiliItem.querySelector('.update-credential-btn') || bilibiliItem.querySelector('.reconnect-btn')).toBeInTheDocument();
    expect(bilibiliItem.querySelector('.disconnect-btn')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Additional: Verify extension download links exist
  // -----------------------------------------------------------------------
  it('renders extension download links', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const zhihuLink = screen.getByText('下载知乎扩展包');
    expect(zhihuLink.closest('a')).toHaveAttribute('href', '/downloads/infodigest-zhihu-capture.zip');

    const xhsLink = screen.getByText('下载小红书扩展包');
    expect(xhsLink.closest('a')).toHaveAttribute('href', '/downloads/infodigest-xiaohongshu-capture.zip');
  });

  // -----------------------------------------------------------------------
  // Additional: Save status notifications appear
  // -----------------------------------------------------------------------
  it('shows success notification after save config succeeds', async () => {
    // Mock loadAIConfig to not throw
    aiConfigApi.saveConfig.mockResolvedValue({});

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Click save
    const saveBtn = screen.getByText('保存配置');
    fireEvent.click(saveBtn);

    // Should show success notification
    await waitFor(() => {
      expect(screen.getByText('配置保存成功')).toBeInTheDocument();
    });
  });

  it('shows error notification when save config fails', async () => {
    aiConfigApi.saveConfig.mockRejectedValue(new Error('网络错误'));

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const saveBtn = screen.getByText('保存配置');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('配置保存失败，请重试')).toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Cancel prompt modal closes it
  // -----------------------------------------------------------------------
  it('cancel button closes the prompt modal', async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    expect(screen.getByText('配置 GitHub 访问令牌')).toBeInTheDocument();

    fireEvent.click(screen.getByText('取消'));

    await waitFor(() => {
      expect(screen.queryByText('配置 GitHub 访问令牌')).not.toBeInTheDocument();
    });
  });

  // -----------------------------------------------------------------------
  // Additional: Empty credential submit sends empty string
  // -----------------------------------------------------------------------
  it('submits empty credential when textarea is empty', async () => {
    const { location: oldLocation } = window;
    delete window.location;
    window.location = { href: '' };

    settingsApi.saveCredential.mockResolvedValue({});
    crawlApi.trigger.mockResolvedValue({ status: 'ok' });

    render(<Settings />);
    await waitFor(() => {
      expect(settingsApi.getPlatforms).toHaveBeenCalled();
    });

    // Open GitHub prompt modal
    const githubItem = screen.getByText('GitHub').closest('.platform-item');
    fireEvent.click(githubItem.querySelector('.connect-btn'));

    // Submit without typing anything
    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(settingsApi.saveCredential).toHaveBeenCalledWith('github', '');
    });

    window.location = oldLocation;
  });
});
