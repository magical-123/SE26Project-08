import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { settingsApi, crawlApi, aiConfigApi } from '../../utils/api';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '../../components/Toast/Toast';
import { ConfirmModal } from '../../components/ConfirmModal/ConfirmModal';
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
  const toast = useToast();
  const [platforms, setPlatforms] = useState(defaultPlatforms);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState({});
  const [publicGraph, setPublicGraph] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);

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

  // 自定义输入弹窗状态
  const [promptConfig, setPromptConfig] = useState(null);

  // 确认弹窗状态
  const [confirmState, setConfirmState] = useState(null); // { platform: string, type: 'disconnect' | 'clearCredential' }

  // AI 配置状态
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [customConfig, setCustomConfig] = useState({
    modelName: '',
    apiEndpoint: '',
    apiKey: ''
  });
  const [existingApiKey, setExistingApiKey] = useState(''); // 存储已有的屏蔽 API Key
  const [saveStatus, setSaveStatus] = useState(''); // 'success' | 'error' | ''
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  // ===== 供应商与模型定义 =====
  /** 供应商列表：每个供应商有 label、模型列表、是否需要 API Key 等 */
  const providers = {
    openai: { label: 'OpenAI', needsApiKey: true, endpoint: 'https://api.openai.com/v1/chat/completions', models: {
      'gpt-4': { label: 'GPT-4', modelType: 'GPT_4' },
      'gpt-4-turbo': { label: 'GPT-4 Turbo', modelType: 'GPT_4_TURBO' },
      'gpt-3.5-turbo': { label: 'GPT-3.5 Turbo', modelType: 'GPT_3_5_TURBO' },
    }},
    anthropic: { label: 'Anthropic (Claude)', needsApiKey: true, endpoint: 'https://api.anthropic.com/v1/messages', models: {
      'claude-3-opus': { label: 'Claude 3 Opus', modelType: 'CLAUDE_3_OPUS' },
      'claude-3-sonnet': { label: 'Claude 3 Sonnet', modelType: 'CLAUDE_3_SONNET' },
      'claude-3-haiku': { label: 'Claude 3 Haiku', modelType: 'CLAUDE_3_HAIKU' },
    }},
    google: { label: 'Google', needsApiKey: true, endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', models: {
      'gemini-pro': { label: 'Gemini Pro', modelType: 'GEMINI_PRO' },
    }},
    deepseek: { label: 'DeepSeek (深度求索)', needsApiKey: true, endpoint: 'https://api.deepseek.com/chat/completions', models: {
      'deepseek-v4-flash': { label: 'DeepSeek V4 Flash', modelType: 'DEEPSEEK' },
      'deepseek-reasoner': { label: 'DeepSeek R1 (Reasoner)', modelType: 'DEEPSEEK' },
      'deepseek-chat': { label: 'DeepSeek V3 (Chat)', modelType: 'DEEPSEEK' },
    }},
    qwen: { label: '通义千问 (Alibaba)', needsApiKey: true, endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models: {
      'qwen-plus': { label: 'Qwen Plus', modelType: 'QWEN' },
      'qwen-turbo': { label: 'Qwen Turbo', modelType: 'QWEN' },
      'qwen-max': { label: 'Qwen Max', modelType: 'QWEN' },
    }},
    glm: { label: '智谱 GLM (Zhipu)', needsApiKey: true, endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', models: {
      'glm-4-plus': { label: 'GLM-4 Plus', modelType: 'GLM' },
      'glm-4-flash': { label: 'GLM-4 Flash', modelType: 'GLM' },
    }},
    kimi: { label: '月之暗面 Kimi (Moonshot)', needsApiKey: true, endpoint: 'https://api.moonshot.cn/v1/chat/completions', models: {
      'moonshot-v1-8k': { label: 'Moonshot v1 8K', modelType: 'KIMI' },
      'moonshot-v1-32k': { label: 'Moonshot v1 32K', modelType: 'KIMI' },
    }},
    doubao: { label: '字节豆包 (ByteDance)', needsApiKey: true, endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', models: {
      'doubao-pro-32k': { label: 'Doubao Pro 32K', modelType: 'DOUBAO' },
      'doubao-1.5-pro': { label: 'Doubao 1.5 Pro', modelType: 'DOUBAO' },
    }},
    custom: { label: '自定义模型', needsApiKey: true, needsCustomFields: true, models: {
      'custom': { label: '自定义', modelType: 'CUSTOM' },
    }},
  };
  /** 当前供应商的模型列表 */
  const currentModels = providers[selectedProvider]?.models || {};
  /** 当前是否需要填写 API Key */
  const needsApiKey = providers[selectedProvider]?.needsApiKey || false;

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

  useEffect(() => {
    settingsApi.getPrivacy()
      .then(data => setPublicGraph(Boolean(data.publicGraph)))
      .catch(err => console.warn('加载隐私设置失败:', err.message));
  }, []);

  const handlePrivacyChange = async (event) => {
    const nextValue = event.target.checked;
    const previousValue = publicGraph;
    setPublicGraph(nextValue);
    setPrivacySaving(true);
    try {
      await settingsApi.updatePrivacy(nextValue);
      toast.success('隐私设置已保存');
    } catch (err) {
      setPublicGraph(previousValue);
      toast.error(`隐私设置保存失败: ${err.message}`);
    } finally {
      setPrivacySaving(false);
    }
  };

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

  // AI 配置相关函数
  const loadAIConfig = async () => {
    try {
      const config = await aiConfigApi.getConfig();

      // 构建反向映射：modelType → { providerKey, modelKey }
      let foundProvider = 'openai';
      let foundModel = 'gpt-4';
      for (const [pKey, pVal] of Object.entries(providers)) {
        for (const [mKey, mVal] of Object.entries(pVal.models)) {
          if (mVal.modelType === config.modelType) {
            foundProvider = pKey;
            // 对于国产模型，用 customModelName 匹配具体的模型
            if (pVal.needsApiKey && config.customModelName) {
              // 如果保存的模型名匹配任一选项，就用它
              if (mKey === config.customModelName) {
                foundModel = mKey;
              } else {
                // 否则看有没有哪个选项的 key 匹配
                const match = Object.keys(pVal.models).find(k => k === config.customModelName);
                foundModel = match || mKey;
              }
            } else {
              foundModel = mKey;
            }
            break;
          }
        }
      }
      setSelectedProvider(foundProvider);
      setSelectedModel(foundModel);

      // 保存已有的屏蔽 API Key 用于显示
      if (config.apiKey) {
        setExistingApiKey(config.apiKey);
      }

      // 需要 API Key 的供应商：预填 endpoint 和 modelName
      const prov = providers[foundProvider];
      if (prov.needsApiKey) {
        setCustomConfig({
          modelName: config.customModelName || foundModel,
          apiEndpoint: config.apiEndpoint || (prov.endpoint || ''),
          apiKey: '' // 不预填充 API Key
        });
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
    }
  };

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    // 切换到新供应商时默认选中其第一个模型
    const firstModel = Object.keys(providers[newProvider].models)[0];
    setSelectedModel(firstModel);
    setSaveStatus('');
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
      const prov = providers[selectedProvider];
      const modelDef = prov.models[selectedModel];
      const needsExtra = prov.needsApiKey || prov.needsCustomFields;

      const requestBody = {
        modelType: modelDef.modelType,
        apiKey: needsExtra ? (customConfig.apiKey || null) : null,
        apiEndpoint: needsExtra ? (customConfig.apiEndpoint || (prov.endpoint || null)) : null,
        customModelName: needsExtra ? (customConfig.modelName || selectedModel) : null
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

  const handleTestConfig = async () => {
    setIsTestingAI(true);
    setTestResult(null);

    try {
      const prov = providers[selectedProvider];
      const modelDef = prov.models[selectedModel];
      const needsExtra = prov.needsApiKey || prov.needsCustomFields;

      const requestBody = {
        modelType: modelDef.modelType,
        apiKey: needsExtra ? (customConfig.apiKey || null) : null,
        apiEndpoint: needsExtra ? (customConfig.apiEndpoint || (prov.endpoint || null)) : null,
        customModelName: needsExtra ? (customConfig.modelName || selectedModel) : null
      };

      const res = await aiConfigApi.testConfig(requestBody);
      setTestResult({ success: true, message: res.message || '连接成功！' });
    } catch (error) {
      console.error('测试 AI 配置失败:', error);
      setTestResult({ success: false, message: error.message || '连接失败' });
    } finally {
      setIsTestingAI(false);
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
      toast.error('获取二维码失败：' + err.message);
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

      toast.success('B 站登录成功！凭证已自动保存。爬虫已启动，即将为您抓取数据...');

      // 跳转到 Inbox 查看抓取结果
      setSaving(false);
      window.location.href = '/inbox';

      // 后台等待爬虫启动完成
      crawlPromise;
    } catch (err) {
      toast.error('登录成功但后续处理失败：' + err.message);
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
      toast.error('获取二维码失败：' + err.message);
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

      toast.success('知乎登录成功！凭证已自动保存。爬虫已启动，即将为您抓取数据...');

      setSaving(false);
      window.location.href = '/inbox';

      crawlPromise;
    } catch (err) {
      toast.error('登录成功但后续处理失败：' + err.message);
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
      toast.success(platform === 'xiaohongshu' && !credential
        ? '已保存公开模式。爬虫已启动，即将为您抓取数据...'
        : '授权成功！凭证已安全保存。爬虫已启动，即将为您抓取数据...');

      // 6. 释放加载状态后再跳转，避免按钮卡住
      setSaving(false);

      // 7. 跳转到 Inbox 查看抓取结果
      window.location.href = '/inbox';

      // 后台等待爬虫启动完成（不阻塞）
      crawlPromise;
    } catch (err) {
      toast.error('保存失败：' + err.message);
      setSaving(false);
    }
  };

  const handleDisconnect = async (platform) => {
    setConfirmState({ platform, type: 'disconnect' });
  };

  const handleConfirmDisconnect = async () => {
    if (!confirmState) return;
    const { platform } = confirmState;
    setConfirmState(null);
    setDisconnecting(prev => ({ ...prev, [platform]: true }));
    try {
      await settingsApi.deleteCredential(platform);
      await refreshPlatformStatus();
    } catch (err) {
      toast.error('断开失败：' + err.message);
    } finally {
      setDisconnecting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const getPlatform = (key) => platforms.find(p => p.key === key) || { connected: false, name: key, desc: '' };
  const browserCapturePlatforms = {
    zhihu: { packageUrl: '/downloads/infodigest-zhihu-capture.zip', label: '下载知乎扩展包' },
    xiaohongshu: { packageUrl: '/downloads/infodigest-xiaohongshu-capture.zip', label: '下载小红书扩展包' },
  };

  const handleClearLegacyCredential = async (platform) => {
    setConfirmState({ platform, type: 'clearCredential' });
  };

  const handleConfirmClearCredential = async () => {
    if (!confirmState) return;
    const { platform } = confirmState;
    setConfirmState(null);
    setDisconnecting(prev => ({ ...prev, [`${platform}-credential`]: true }));
    try {
      await settingsApi.clearCredentialOnly(platform);
      await refreshPlatformStatus();
    } catch (err) {
      toast.error('清除旧凭据失败：' + err.message);
    } finally {
      setDisconnecting(prev => ({ ...prev, [`${platform}-credential`]: false }));
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>设置与隐私</h1>
      </header>

      <div className="settings-content">
        <GlassCard className="settings-section">
          <h2>平台接入管理</h2>
          <p className="section-desc">B站和 GitHub 使用官方凭据授权；知乎和小红书推荐使用浏览器扩展在真实浏览时自动捕获，无需提交平台 Cookie。</p>
          {loading && <p className="section-desc" style={{ color: 'var(--text-muted)' }}>正在获取平台连接状态...</p>}

          <div className="platform-list">
            {['bilibili', 'zhihu', 'xiaohongshu', 'github'].map(key => {
              const p = getPlatform(key);
              const browserCapture = browserCapturePlatforms[key];
              const description = browserCapture
                ? (p.connected
                  ? `旧 Cookie 已保留（${p.desc}）。推荐改用浏览器扩展自动捕获，旧凭据仅作兼容用途。`
                  : '推荐：安装浏览器扩展后，在真实浏览器中自动记录详情页浏览/观看时长，无需 Cookie。')
                : p.desc;
              return (
                <div className={`platform-item ${browserCapture ? 'browser-capture-platform' : ''}`} key={key}>
                  <div className="platform-info">
                    <h3>{p.name}</h3>
                    <p>{description}</p>
                  </div>
                  {browserCapture && !p.connected ? (
                    <div className="browser-capture-status">无需 Cookie</div>
                  ) : p.connected ? (
                    <div className="platform-actions">
                      <div className="status connected">{browserCapture ? '旧凭据' : '已连接'}</div>
                      <button
                        className="reconnect-btn"
                        onClick={() => handleConnect(key)}
                        disabled={saving || disconnecting[key]}
                      >
                        {browserCapture ? '管理旧凭据' : '更新凭证'}
                      </button>
                      {browserCapture && (
                        <button
                          className="clear-credential-btn"
                          onClick={() => handleClearLegacyCredential(key)}
                          disabled={disconnecting[`${key}-credential`]}
                        >
                          {disconnecting[`${key}-credential`] ? '清除中...' : '清除旧 Cookie'}
                        </button>
                      )}
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

          <div className="browser-capture-guide">
            <div className="capture-guide-heading">
              <div>
                <h3>浏览器扩展自动捕获 <span>推荐</span></h3>
                <p>只在您真实打开知乎/小红书内容详情页时记录前台阅读或播放时长；不上传平台 Cookie，不读取未公开的历史、点赞或收藏。</p>
              </div>
            </div>
            <ol className="capture-steps">
              <li>下载扩展包并解压到本地文件夹。</li>
              <li>在 Chrome/Edge 打开“扩展管理”页，开启<strong>开发者模式</strong>，选择“加载已解压的扩展程序”。</li>
              <li>选择解压后的扩展文件夹，在扩展弹窗登录 InfoDigest 一次即可开始自动记录。</li>
            </ol>
            <div className="capture-downloads">
              <a href="/downloads/infodigest-zhihu-capture.zip" download className="extension-download-btn">下载知乎扩展包</a>
              <a href="/downloads/infodigest-xiaohongshu-capture.zip" download className="extension-download-btn xhs">下载小红书扩展包</a>
            </div>
            <p className="capture-note">提示：网页不能静默为您安装扩展，这是浏览器的安全限制。正式发布时可上架 Chrome Web Store 和 Edge 加载项商店，实现商店的一键安装与自动更新。</p>
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
                <input
                  type="checkbox"
                  checked={publicGraph}
                  disabled={privacySaving}
                  onChange={handlePrivacyChange}
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
              <label htmlFor="provider-select" className="ai-label">供应商</label>
              <select
                id="provider-select"
                className="model-select"
                value={selectedProvider}
                onChange={handleProviderChange}
              >
                {Object.entries(providers).map(([key, prov]) => (
                  <option key={key} value={key}>{prov.label}</option>
                ))}
              </select>
            </div>

            <div className="ai-model-selector">
              <label htmlFor="model-select" className="ai-label">模型</label>
              <select
                id="model-select"
                className="model-select"
                value={selectedModel}
                onChange={handleModelChange}
              >
                {Object.entries(currentModels).map(([key, m]) => (
                  <option key={key} value={key}>{m.label}</option>
                ))}
              </select>
            </div>

            {needsApiKey && (
              <div className="custom-model-config">
                {providers[selectedProvider].needsCustomFields && (
                  <>
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
                  </>
                )}

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

                <div className="ai-actions-group">
                  <button
                    className={`test-config-btn ${isTestingAI ? 'testing' : ''}`}
                    onClick={handleTestConfig}
                    disabled={isTestingAI || isLoadingAI}
                  >
                    {isTestingAI ? '测试中...' : '测试连接'}
                  </button>
                  <button
                    className={`save-config-btn ${saveStatus === 'success' ? 'success' : ''}`}
                    onClick={handleSaveConfig}
                    disabled={isLoadingAI || isTestingAI}
                  >
                    {isLoadingAI ? '保存中...' : saveStatus === 'success' ? '✓ 已保存' : '保存配置'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {testResult && (
            <div className={`notification ${testResult.success ? 'success' : 'error'}`} style={{ marginTop: '12px', whiteSpace: 'pre-wrap' }}>
              <span className="notification-icon">{testResult.success ? '✓' : '✕'}</span>
              <span className="notification-message">{testResult.message}</span>
            </div>
          )}

          {saveStatus === 'success' && (
            <div className="notification success" style={{ marginTop: '12px' }}>
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

      <ConfirmModal
        isOpen={confirmState?.type === 'disconnect'}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirmDisconnect}
        title="断开平台连接"
        message={`确定要断开 ${confirmState?.platform || ''} 的连接吗？该平台已抓取的数据也将被删除。`}
        confirmText="断开"
        danger
      />
      <ConfirmModal
        isOpen={confirmState?.type === 'clearCredential'}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirmClearCredential}
        title="清除旧 Cookie"
        message={`确定清除 ${confirmState?.platform || ''} 的旧 Cookie 吗？已捕获的 Inbox 数据会保留，之后由浏览器扩展自动捕获。`}
        confirmText="清除"
        danger
      />
    </div>
  );
}
