import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import './Settings.css';

export function Settings() {
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [customConfig, setCustomConfig] = useState({
    modelName: '',
    apiEndpoint: '',
    apiKey: '',
    maxTokens: ''
  });
  const [saveStatus, setSaveStatus] = useState(''); // 'success' | 'error' | ''
  const [isLoading, setIsLoading] = useState(false);

  // 页面加载时获取已保存的配置
  useEffect(() => {
    loadAIConfig();
  }, []);

  const loadAIConfig = async () => {
    try {
      // TODO: 从 localStorage 或 context 获取真实的 userId
      const userId = 1; // 临时硬编码，实际应从登录状态获取

      const response = await fetch(`http://localhost:8080/api/ai-config/${userId}`);

      if (response.ok) {
        const config = await response.json();

        // 映射 modelType 到下拉选项
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

        if (config.modelType === 'CUSTOM') {
          setCustomConfig({
            modelName: config.customModelName || '',
            apiEndpoint: config.apiEndpoint || '',
            apiKey: '', // 出于安全考虑，不回显 API Key
            maxTokens: config.maxTokens || ''
          });
        }
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
    }
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    setSaveStatus(''); // 清除之前的状态提示
  };

  const handleCustomConfigChange = (field, value) => {
    setCustomConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveStatus('');
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setSaveStatus('');

    try {
      // TODO: 从 localStorage 或 context 获取真实的 userId
      const userId = 1; // 临时硬编码

      // 映射前端选项到后端枚举
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
        userId: userId,
        modelType: modelTypeMap[selectedModel],
        apiKey: selectedModel === 'custom' ? customConfig.apiKey : null,
        apiEndpoint: selectedModel === 'custom' ? customConfig.apiEndpoint : null,
        maxTokens: selectedModel === 'custom' && customConfig.maxTokens
          ? parseInt(customConfig.maxTokens)
          : null,
        customModelName: selectedModel === 'custom' ? customConfig.modelName : null
      };

      const response = await fetch('http://localhost:8080/api/ai-config/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000); // 3秒后清除提示
      } else {
        const errorText = await response.text();
        console.error('保存失败:', errorText);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('保存 AI 配置失败:', error);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>设置与隐私</h1>
      </header>

      <div className="settings-content">
        <GlassCard className="settings-section">
          <h2>平台授权管理</h2>
          <p className="section-desc">管理信息源的数据接入授权</p>

          <div className="platform-list">
            <div className="platform-item">
              <div className="platform-info">
                <h3>Bilibili</h3>
                <p>已通过 Cookie 授权，后台隐式抓取中</p>
              </div>
              <div className="status connected">已连接</div>
            </div>
            <div className="platform-item">
              <div className="platform-info">
                <h3>知乎</h3>
                <p>未授权，点击连接</p>
              </div>
              <button className="connect-btn">去连接</button>
            </div>
            <div className="platform-item">
              <div className="platform-info">
                <h3>Apple Podcasts</h3>
                <p>通过 MCP 接入</p>
              </div>
              <div className="status connected">已连接</div>
            </div>
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
                <input type="checkbox" defaultChecked />
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
                <div className="config-item">
                  <label htmlFor="model-name" className="config-label">模型名称</label>
                  <input
                    id="model-name"
                    type="text"
                    className="config-input"
                    placeholder="例如: gpt-4, custom-model-v1"
                    value={customConfig.modelName}
                    onChange={(e) => handleCustomConfigChange('modelName', e.target.value)}
                  />
                </div>

                <div className="config-item">
                  <label htmlFor="api-endpoint" className="config-label">API 端点</label>
                  <input
                    id="api-endpoint"
                    type="text"
                    className="config-input"
                    placeholder="https://api.example.com/v1/chat/completions"
                    value={customConfig.apiEndpoint}
                    onChange={(e) => handleCustomConfigChange('apiEndpoint', e.target.value)}
                  />
                </div>

                <div className="config-item">
                  <label htmlFor="api-key" className="config-label">API 密钥</label>
                  <input
                    id="api-key"
                    type="password"
                    className="config-input"
                    placeholder="sk-..."
                    value={customConfig.apiKey}
                    onChange={(e) => handleCustomConfigChange('apiKey', e.target.value)}
                  />
                </div>

                <div className="config-item">
                  <label htmlFor="max-tokens" className="config-label">最大 Tokens</label>
                  <input
                    id="max-tokens"
                    type="number"
                    className="config-input"
                    placeholder="4096"
                    value={customConfig.maxTokens}
                    onChange={(e) => handleCustomConfigChange('maxTokens', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="ai-info-box">
              <p>💡 所选模型将用于内容摘要生成、知识图谱构建和智能推荐</p>
            </div>

            <div className="ai-actions">
              <button
                className="save-config-btn"
                onClick={handleSaveConfig}
                disabled={isLoading}
              >
                {isLoading ? '保存中...' : '保存配置'}
              </button>

              {saveStatus === 'success' && (
                <span className="save-status success">✓ 保存成功</span>
              )}
              {saveStatus === 'error' && (
                <span className="save-status error">✗ 保存失败，请重试</span>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
