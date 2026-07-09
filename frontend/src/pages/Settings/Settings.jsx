import React from 'react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import './Settings.css';

export function Settings() {
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
                <p>自动隐藏标签为“娱乐短剧”等低营养信息，不在趋势中展示</p>
              </div>
              <label className="switch">
                <input type="checkbox" defaultChecked />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
