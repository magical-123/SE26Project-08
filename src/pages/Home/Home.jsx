import './Home.css';

export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>欢迎来到 InfoDigest</h1>
        <p className="subtitle">智能信息聚合与知识管理平台</p>
        <div className="hero-actions">
          <a href="#features" className="btn btn-primary">开始使用</a>
          <a href="#about" className="btn btn-secondary">了解更多</a>
        </div>
      </section>

      <section id="features" className="features">
        <h2>核心功能</h2>
        <div className="features-grid">
          <article className="feature-card">
            <div className="feature-icon">📰</div>
            <h3>智能聚合</h3>
            <p>多源信息自动采集、去重、分类，构建个人专属资讯流</p>
          </article>
          <article className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>知识图谱</h3>
            <p>实体识别与关系抽取，自动构建可视化知识网络</p>
          </article>
          <article className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>语义搜索</h3>
            <p>基于向量检索的语义理解搜索，精准定位所需信息</p>
          </article>
          <article className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>趋势分析</h3>
            <p>热点追踪与趋势预测，洞察行业动态与舆情走向</p>
          </article>
        </div>
      </section>

      <section id="about" className="about">
        <h2>关于我们</h2>
        <p>InfoDigest 致力于解决信息过载问题，通过 AI 技术帮助用户高效获取、组织与利用知识。</p>
      </section>
    </div>
  );
}