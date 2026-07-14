import React, { useState } from 'react';
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

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
  };

  const handleCustomConfigChange = (field, value) => {
    setCustomConfig(prev => ({
      ...prev,
      [field]: value
    }));
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
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
