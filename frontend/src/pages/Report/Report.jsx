import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { reportData } from '../../mock/reportData';
import {
  historicalWordCloudData,
  sourceMapping,
  weeklyPieData,
  dailyPieData,
  weeklyAiInsight,
  dailyAiInsight
} from '../../mock/dashboardData';
import { Download, ExternalLink, ArrowRight, Sparkles, Info, RefreshCw, Eye } from 'lucide-react';
import { PosterModal } from '../../components/PosterModal/PosterModal';
import { InsightDrawer } from '../../components/InsightDrawer/InsightDrawer';
import './Report.css';

export function Report() {
  const [activeTab, setActiveTab] = useState('weekly');
  const [selectedWord, setSelectedWord] = useState(null);
  const [timeIndex, setTimeIndex] = useState(historicalWordCloudData.length - 1);
  const [showPoster, setShowPoster] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [insight, setInsight] = useState(null);
  const [hasInsight, setHasInsight] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showInsightDrawer, setShowInsightDrawer] = useState(false);
  const [nutritionData, setNutritionData] = useState([]);
  const [totalHours, setTotalHours] = useState(0);

  // 获取营养数据
  React.useEffect(() => {
    const fetchNutritionData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:8080/api/dashboard/nutrition', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const result = await response.json();
          console.log('Nutrition API response:', result);
          setNutritionData(result.data || []);
          setTotalHours(result.totalHours || 0);
        } else {
          console.error('Nutrition API error:', response.status);
        }
      } catch (error) {
        console.error('获取营养数据失败:', error);
      }
    };
    fetchNutritionData();
  }, []);

  // 获取洞察数据
  React.useEffect(() => {
    const fetchInsight = async () => {
      try {
        const token = localStorage.getItem('token');
        const type = activeTab.toUpperCase();
        const response = await fetch(`http://localhost:8080/api/insights/latest?type=${type}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.hasReport) {
            setInsight(data.report);
            setHasInsight(true);
          } else {
            setInsight(null);
            setHasInsight(false);
          }
        }
      } catch (error) {
        console.error('获取洞察数据失败:', error);
        setInsight(null);
        setHasInsight(false);
      }
    };
    fetchInsight();
  }, [activeTab]);

  // 生成/重新生成洞察
  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const type = activeTab.toUpperCase();
      const response = await fetch(`http://localhost:8080/api/insights/generate?type=${type}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setInsight(data.report);
        setHasInsight(true);
        alert('洞察生成成功！');
      } else {
        alert(`生成失败: ${data.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('生成洞察失败:', error);
      alert(`生成洞察失败: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const pieOption = React.useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['65%', '90%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        data: nutritionData.length > 0 ? nutritionData : (activeTab === 'weekly' ? weeklyPieData : dailyPieData)
      }
    ]
  }), [activeTab, nutritionData]);

  const wordCloudOption = React.useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { show: true },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      keepAspect: false,
      left: 'center',
      top: 'center',
      width: '100%',
      height: '100%',
      right: null,
      bottom: null,
      sizeRange: [14, 50],
      rotationRange: [-45, 45],
      rotationStep: 45,
      gridSize: 10,
      drawOutOfBound: false,
      layoutAnimation: true,
      textStyle: {
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
        color: function () {
          return 'rgb(' + [
            Math.round(Math.random() * 100),
            Math.round(Math.random() * 100),
            Math.round(Math.random() * 150 + 50)
          ].join(',') + ')';
        }
      },
      emphasis: {
        focus: 'self',
        textStyle: { textShadowBlur: 10, textShadowColor: '#333' }
      },
      data: activeTab === 'weekly' 
              ? historicalWordCloudData[timeIndex].data 
              : historicalWordCloudData[historicalWordCloudData.length - 1].data
    }]
  }), [timeIndex, activeTab]);

  const onChartClick = (e) => {
    if (e.name) {
      setSelectedWord(e.name);
    }
  };

  const currentSources = selectedWord ? (sourceMapping[selectedWord] || []) : [];
  const currentTopics = activeTab === 'weekly' ? reportData.weeklyTopicClusters : reportData.dailyTopicClusters;

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>数字饮食报告</h1>
        <div className="report-tabs">
          <button 
            className={activeTab === 'weekly' ? 'active' : ''}
            onClick={() => setActiveTab('weekly')}
          >
            周报
          </button>
          <button 
            className={activeTab === 'daily' ? 'active' : ''}
            onClick={() => setActiveTab('daily')}
          >
            日报
          </button>
        </div>
      </header>

      <div className="report-grid">
        <GlassCard className="report-card pie-card" style={{ padding: '24px 32px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>营养分类占比</h3>
          
          <div className="nutrition-label-container">
            <div className="nl-donut-wrapper">
              <div className="nl-donut-bg"></div>
              <div className="nl-donut-chart-inner">
                <ReactECharts option={pieOption} style={{ height: '140px', width: '140px' }} />
              </div>
            </div>

            <div className="nl-header" style={{ position: 'relative' }}>
              <h2>营养成分表</h2>
              <Info className="nl-info-icon" size={20} onClick={() => setShowInfo(true)} />
            </div>

            <div className="nl-period">统计周期: {activeTab === 'weekly' ? '1周 (7天)' : '今天'}</div>

            <div className="nl-thick-bar"></div>

            <div className="nl-amount-row">
              <div className="nl-amount-left">
                <span className="nl-amount-title">摄入量</span>
                <span className="nl-amount-subtitle">总耗时 (小时)</span>
              </div>
              <div className="nl-amount-right">
                {totalHours.toFixed(2)}h
              </div>
            </div>

            <div className="nl-medium-bar nl-full-width"></div>

            <div className="nl-percent-header">
              <span>占比 %*</span>
            </div>

            <div className="nl-rows">
              {(nutritionData.length > 0 ? nutritionData : (activeTab === 'weekly' ? weeklyPieData : dailyPieData)).map((item, idx) => (
                <div className="nl-row" key={idx}>
                  <div className="nl-row-left">
                    <span className="nl-color-block" style={{ backgroundColor: item.itemStyle.color }}></span>
                    <span className="nl-row-name">{item.name}</span>
                    <span className="nl-row-sub">({item.subName || ''})</span>
                    <span className="nl-row-hours">{item.hours || 0}h</span>
                  </div>
                  <div className="nl-row-right">
                    {item.value}%
                  </div>
                </div>
              ))}
            </div>

            <div className="nl-thick-bar nl-full-width" style={{ marginTop: '4px' }}></div>
            
            <div className="nl-footer-note">
              * 占比表示该营养成分在您当前的数字饮食摄入周期中所占的比重。保持高蛋白低脂肪有助于数字健康。
            </div>
          </div>
        </GlassCard>

        <GlassCard className="report-card insight-card">
          <div className="insight-header">
            <Sparkles className="insight-icon" size={18} />
            <h3>{hasInsight ? insight.insightTitle : '数字饮食洞察'}</h3>
          </div>
          {hasInsight ? (
            <>
              <div className="insight-content">
                {insight.insightSummary.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                )}
              </div>
              <div className="insight-actions">
                <button className="insight-detail-btn" onClick={() => setShowInsightDrawer(true)}>
                  <Eye size={14} />
                  查看洞察详情
                </button>
                <button
                  className="insight-regenerate-btn"
                  onClick={handleGenerateInsight}
                  disabled={isGenerating}
                >
                  <RefreshCw size={14} className={isGenerating ? 'spinning' : ''} />
                  {isGenerating ? '生成中...' : '重新生成'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="insight-empty">
                还未有洞察，快去生成吧
              </div>
              <div className="insight-actions">
                <button
                  className="insight-generate-btn"
                  onClick={handleGenerateInsight}
                  disabled={isGenerating}
                >
                  <Sparkles size={14} />
                  {isGenerating ? '生成中...' : '生成洞察'}
                </button>
              </div>
            </>
          )}
        </GlassCard>

        <div className="report-trend-container">
          <GlassCard className="report-card trend-card">
            <h3>{activeTab === 'weekly' ? '近期关注点流变 (词云)' : '今日关注点 (词云)'}</h3>
            <p className="card-hint">点击词汇查看溯源 {activeTab === 'weekly' && '/ 拖动底部滑块查看历史流变'}</p>
            <div className="chart-box" style={{ height: '260px', position: 'relative' }}>
              <ReactECharts 
                option={wordCloudOption} 
                style={{ height: '100%', width: '100%' }}
                onEvents={{ 'click': onChartClick }}
              />
            </div>
            
            {activeTab === 'weekly' && (
              <div className="timeline-slider-container">
                <input 
                  type="range" 
                  min="0" 
                  max={historicalWordCloudData.length - 1} 
                  value={timeIndex}
                  onChange={(e) => setTimeIndex(Number(e.target.value))}
                  className="timeline-slider"
                />
                <div className="timeline-labels">
                  {historicalWordCloudData.map((t, idx) => (
                    <span key={idx} className={idx === timeIndex ? 'active' : ''}>
                      {t.date}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          {selectedWord && (
            <GlassCard className="report-card source-list-card">
              <div className="sl-header">
                <h3>🔍 溯源: {selectedWord}</h3>
                <span className="sl-count">找到 {currentSources.length} 条记录</span>
              </div>
              
              {currentSources.length > 0 ? (
                <div className="sl-items">
                  {currentSources.map((src, idx) => (
                    <div key={idx} className="sl-item">
                      <div className="sl-item-main">
                        <span className="sl-platform">{src.platform}</span>
                        <h4>{src.title}</h4>
                      </div>
                      <div className="sl-item-meta">
                        <span className="sl-category">{src.category}</span>
                        <span className="sl-time">{src.time}</span>
                        <button className="sl-go-btn"><ArrowRight size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sl-empty">暂无该词汇的溯源记录。</div>
              )}
            </GlassCard>
          )}
        </div>

        <GlassCard className="report-card topics-card">
          <h3>高频话题聚类</h3>
          <ul className="topic-list">
            {currentTopics.map((cluster, i) => (
              <li key={i} className="topic-item">
                <div className="topic-info">
                  <span className="topic-name">{cluster.name}</span>
                  <span className="topic-count">{cluster.count} 篇</span>
                </div>
                <div className="topic-tags">
                  {cluster.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <div className="report-actions">
        <button className="share-btn" onClick={() => setShowPoster(true)}>
          <Download size={16} />
          生成分享海报
        </button>
      </div>
      
      {showPoster && (
        <PosterModal
          onClose={() => setShowPoster(false)}
          pieOption={pieOption}
          insight={insight}
          activeTab={activeTab}
        />
      )}

      {showInsightDrawer && (
        <InsightDrawer
          isOpen={showInsightDrawer}
          onClose={() => setShowInsightDrawer(false)}
          insight={insight}
          reportType={activeTab}
        />
      )}

      {showInfo && createPortal(
        <div className="info-modal-overlay" onClick={() => setShowInfo(false)}>
          <div className="info-modal-container" onClick={e => e.stopPropagation()}>
            <div className="info-modal-header">
              <h2>数字饮食营养素指南</h2>
              <button className="info-modal-close" onClick={() => setShowInfo(false)}>×</button>
            </div>
            <div className="info-modal-content">
              <div className="info-modal-item">
                <h3>🥩 1. 蛋白质 (Protein) —— 深度认知与硬核知识</h3>
                <p><strong>定义：</strong>能够构建个人认知护城河的底层逻辑、学术论文、长篇深度分析、基础科学。</p>
                <p><strong>特点：</strong>难咀嚼、不易消化（需要高度专注），但能带来长期的心智成长，是增长认知“肌肉”的绝对主力。</p>
                <p className="info-example">例如：《大语言模型 Transformer 架构的数学推导》、《人类简史》。</p>
              </div>
              <div className="info-modal-item">
                <h3>🍚 2. 碳水化合物 (Carbs) —— 实用技能与行业快讯</h3>
                <p><strong>定义：</strong>能够快速转化为行动力、拿来就用的工具技巧，或是最新的行业新闻动态。</p>
                <p><strong>特点：</strong>消化快，能提供快速的“能量”，看完立刻就能在工作或聊天中用上，但半衰期较短（技术和新闻容易过时）。</p>
                <p className="info-example">例如：《10分钟教你用 React 19 新特性》、《今日 AI 圈五件大事》。</p>
              </div>
              <div className="info-modal-item">
                <h3>🍊 3. 维生素 (Vitamins) —— 创意灵感与美学体验</h3>
                <p><strong>定义：</strong>设计作品、艺术鉴赏、优秀的文案、能够激发大脑产生新点子的小众内容。</p>
                <p><strong>特点：</strong>不需要大量或长时间摄入，但不可或缺。它们能打破思维定势，让大脑保持活跃和年轻。</p>
                <p className="info-example">例如：《2026年最佳网页动效赏析》、《宫崎骏的色彩哲学》。</p>
              </div>
              <div className="info-modal-item">
                <h3>🍔 4. 脂肪与糖分 (Fats & Sugars) —— 纯娱乐与情绪多巴胺</h3>
                <p><strong>定义：</strong>搞笑短视频、无脑爽剧、明星八卦、情绪煽动型的口水文。</p>
                <p><strong>特点：</strong>口感极佳，能瞬间飙升多巴胺（极具爽感），但毫无长期价值。适量摄入可以解压，但过量会导致“数字肥胖”和注意力涣散。</p>
                <p className="info-example">例如：《某网红最新狗血大瓜》、《3分钟看完这部爽剧》。</p>
              </div>
              <div className="info-modal-item">
                <h3>🥬 5. 膳食纤维 (Fiber) —— 哲思与心理复原力</h3>
                <p><strong>定义：</strong>哲学探讨、心理疏导、历史宏观感悟、慢节奏的自然纪录片或人物访谈。</p>
                <p><strong>特点：</strong>不能立刻教你赚钱，也不能让你发笑，但它能清理大脑的“信息垃圾”，缓解焦虑，让你平心静气。</p>
                <p className="info-example">例如：《项飙：把自己作为方法》、《地球脉动》。</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
