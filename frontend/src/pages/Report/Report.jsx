import React, { useState } from 'react';
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
import { Download, ExternalLink, ArrowRight, Sparkles } from 'lucide-react';
import { PosterModal } from '../../components/PosterModal/PosterModal';
import './Report.css';

export function Report() {
  const [activeTab, setActiveTab] = useState('weekly');
  const [selectedWord, setSelectedWord] = useState(null);
  const [timeIndex, setTimeIndex] = useState(historicalWordCloudData.length - 1);
  const [showPoster, setShowPoster] = useState(false);

  const pieOption = React.useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, position: 'outside', color: '#444', fontWeight: 'bold' },
        labelLine: { show: true, lineStyle: { color: '#888' } },
        data: activeTab === 'weekly' ? weeklyPieData : dailyPieData
      }
    ]
  }), [activeTab]);

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
  const currentInsight = activeTab === 'weekly' ? weeklyAiInsight : dailyAiInsight;

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
        <GlassCard className="report-card pie-card">
          <h3>营养分类占比</h3>
          <div className="chart-box">
            <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <GlassCard className="report-card insight-card">
          <div className="insight-header">
            <Sparkles className="insight-icon" size={18} />
            <h3>{currentInsight.title}</h3>
          </div>
          <div className="insight-content">
            {currentInsight.summary.split(/\*\*(.*?)\*\*/g).map((part, i) => 
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </div>
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
          insight={currentInsight}
          activeTab={activeTab}
        />
      )}
    </div>
  );
}
