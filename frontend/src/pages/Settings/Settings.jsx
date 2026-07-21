import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { settingsApi, crawlApi, aiConfigApi } from '../../utils/api';
import { QRCodeSVG } from 'qrcode.react';
import './Settings.css';

function defaultPlatforms() {
  return [
    { key: 'bilibili', name: 'Bilibili', connected: false, desc: '加载中...' },
    { key: 'zhihu', name: 'Zhihu', connected: false, desc: '加载中...' },
    { key: 'xiaohongshu', name: '小红书', connected: false, desc: '加载中...' },
    { key: 'github', name: 'GitHub', connected: false, desc: '加载中...' },
  ];
}

export function Settings() {
  const [platforms, setPlatforms] = useState(defaultPlatforms);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState({});

  // B 站二维码弹窗状态
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrOauthKey, setQrOauthKey] = useState('');
  const [qrStatus, setQrStatus] = useState(-1);
  const [qrMessage, setQrMessage] = useState('');
  const [qrPolling, setQrPolling] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPlatform, setQrPlatform] = useState('bilibili'); // bilibili | zhihu

  // 知乎二维码弹窗状态
  const [showZhihuQrModal, setShowZhihuQrModal] = useState(false);
  const [zhihuQrLink, setZhihuQrLink] = useState('');
  const [zhihuQrKey, setZhihuQrKey] = useState('');
  const [zhihuQrStatus, setZhihuQrStatus] = useState(-1);
  const [zhihuQrMessage, setZhihuQrMessage] = useState('');
  const [zhihuQrPolling, setZhihuQrPolling] = useState(false);
  const [zhihuQrLoading, setZhihuQrLoading] = useState(false);

  // 娱乐信息隐藏开关
  const [hideEntertainment, setHideEntertainment] = useState(false);
  const [togglingHide, setTogglingHide] = useState(false);

  // 自定义输入弹窗状态
  const [promptConfig, setPromptConfig] = useState(null);

  // AI 配置状态
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [customConfig, setCustomConfig] = useState({
    modelName: '',
    apiEndpoint: '',
    apiKey: ''
  });
  const [existingApiKey, setExistingApiKey] = useState(''); // 存储已有的屏蔽 API Key
  const [saveStatus, setSaveStatus] = useState(''); // 'success' | 'error' | ''
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // 页面加载时从后端获取真实平台连接状态
  useEffect(() => {
    let cancelled = false;
    settingsApi.getPlatforms()
      .then((data) => {
        if (cancelled) return;
        const statusMap = {};
        (data.platforms || []).forEach(p => { statusMap[p.key] = p; });
        setPlatforms(prev => prev.map(p => {
          const remote = statusMap[p.key];
          if (remote) return { ...p, connected: remote.connected, desc: remote.desc };
          return p;
        }));
        // 读取娱乐信息隐藏状态
        if (typeof data.hideEntertainment === 'boolean') {
          setHideEntertainment(data.hideEntertainment);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('获取平台状态失败:', err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 加载 AI 配置
  useEffect(() => {
    loadAIConfig();
  }, []);

  // 组件卸载时清理轮询定时器
  useEffect(() => {
    return () => {
      if (window._bilibiliPollTimer) {
        clearInterval(window._bilibiliPollTimer);
        window._bilibiliPollTimer = null;
      }
      if (window._zhihuPollTimer) {
        clearInterval(window._zhihuPollTimer);
        window._zhihuPollTimer = null;
      }
    };
  }, []);

  const refreshPlatformStatus = async () => {
    try {
      const data = await settingsApi.getPlatforms();
      const statusMap = {};
      (data.platforms || []).forEach(p => { statusMap[p.key] = p; });
      setPlatforms(prev => prev.map(p => {
        const remote = statusMap[p.key];
        if (remote) return { ...p, connected: remote.connected, desc: remote.desc };
        return p;
      }));
    } catch (err) {
      console.warn('刷新平台状态失败:', err.message);
    }
  };

  const handleToggleEntertainmentHide = async () => {
    alert('暂未实现该功能');
    /*
    setTogglingHide(true);
    try {
      const data = await settingsApi.toggleEntertainmentHide();
      if (data.hideEntertainment !== undefined) {
        setHideEntertainment(data.hideEntertainment);
      }
    } catch (err) {
      console.warn('切换娱乐信息隐藏失败:', err.message);
    } finally {
      setTogglingHide(false);
    }
    */
  };

  // AI 配置相关函数
  const loadAIConfig = async () => {
    try {
      const config = await aiConfigApi.getConfig();
      const modelTypeMap = {
        'GPT_4': 'gpt-4',
        'GPT_4_TURBO': 'gpt-4-turbo',
        'GPT_3_5_TURBO': 'gpt-3.5-turbo',
        'CLAUDE_3_OPUS': 'claude-3-opus',
        'CLAUDE_3_SONNET': 'claude-3-sonnet',
        'CLAUDE_3_HAIKU': 'claude-3-haiku',
        'GEMINI_PRO': 'gemini-pro',
        'CUSTOM': 'custom'
      };

      setSelectedModel(modelTypeMap[config.modelType] || 'gpt-4');

      // 保存已有的屏蔽 API Key 用于显示
      if (config.apiKey) {
        setExistingApiKey(config.apiKey);
      }

      if (config.modelType === 'CUSTOM') {
        setCustomConfig({
          modelName: config.customModelName || '',
          apiEndpoint: config.apiEndpoint || '',
          apiKey: '' // 不预填充 API Key，用户需要重新输入
        });
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
    }
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    setSaveStatus('');
  };

  const handleCustomConfigChange = (field, value) => {
    setCustomConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveStatus('');
  };

  const handleSaveConfig = async () => {
    setIsLoadingAI(true);
    setSaveStatus('');

    try {
      const modelTypeMap = {
        'gpt-4': 'GPT_4',
        'gpt-4-turbo': 'GPT_4_TURBO',
        'gpt-3.5-turbo': 'GPT_3_5_TURBO',
        'claude-3-opus': 'CLAUDE_3_OPUS',
        'claude-3-sonnet': 'CLAUDE_3_SONNET',
        'claude-3-haiku': 'CLAUDE_3_HAIKU',
        'gemini-pro': 'GEMINI_PRO',
        'custom': 'CUSTOM'
      };

      const requestBody = {
        modelType: modelTypeMap[selectedModel],
        apiKey: selectedModel === 'custom'
          ? (customConfig.apiKey || null)  // 空字符串传 null，后端保持原有值
          : null,
        apiEndpoint: selectedModel === 'custom' ? customConfig.apiEndpoint : null,
        customModelName: selectedModel === 'custom' ? customConfig.modelName : null
      };

      await aiConfigApi.saveConfig(requestBody);
      setSaveStatus('success');

      // 保存成功后重新加载配置，更新 existingApiKey
      await loadAIConfig();

      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('保存 AI 配置失败:', error);
      setSaveStatus('error');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const openBilibiliQrModal = async () => {
    setQrLoading(true);
    try {
      const data = await settingsApi.getBilibiliQrcode();
      const key = data.qrcodeKey || data.oauthKey || '';
      setQrCodeUrl(data.qrcodeUrl || '');
      setQrOauthKey(key);
      setQrStatus(-1);
      setQrMessage('请使用 B 站 App 扫描二维码');
      setShowQrModal(true);
      setQrPolling(true);
      pollLoop(key);
    } catch (err) {
      alert('获取二维码失败：' + err.message);
      setQrLoading(false);
    }
  };

  const pollLoop = (key) => {
    const maxPolls = 60;
    let count = 0;

    const timer = setInterval(async () => {
      count++;
      if (count > maxPolls) {
        clearInterval(timer);
        setQrPolling(false);
        setQrLoading(false);
        setQrStatus(2);
        setQrMessage('二维码已过期，请重试');
        return;
      }

      try {
        const res = await settingsApi.pollBilibiliQrcode(key);
        setQrStatus(res.status);
        setQrMessage(res.message || '');

        if (res.status === 1) {
          clearInterval(timer);
          setQrPolling(false);
          setQrLoading(false);
          handleBilibiliLoginSuccess();
        } else if (res.status === 2) {
          clearInterval(timer);
          setQrPolling(false);
          setQrLoading(false);
        }
      } catch (err) {
        console.warn('轮询状态出错:', err.message);
      }
    }, 1000);

    window._bilibiliPollTimer = timer;
  };

  const handleBilibiliLoginSuccess = async () => {
    setShowQrModal(false);
    setSaving(true);
    try {
      // 后端已在轮询成功时自动保存 Cookie，刷新状态即可
      await refreshPlatformStatus();

      // 设置标记，让 Inbox 自动刷新
      sessionStorage.setItem('inbox:shouldRefetch', 'true');
      sessionStorage.setItem('inbox:refetchTimestamp', Date.now().toString());

      // 自动触发爬虫（不阻塞 UI）
      const crawlPromise = crawlApi.trigger('bilibili').catch(err => {
        console.warn('触发爬虫失败（不影响授权）:', err.message);
      });

      alert('B 站登录成功！凭证已自动保存。爬虫已启动，即将为您抓取数据...');

      // 跳转到 Inbox 查看抓取结果
      setSaving(false);
      window.location.href = '/inbox';

      // 后台等待爬虫启动完成
      crawlPromise;
    } catch (err) {
      alert('登录成功但后续处理失败：' + err.message);
      setSaving(false);
    }
  };

  // ===== 知乎二维码登录 =====

  const openZhihuQrModal = async () => {
    setZhihuQrLoading(true);
    try {
      const data = await settingsApi.getZhihuQrcode();
      setZhihuQrLink(data.qrcodeLink || '');
      setZhihuQrKey(data.qrcodeKey || '');
      setZhihuQrStatus(-1);
      setZhihuQrMessage('请使用知乎 App 扫描二维码');
      setShowZhihuQrModal(true);
      setZhihuQrPolling(true);
      pollZhihuLoop(data.qrcodeKey || '');
    } catch (err) {
      alert('获取二维码失败：' + err.message);
      setZhihuQrLoading(false);
    }
  };

  const pollZhihuLoop = (key) => {
    const maxPolls = 60;
    let count = 0;

    const timer = setInterval(async () => {
      count++;
      if (count > maxPolls) {
        clearInterval(timer);
        setZhihuQrPolling(false);
        setZhihuQrLoading(false);
        setZhihuQrStatus(2);
        setZhihuQrMessage('二维码已过期，请重试');
        return;
      }

      try {
        const res = await settingsApi.pollZhihuQrcode(key);
        setZhihuQrStatus(res.status);
        setZhihuQrMessage(res.message || '');

        if (res.status === 1) {
          clearInterval(timer);
          setZhihuQrPolling(false);
          setZhihuQrLoading(false);
          handleZhihuLoginSuccess();
        } else if (res.status === 2) {
          clearInterval(timer);
          setZhihuQrPolling(false);
          setZhihuQrLoading(false);
        }
      } catch (err) {
        console.warn('轮询知乎状态出错:', err.message);
      }
    }, 1000);

    window._zhihuPollTimer = timer;
  };

  const handleZhihuLoginSuccess = async () => {
    setShowZhihuQrModal(false);
    setSaving(true);
    try {
      await refreshPlatformStatus();

      sessionStorage.setItem('inbox:shouldRefetch', 'true');
      sessionStorage.setItem('inbox:refetchTimestamp', Date.now().toString());

      const crawlPromise = crawlApi.trigger('zhihu').catch(err => {
        console.warn('触发爬虫失败（不影响授权）:', err.message);
      });

      alert('知乎登录成功！凭证已自动保存。爬虫已启动，即将为您抓取数据...');

      setSaving(false);
      window.location.href = '/inbox';

      crawlPromise;
    } catch (err) {
      alert('登录成功但后续处理失败：' + err.message);
      setSaving(false);
    }
  };

  const handleConnect = async (platform) => {
    if (platform === 'bilibili') {
      openBilibiliQrModal();
      return;
    }

    if (platform === 'github') {
      setPromptConfig({
        platform,
        title: '配置 GitHub 访问令牌',
        desc: '请输入 GitHub Personal Access Token\n\n获取方式：\n1. 打开 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)\n2. 点击 Generate new token，勾选 repo 和 user 权限\n3. 生成后复制 Token 粘贴到此处',
        placeholder: 'ghp_...',
        value: ''
      });
    } else if (platform === 'xiaohongshu') {
      setPromptConfig({
        platform,
        title: '配置小红书 Cookie',
        desc: '请输入小红书 Cookie（可选，不填则使用公开发现页）\n\n📌 获取方式：\n1. 浏览器打开 xiaohongshu.com 并登录\n2. 按 F12 打开开发者工具 → 切换到 Console（控制台）标签\n3. 输入 document.cookie 并回车\n4. 复制输出的完整字符串，粘贴到此处',
        placeholder: 'a1=...; webId=...',
        value: ''
      });
    } else if (platform === 'zhihu') {
      setPromptConfig({
        platform,
        title: '配置知乎 Cookie',
        desc: '请输入知乎完整 Cookie（必须包含 z_c0=... 字段！）\n\n📌 获取方式：\n1. 浏览器打开 zhihu.com 并登录\n2. 按 F12 打开开发者工具 → 切换到 Console（控制台）标签\n3. 输入 document.cookie 并回车\n4. 复制输出的完整字符串，粘贴到此处\n\n💡 提示：也可使用顶部的「知乎扫码登录」免手动复制',
        placeholder: 'z_c0=...; d_c0=...',
        value: ''
      });
    }
  };

  const submitPrompt = async () => {
    if (!promptConfig) return;
    const { platform, value } = promptConfig;
    const credential = value ? value.trim() : '';

    setPromptConfig(null);
    setSaving(true);

    try {
      // 1. 保存凭证
      await settingsApi.saveCredential(platform, credential);

      // 2. 刷新平台状态
      await refreshPlatformStatus();

      // 3. 设置标记，让 Inbox 自动刷新
      sessionStorage.setItem('inbox:shouldRefetch', 'true');
      sessionStorage.setItem('inbox:refetchTimestamp', Date.now().toString());

      // 4. 自动触发爬虫（不阻塞 UI）
      const crawlPromise = crawlApi.trigger(platform).catch(err => {
        console.warn('触发爬虫失败（不影响授权）:', err.message);
      });

      // 5. 提示用户
      alert(platform === 'xiaohongshu' && !credential
        ? '已保存公开模式。爬虫已启动，即将为您抓取数据...'
        : '授权成功！凭证已安全保存。爬虫已启动，即将为您抓取数据...');

      // 6. 释放加载状态后再跳转，避免按钮卡住
      setSaving(false);

      // 7. 跳转到 Inbox 查看抓取结果
      window.location.href = '/inbox';

      // 后台等待爬虫启动完成（不阻塞）
      crawlPromise;
    } catch (err) {
      alert('保存失败：' + err.message);
      setSaving(false);
    }
  };

  const handleDisconnect = async (platform) => {
    if (!window.confirm(`确定要断开 ${platform} 的连接吗？该平台已抓取的数据也将被删除。`)) return;

    setDisconnecting(prev => ({ ...prev, [platform]: true }));
    try {
      await settingsApi.deleteCredential(platform);
      await refreshPlatformStatus();
    } catch (err) {
      alert('断开失败：' + err.message);
    } finally {
      setDisconnecting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const getPlatform = (key) => platforms.find(p => p.key === key) || { connected: false, name: key, desc: '' };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>设置与隐私</h1>
      </header>

      <div className="settings-content">
        <GlassCard className="settings-section">
          <h2>平台授权管理</h2>
          <p className="section-desc">管理信息源的数据接入授权。凭证将加密存储在后端，仅用于爬虫抓取。</p>
          {loading && <p className="section-desc" style={{ color: 'var(--text-muted)' }}>正在获取平台连接状态...</p>}

          <div className="platform-list">
            {['bilibili', 'zhihu', 'xiaohongshu', 'github'].map(key => {
              const p = getPlatform(key);
              return (
                <div className="platform-item" key={key}>
                  <div className="platform-info">
                    <h3>{p.name}</h3>
                    <p>{p.desc}</p>
                  </div>
                  {p.connected ? (
                    <div className="platform-actions">
                      <div className="status connected">已连接</div>
                      <button
                        className="reconnect-btn"
                        onClick={() => handleConnect(key)}
                        disabled={saving || disconnecting[key]}
                      >
                        更新凭证
                      </button>
                      <button
                        className="disconnect-btn"
                        onClick={() => handleDisconnect(key)}
                        disabled={disconnecting[key]}
                      >
                        {disconnecting[key] ? '断开中...' : '断开'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="connect-btn"
                      onClick={() => handleConnect(key)}
                      disabled={saving || qrLoading}
                    >
                      {key === 'bilibili' && qrLoading
                        ? '二维码加载中...'
                        : (saving ? '保存中...' : (loading ? '加载中...' : '去连接'))}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="settings-section">
          <h2>隐私控制面板</h2>
          <p className="section-desc">细粒度管理您的知识图谱与社交可见性</p>

          <div className="privacy-settings">
            <div className="privacy-item">
              <div className="pi-info">
                <h4>向好友公开我的知识图谱</h4>
                <p>允许好友查看您图谱中的非私密节点</p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider"></span>
              </label>
            </div>

            <div className="privacy-item">
              <div className="pi-info">
                <h4>娱乐类信息隐藏</h4>
                <p>自动隐藏标签为"娱乐短剧"等低营养信息，不在趋势中展示</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hideEntertainment}
                  disabled={togglingHide}
                  onChange={handleToggleEntertainmentHide}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="settings-section">
          <h2>AI 模型配置</h2>
          <p className="section-desc">选择并配置用于内容分析和摘要的 AI 模型</p>

          <div className="ai-settings">
            <div className="ai-model-selector">
              <label htmlFor="model-select" className="ai-label">选择模型</label>
              <select
                id="model-select"
                className="model-select"
                value={selectedModel}
                onChange={handleModelChange}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="claude-3-haiku">Claude 3 Haiku</option>
                <option value="gemini-pro">Gemini Pro</option>
                <option value="custom">自定义模型</option>
              </select>
            </div>

            {selectedModel === 'custom' && (
              <div className="custom-model-config">
                <div className="input-group">
                  <label htmlFor="model-name">模型名称</label>
                  <input
                    id="model-name"
                    type="text"
                    placeholder="例如：gpt-4-custom"
                    value={customConfig.modelName}
                    onChange={(e) => handleCustomConfigChange('modelName', e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="api-endpoint">API 端点</label>
                  <input
                    id="api-endpoint"
                    type="text"
                    placeholder="例如：https://api.openai.com/v1/chat/completions"
                    value={customConfig.apiEndpoint}
                    onChange={(e) => handleCustomConfigChange('apiEndpoint', e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="api-key">API Key</label>
                  <input
                    id="api-key"
                    type="password"
                    placeholder={existingApiKey ? `已存储: ${existingApiKey}` : "请输入您的 API Key"}
                    value={customConfig.apiKey}
                    onChange={(e) => handleCustomConfigChange('apiKey', e.target.value)}
                  />
                  <p className="config-hint">
                    {existingApiKey
                      ? '留空表示保持原有 API Key 不变，输入新值将覆盖原有配置'
                      : '您的 API Key 将被安全加密存储，仅用于 AI 分析'}
                  </p>
                </div>

                <button
                  className={`save-config-btn ${saveStatus === 'success' ? 'success' : ''}`}
                  onClick={handleSaveConfig}
                  disabled={isLoadingAI}
                >
                  {isLoadingAI ? '保存中...' : saveStatus === 'success' ? '✓ 已保存' : '保存配置'}
                </button>
              </div>
            )}

            {selectedModel !== 'custom' && (
              <button
                className={`save-config-btn ${saveStatus === 'success' ? 'success' : ''}`}
                onClick={handleSaveConfig}
                disabled={isLoadingAI}
              >
                {isLoadingAI ? '保存中...' : saveStatus === 'success' ? '✓ 已保存' : '保存配置'}
              </button>
            )}
          </div>

          {saveStatus === 'success' && (
            <div className="notification success">
              <span className="notification-icon">✓</span>
              <span className="notification-message">配置保存成功</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="notification error">
              <span className="notification-icon">✕</span>
              <span className="notification-message">配置保存失败，请重试</span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* B 站扫码登录弹窗 */}
      {showQrModal && (
        <div className="qr-modal-overlay" onClick={() => {
          if (!qrPolling) {
            setShowQrModal(false);
            setQrLoading(false);
            if (window._bilibiliPollTimer) {
              clearInterval(window._bilibiliPollTimer);
              window._bilibiliPollTimer = null;
            }
          }
        }}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>B 站扫码登录</h3>
              {!qrPolling && (
                <button className="qr-close-btn" onClick={() => {
                  setShowQrModal(false);
                  setQrLoading(false);
                  if (window._bilibiliPollTimer) {
                    clearInterval(window._bilibiliPollTimer);
                    window._bilibiliPollTimer = null;
                  }
                }}>×</button>
              )}
            </div>
            <div className="qr-modal-body">
              {qrCodeUrl ? (
                <div className="qr-code-wrapper">
                  <div className="qr-image">
                    <QRCodeSVG value={qrCodeUrl} size={200} level="M" includeMargin={true} />
                  </div>
                  <p className="qr-status-text">{qrMessage}</p>
                  {qrPolling && <p className="qr-hint">请打开 B 站 App 扫描二维码</p>}
                  {qrStatus === 1 && <p className="qr-success">✓ 登录成功！正在启动爬虫...</p>}
                </div>
              ) : (
        <p>{qrLoading ? '正在获取二维码...' : '二维码加载失败'}</p>
      )}
            </div>
          </div>
        </div>
      )}

      {/* 知乎扫码登录弹窗 */}
      {showZhihuQrModal && (
        <div className="qr-modal-overlay" onClick={() => {
          if (!zhihuQrPolling) {
            setShowZhihuQrModal(false);
            setZhihuQrLoading(false);
            if (window._zhihuPollTimer) {
              clearInterval(window._zhihuPollTimer);
              window._zhihuPollTimer = null;
            }
          }
        }}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>知乎扫码登录</h3>
              {!zhihuQrPolling && (
                <button className="qr-close-btn" onClick={() => {
                  setShowZhihuQrModal(false);
                  setZhihuQrLoading(false);
                  if (window._zhihuPollTimer) {
                    clearInterval(window._zhihuPollTimer);
                    window._zhihuPollTimer = null;
                  }
                }}>×</button>
              )}
            </div>
            <div className="qr-modal-body">
              {zhihuQrLink ? (
                <div className="qr-code-wrapper">
                  <div className="qr-image">
                    <QRCodeSVG value={zhihuQrLink} size={200} level="M" includeMargin={true} />
                  </div>
                  <p className="qr-status-text">{zhihuQrMessage}</p>
                  {zhihuQrPolling && <p className="qr-hint">请打开知乎 App 扫描二维码</p>}
                  {zhihuQrStatus === 1 && <p className="qr-success">✓ 登录成功！正在启动爬虫...</p>}
                </div>
              ) : (
                <p>{zhihuQrLoading ? '正在获取二维码...' : '二维码加载失败'}</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 自定义凭证输入弹窗 */}
      {promptConfig && (
        <div className="qr-modal-overlay" onClick={() => setPromptConfig(null)}>
          <div className="qr-modal custom-prompt-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>{promptConfig.title}</h3>
              <button className="qr-close-btn" onClick={() => setPromptConfig(null)}>×</button>
            </div>
            <div className="qr-modal-body prompt-body">
              <div className="prompt-desc">
                {promptConfig.desc.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <textarea
                className="prompt-input"
                placeholder={promptConfig.placeholder}
                value={promptConfig.value}
                onChange={e => setPromptConfig({ ...promptConfig, value: e.target.value })}
                rows={4}
              />
              <div className="prompt-actions">
                <button className="prompt-cancel-btn" onClick={() => setPromptConfig(null)}>取消</button>
                <button className="prompt-submit-btn" onClick={submitPrompt}>确定</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
