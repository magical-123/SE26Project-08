import './User.css';

export function User() {
  return (
    <div className="user-page">
      <div className="user-container">
        <header className="user-header">
          <div className="avatar">U</div>
          <h1>用户中心</h1>
          <p className="user-email">user@infodigest.com</p>
        </header>
        //基本信息界面
        <section className="user-section">
          <h2>基本信息</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>用户名</label>
              <span>InfoDigest_User</span>
            </div>
            <div className="info-item">
              <label>注册时间</label>
              <span>2024-01-15</span>
            </div>
            <div className="info-item">
              <label>会员等级</label>
              <span className="badge badge-pro">专业版</span>
            </div>
            <div className="info-item">
              <label>存储用量</label>
              <span>2.4 GB / 10 GB</span>
            </div>
          </div>
        </section>
        //偏好设置界面
        <section className="user-section">
          <h2>偏好设置</h2>
          <div className="settings-grid">
            <label className="setting-item">
              <input type="checkbox" defaultChecked />
              <span>邮件通知</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" />
              <span>推送通知</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" />
              <span>深色模式</span>
            </label>
            <label className="setting-item">
              <input type="checkbox" defaultChecked />
              <span>自动保存阅读进度</span>
            </label>
          </div>
        </section>
        //数据统计界面
        <section className="user-section">
          <h2>数据统计</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">1,234</div>
              <div className="stat-label">已读文章</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">56</div>
              <div className="stat-label">收藏夹</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">12</div>
              <div className="stat-label">关注源</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">89h</div>
              <div className="stat-label">阅读时长</div>
            </div>
          </div>
        </section>

        <section className="user-section danger-zone">
          <h2>危险区域</h2>
          <button className="btn btn-danger">注销账号</button>
        </section>
      </div>
    </div>
  );
}