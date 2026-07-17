import React, { useState, useEffect } from 'react';
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
import { wordCloudApi } from '../../utils/api';
import './Report.css';

export function Report() {
  const [activeTab, setActiveTab] = useState('weekly');
  const [selectedWord, setSelectedWord] = useState(null);
  const [timeIndex, setTimeIndex] = useState(6); // 默认显示最后一天（今天）
  const [showPoster, setShowPoster] = useState(false);
  const [nutritionData, setNutritionData] = useState({
    protein: 0,
    carbs: 0,
    vitamins: 0,
    fats: 0,
    fiber: 0
  });
  const [realWordCloudData, setRealWordCloudData] = useState(null);
  const [loadingWordCloud, setLoadingWordCloud] = useState(true);

  // 洞察相关状态
  const [weeklyInsight, setWeeklyInsight] = useState(null);
  const [dailyInsight, setDailyInsight] = useState(null);
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
  const [isGeneratingDaily, setIsGeneratingDaily] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyType, setHistoryType] = useState(null);
  const [showFullInsightModal, setShowFullInsightModal] = useState(false);

  // 加载营养统计数据和洞察
  React.useEffect(() => {
    fetchNutritionStats();
    fetchInsights();
  }, []);

  const fetchNutritionStats = async () => {
    try {
      // TODO: 从 localStorage 或 context 获取真实的 userId
      const userId = 1;

      const response = await fetch(`http://localhost:8080/api/analysis/nutrition-stats/${userId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.nutrition) {
          setNutritionData(data.nutrition);
        }
      }
    } catch (error) {
      console.error('获取营养统计出错:', error);
    }
  };

  // 获取洞察
  const fetchInsights = async () => {
    const userId = 1;

    // 获取周报洞察
    try {
      const response = await fetch(
        `http://localhost:8080/api/insights/latest?userId=${userId}&type=WEEKLY`
      );
      console.log('周报响应状态:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('周报数据:', data);
        if (data.hasReport) {
          setWeeklyInsight(data.report);
        }
      }
    } catch (error) {
      console.error('获取周报洞察失败:', error);
    }

    // 获取日报洞察
    try {
      const response = await fetch(
        `http://localhost:8080/api/insights/latest?userId=${userId}&type=DAILY`
      );
      console.log('日报响应状态:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('日报数据:', data);
        if (data.hasReport) {
          setDailyInsight(data.report);
        }
      }
    } catch (error) {
      console.error('获取日报洞察失败:', error);
    }
  };

  // 获取词云数据
  useEffect(() => {
    const fetchWordCloudData = async () => {
      try {
        const userId = 1; // TODO: 从用户信息中获取真实的userId
        console.log('[Report词云] 开始获取数据, activeTab:', activeTab);

        if (activeTab === 'weekly') {
          // 获取最近7天的词云数据
          const today = new Date();
          const endDate = today.toISOString().split('T')[0];

          console.log('[Report词云] 请求weekly数据, endDate:', endDate);
          const response = await wordCloudApi.getWeekly(userId, endDate);
          console.log('[Report词云] Weekly API响应:', response);

          if (response.success && response.data) {
            // 将后端数据格式转换为前端需要的格式
            const formattedData = response.data.map((dayData, index) => {
              // keywords已经是数组，不需要JSON.parse
              const keywords = Array.isArray(dayData.keywords)
                ? dayData.keywords
                : JSON.parse(dayData.keywords);

              const daysAgo = response.data.length - 1 - index;
              const dateLabel = daysAgo === 0 ? '今天' :
                               daysAgo === 1 ? '昨天' :
                               `${daysAgo}天前`;

              return {
                date: dateLabel,
                data: keywords.map(item => ({
                  name: item.word,
                  value: item.value
                }))
              };
            });

            console.log('[Report词云] Weekly格式化后的数据:', formattedData);
            setRealWordCloudData(formattedData);
          }
        } else {
          // 获取今日词云数据
          const today = new Date().toISOString().split('T')[0];
          console.log('[Report词云] 请求daily数据, date:', today);

          const response = await wordCloudApi.getDaily(userId, today);
          console.log('[Report词云] Daily API响应:', response);

          if (response.success && response.data && response.data.keywords) {
            // keywords已经是数组，不需要JSON.parse
            const keywords = Array.isArray(response.data.keywords)
              ? response.data.keywords
              : JSON.parse(response.data.keywords);

            const formattedData = keywords.map(item => ({
              name: item.word,
              value: item.value
            }));

            console.log('[Report词云] Daily格式化后的数据:', formattedData);

            setRealWordCloudData([{
              date: '今天',
              data: formattedData
            }]);
          }
        }
      } catch (error) {
        console.error('[Report词云] 获取失败:', error);
        // 如果获取失败，使用mock数据
        setRealWordCloudData(null);
      } finally {
        setLoadingWordCloud(false);
      }
    };

    fetchWordCloudData();
  }, [activeTab]);

  // 生成洞察
  const handleGenerateInsight = async (type) => {
    const userId = 1;
    const isWeekly = type === 'WEEKLY';

    if (isWeekly) {
      setIsGeneratingWeekly(true);
    } else {
      setIsGeneratingDaily(true);
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/insights/generate?userId=${userId}&type=${type}`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (isWeekly) {
            setWeeklyInsight(data.report);
          } else {
            setDailyInsight(data.report);
          }
          alert('洞察生成成功！');
        } else {
          alert('生成失败: ' + data.error);
        }
      } else {
        alert('生成失败，请稍后重试');
      }
    } catch (error) {
      console.error('生成洞察失败:', error);
      alert('生成洞察失败: ' + error.message);
    } finally {
      if (isWeekly) {
        setIsGeneratingWeekly(false);
      } else {
        setIsGeneratingDaily(false);
      }
    }
  };

  // 查看历史洞察
  const handleViewHistory = (type) => {
    setHistoryType(type);
    setShowHistoryModal(true);
  };

  const pieOption = React.useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {d}%'
    },
    legend: {
      orient: 'horizontal',
      bottom: '0',
      left: 'center',
      textStyle: {
        color: '#333',
        fontSize: 12
      }
    },
    series: [
      {
        name: '营养成分',
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'outside',
          color: '#444',
          fontWeight: 'bold',
          formatter: '{d}%'
        },
        labelLine: { show: true, lineStyle: { color: '#888' } },
        data: [
          {
            value: nutritionData.protein,
            name: '蛋白质',
            itemStyle: { color: 'rgba(14, 165, 233, 0.8)' }
          },
          {
            value: nutritionData.carbs,
            name: '碳水',
            itemStyle: { color: 'rgba(16, 185, 129, 0.8)' }
          },
          {
            value: nutritionData.vitamins,
            name: '维生素',
            itemStyle: { color: 'rgba(245, 158, 11, 0.8)' }
          },
          {
            value: nutritionData.fats,
            name: '脂肪',
            itemStyle: { color: 'rgba(244, 63, 94, 0.8)' }
          },
          {
            value: nutritionData.fiber,
            name: '纤维',
            itemStyle: { color: 'rgba(139, 92, 246, 0.8)' }
          }
        ]
      }
    ]
  }), [nutritionData]);

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
              ? (realWordCloudData && realWordCloudData[timeIndex] ? realWordCloudData[timeIndex].data : historicalWordCloudData[timeIndex].data)
              : (realWordCloudData && realWordCloudData[0] ? realWordCloudData[0].data : historicalWordCloudData[historicalWordCloudData.length - 1].data)
    }]
  }), [timeIndex, activeTab, realWordCloudData]);

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
          <h3>五维度营养分布</h3>
          <div className="chart-box">
            <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <GlassCard className="report-card insight-card">
          <div className="insight-header">
            <Sparkles className="insight-icon" size={18} />
            <h3>{activeTab === 'weekly' ? '本周洞察' : '本日洞察'}</h3>
          </div>

          {/* 根据是否有洞察显示不同内容 */}
          {(() => {
            const currentInsight = activeTab === 'weekly' ? weeklyInsight : dailyInsight;
            const isGenerating = activeTab === 'weekly' ? isGeneratingWeekly : isGeneratingDaily;
            const reportType = activeTab === 'weekly' ? 'WEEKLY' : 'DAILY';

            if (isGenerating) {
              return (
                <div className="insight-content empty">
                  <p>⏳ 正在生成洞察，请稍候...</p>
                </div>
              );
            }

            if (!currentInsight) {
              return (
                <>
                  <div className="insight-content empty">
                    <p>还未有洞察，快去生成吧</p>
                  </div>
                  <div className="insight-actions">
                    <button
                      className="generate-insight-btn"
                      onClick={() => handleGenerateInsight(reportType)}
                    >
                      生成报告
                    </button>
                  </div>
                </>
              );
            }

            return (
              <>
                <div className="insight-content">
                  <h4>{currentInsight.insightTitle}</h4>
                  <p>{currentInsight.insightSummary}</p>
                  {currentInsight.insightFullText && (
                    <button
                      className="view-full-insight-btn"
                      onClick={() => setShowFullInsightModal(true)}
                    >
                      查看完整洞察
                    </button>
                  )}
                </div>
                <div className="insight-actions">
                  <button
                    className="regenerate-insight-btn"
                    onClick={() => handleGenerateInsight(reportType)}
                  >
                    重新生成
                  </button>
                  <button
                    className="view-history-btn"
                    onClick={() => handleViewHistory(reportType)}
                  >
                    查看历史
                  </button>
                </div>
              </>
            );
          })()}
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
                  max={(realWordCloudData || historicalWordCloudData).length - 1}
                  value={timeIndex}
                  onChange={(e) => setTimeIndex(Number(e.target.value))}
                  className="timeline-slider"
                />
                <div className="timeline-labels">
                  {(realWordCloudData || historicalWordCloudData).map((t, idx) => (
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
          insight={activeTab === 'weekly' ? weeklyInsight : dailyInsight}
          activeTab={activeTab}
        />
      )}

      {showFullInsightModal && (
        <FullInsightModal
          insight={activeTab === 'weekly' ? weeklyInsight : dailyInsight}
          onClose={() => setShowFullInsightModal(false)}
        />
      )}

      {showHistoryModal && (
        <HistoryInsightModal
          type={historyType}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}

// 历史洞察模态框组件
function HistoryInsightModal({ type, onClose }) {
  const [historyReports, setHistoryReports] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetchHistoryReports();
  }, []);

  const fetchHistoryReports = async () => {
    const userId = 1;
    try {
      const response = await fetch(
        `http://localhost:8080/api/insights/all-history?userId=${userId}&type=${type}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHistoryReports(data.reports);
        }
      }
    } catch (error) {
      console.error('获取历史报告失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{type === 'WEEKLY' ? '周报' : '日报'}历史记录</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <p>加载中...</p>
          ) : historyReports.length === 0 ? (
            <p className="empty-message">暂无历史记录</p>
          ) : (
            <div className="history-list">
              {historyReports.map((report) => (
                <div key={report.id} className="history-item">
                  <div className="history-item-header">
                    <h3>{report.insightTitle}</h3>
                    <span className="history-date">
                      {report.reportDate} (版本 {report.version})
                    </span>
                  </div>
                  <p className="history-summary">{report.insightSummary}</p>
                  <details className="history-details">
                    <summary>查看完整内容</summary>
                    <div className="history-full-text">
                      {report.insightFullText}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 完整洞察模态框组件
function FullInsightModal({ insight, onClose }) {
  if (!insight) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content full-insight-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{insight.insightTitle}</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="full-insight-text">
            {insight.insightFullText}
          </div>
        </div>
      </div>
    </div>
  );
}
