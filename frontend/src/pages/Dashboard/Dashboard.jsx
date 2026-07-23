import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { NutritionLabel } from '../../components/NutritionLabel/NutritionLabel';
import { StatBadge } from '../../components/StatBadge/StatBadge';
import { AIQuoteCard } from '../../components/AIQuoteCard/AIQuoteCard';
import { ReviewModal } from '../../components/ReviewModal/ReviewModal';
import { BookOpen, Zap, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { nutritionData, wordCloudData, aiQuotes, reviewCards } from '../../mock/dashboardData';
import './Dashboard.css';

const API_BASE = 'http://localhost:8080';

function getAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nutritionData, setNutritionData] = useState([]);
  const [wordCloudData, setWordCloudData] = useState([]);
  const [aiQuotes, setAiQuotes] = useState([]);
  const [reviewCards, setReviewCards] = useState([]);
  const [summary, setSummary] = useState({ todayViews: 0, premiumCount: 0, immersionHours: 0 });
  const [realWordCloudData, setRealWordCloudData] = useState(null);
  const [loadingWordCloud, setLoadingWordCloud] = useState(true);
  const [isRegeneratingReview, setIsRegeneratingReview] = useState(false);

  // 获取今日词云数据
  useEffect(() => {
    const fetchWordCloud = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        const response = await fetch('http://localhost:8080/api/dashboard/wordcloud/history', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const historyData = await response.json();
          console.log('[Dashboard 初始加载] API返回历史词云数据:', historyData);
          
          // 聚合近7天的数据
          const aggregatedWords = {};
          if (Array.isArray(historyData)) {
            historyData.forEach(day => {
              if (day.keywords && Array.isArray(day.keywords)) {
                day.keywords.forEach(kw => {
                  const word = kw.word || kw.name;
                  if (aggregatedWords[word]) {
                    aggregatedWords[word] += kw.value;
                  } else {
                    aggregatedWords[word] = kw.value;
                  }
                });
              }
            });
          }
          
          const wordCloudData = Object.keys(aggregatedWords).map(key => ({
            name: key,
            value: aggregatedWords[key]
          }));

          if (wordCloudData && wordCloudData.length > 0) {
            setRealWordCloudData(wordCloudData);
            console.log('[Dashboard 初始加载] 成功聚合近7天词云数据:', wordCloudData.length, '个词');
          } else {
            console.log('[Dashboard 初始加载] 词云数据为空，realWordCloudData保持为null');
          }
        } else {
          console.error('[Dashboard 初始加载] API请求失败:', response.status);
        }
      } catch (error) {
        console.error('[词云] 获取失败:', error);
      } finally {
        setLoadingWordCloud(false);
      }
    };

    fetchWordCloud();
  }, []);

  // 监听Report页面的词云更新通知 + 页面进入时立即检查
  useEffect(() => {
    const fetchWordCloud = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (!token) return;

        console.log('[Dashboard] 开始获取最新词云数据...');
        const response = await fetch('http://localhost:8080/api/dashboard/wordcloud/history', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const historyData = await response.json();
          console.log('[Dashboard] 收到历史词云数据:', historyData);
          
          const aggregatedWords = {};
          if (Array.isArray(historyData)) {
            historyData.forEach(day => {
              if (day.keywords && Array.isArray(day.keywords)) {
                day.keywords.forEach(kw => {
                  const word = kw.word || kw.name;
                  if (aggregatedWords[word]) {
                    aggregatedWords[word] += kw.value;
                  } else {
                    aggregatedWords[word] = kw.value;
                  }
                });
              }
            });
          }
          
          const wordCloudData = Object.keys(aggregatedWords).map(key => ({
            name: key,
            value: aggregatedWords[key]
          }));

          if (wordCloudData && wordCloudData.length > 0) {
            setRealWordCloudData(wordCloudData);
            console.log('[Dashboard] 词云数据已更新，聚合了近7天数据，触发重新渲染');
          } else {
            console.log('[Dashboard] 词云数据为空');
          }
        } else {
          console.error('[Dashboard] 词云API响应失败:', response.status);
        }
      } catch (error) {
        console.error('[词云] 刷新失败:', error);
      }
    };

    const checkWordCloudUpdate = () => {
      const lastUpdate = sessionStorage.getItem('dashboard:wordcloudUpdated');
      if (lastUpdate) {
        console.log('[Dashboard] 检测到词云更新通知:', lastUpdate);
        // 清除标记并重新获取词云数据
        sessionStorage.removeItem('dashboard:wordcloudUpdated');
        fetchWordCloud();
      }
    };

    // 页面加载时立即检查一次是否有待处理的更新通知
    checkWordCloudUpdate();

    // 每2秒检查一次是否有更新通知
    const interval = setInterval(checkWordCloudUpdate, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = getAuthHeaders();
        const [nutritionRes, wordcloudRes, insightsRes, reviewsRes, summaryRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard/nutrition`, { headers }),
          fetch(`${API_BASE}/api/dashboard/wordcloud`, { headers }),
          fetch(`${API_BASE}/api/dashboard/insights`, { headers }),
          fetch(`${API_BASE}/api/dashboard/reviews/today`, { headers }),
          fetch(`${API_BASE}/api/dashboard/summary`, { headers }),
        ]);

        if (!nutritionRes.ok || !wordcloudRes.ok || !insightsRes.ok || !reviewsRes.ok || !summaryRes.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const nutrition = await nutritionRes.json();
        const wordcloud = await wordcloudRes.json();
        const insights = await insightsRes.json();
        const reviews = await reviewsRes.json();
        const summaryData = await summaryRes.json();

        setNutritionData(nutrition.data || nutrition);

        // 转换词云数据格式: {word, value} -> {name, value}
        const formattedWordCloud = Array.isArray(wordcloud)
          ? wordcloud.map(item => ({
              name: item.word || item.name,
              value: item.value
            }))
          : [];
        console.log('[Dashboard] 词云数据:', formattedWordCloud);
        setWordCloudData(formattedWordCloud);

        setAiQuotes(insights);
        setReviewCards(reviews);
        setSummary(summaryData);
      } catch (error) {
        console.error('Dashboard data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 刷新洞察数据
  const refreshInsights = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/dashboard/insights`, { headers });
      if (response.ok) {
        const insights = await response.json();
        setAiQuotes(insights);
      }
    } catch (error) {
      console.error('Failed to refresh insights:', error);
    }
  };

  // 刷新复习卡片
  const refreshReviewCards = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/dashboard/reviews/today`, { headers });
      if (response.ok) {
        const reviews = await response.json();
        setReviewCards(reviews);
      }
    } catch (error) {
      console.error('Failed to refresh review cards:', error);
    }
  };

  // 重新生成复习卡片
  const handleRegenerateReview = async (e) => {
    e.stopPropagation(); // 防止触发卡片点击
    setIsRegeneratingReview(true);

    try {
      const response = await fetch(`${API_BASE}/api/dashboard/reviews/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        await refreshReviewCards();
      } else {
        console.error('Failed to regenerate review card');
      }
    } catch (error) {
      console.error('Error regenerating review card:', error);
    } finally {
      setIsRegeneratingReview(false);
    }
  };

  const wordCloudOption = useMemo(() => {
    const cloudData = realWordCloudData || wordCloudData;
    const hasData = cloudData && cloudData.length > 0;

    // 转换数据格式：{word, value} -> {name, value}
    const formattedData = hasData
      ? cloudData.map(item => ({
          name: item.word || item.name,
          value: item.value
        }))
      : [];

    console.log('[Dashboard] wordCloudOption 重新计算:', {
      realWordCloudData: realWordCloudData?.length,
      wordCloudData: wordCloudData?.length,
      hasData,
      原始数据: cloudData?.slice(0, 2),
      转换后数据: formattedData?.slice(0, 2)
    });

    return {
      backgroundColor: 'transparent',
      tooltip: { show: hasData },
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
        sizeRange: [12, 40],
        rotationRange: [-45, 45],
        rotationStep: 45,
        gridSize: 8,
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
        data: formattedData
      }]
    };
  }, [realWordCloudData, wordCloudData]);

  // Transform nutrition API data: keep original format for NutritionLabel
  const transformedNutritionData = useMemo(() => {
    return nutritionData.map(item => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.itemStyle?.color
      }
    }));
  }, [nutritionData]);

  if (loading) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <h1>仪表盘 (Dashboard)</h1>
        </header>
        <div className="dashboard-loading">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>仪表盘 (Dashboard)</h1>
      </header>

      <div className="stats-row">
        <StatBadge icon={<BookOpen />} label="浏览总量" value={summary.todayViews} onClick={() => navigate('/inbox')} />
        <StatBadge icon={<Zap />} label="优质信息源" value={summary.premiumCount} onClick={() => navigate('/graph')} />
        <StatBadge icon={<Clock />} label="今日浏览时长" value={summary.immersionHours} unit="h" onClick={() => navigate('/report')} />
      </div>

      <div className="bento-grid">
        <div className="bento-nutrition" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <NutritionLabel data={transformedNutritionData} />
        </div>
        
        <GlassCard className="bento-trend" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <h3>近期关注点流变</h3>
          <div className="chart-container">
            {(realWordCloudData && realWordCloudData.length > 0) || (wordCloudData && wordCloudData.length > 0) ? (
              <ReactECharts option={wordCloudOption} style={{ height: '100%', width: '100%' }} />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                fontSize: '14px'
              }}>
                暂无词云数据
              </div>
            )}
          </div>
        </GlassCard>

        <div className="bento-quote">
          {aiQuotes.length > 0 && <AIQuoteCard quote={aiQuotes[0]} onRefresh={refreshInsights} />}
        </div>

        <motion.div whileHover={{ y: -4 }} className="bento-review">
          <GlassCard className="review-card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setIsReviewOpen(true)}>
            <div className="rc-header">
              <h3>待复习卡片</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="rc-badge">记忆曲线</span>
                <button
                  className="regenerate-btn-review"
                  onClick={handleRegenerateReview}
                  disabled={isRegeneratingReview}
                  title="重新生成复习卡片"
                >
                  <RefreshCw size={16} className={isRegeneratingReview ? 'spinning' : ''} />
                </button>
              </div>
            </div>
            {reviewCards.length > 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4>{reviewCards[0].title}</h4>
                <div className="rc-footer" style={{ marginTop: 'auto' }}>{reviewCards[0].source}</div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      <AnimatePresence>
        {isReviewOpen && (
          <ReviewModal cards={reviewCards} onClose={() => setIsReviewOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
