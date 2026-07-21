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
import { wordCloudApi } from '../../utils/api';
import './Dashboard.css';

const API_BASE = 'http://localhost:8080';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
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

  // 获取今日词云数据（从增强的 report 后端 API）
  useEffect(() => {
    const fetchWordCloud = async () => {
      try {
        const username = localStorage.getItem('username');
        if (!username) return;

        const userId = 1; // TODO: 从用户信息中获取真实的userId
        const today = new Date().toISOString().split('T')[0];

        const response = await wordCloudApi.getDaily(userId, today);

        if (response.success && response.data && response.data.keywords) {
          const keywords = Array.isArray(response.data.keywords)
            ? response.data.keywords
            : JSON.parse(response.data.keywords);

          const formattedData = keywords.map(item => ({
            name: item.word,
            value: item.value
          }));

          setRealWordCloudData(formattedData);
        }
      } catch (error) {
        console.error('[词云] 获取失败:', error);
      } finally {
        setLoadingWordCloud(false);
      }
    };

    fetchWordCloud();
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
        setWordCloudData(wordcloud);
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

  const wordCloudOption = useMemo(() => ({
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
      data: realWordCloudData || wordCloudData
    }]
  }), [realWordCloudData, wordCloudData]);

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
        <StatBadge icon={<BookOpen />} label="今日浏览总量" value={summary.todayViews} onClick={() => navigate('/inbox')} />
        <StatBadge icon={<Zap />} label="优质信息源" value={summary.premiumCount} onClick={() => navigate('/graph')} />
        <StatBadge icon={<Clock />} label="今日沉浸时长" value={summary.immersionHours} unit="h" onClick={() => navigate('/report')} />
      </div>

      <div className="bento-grid">
        <div className="bento-nutrition" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <NutritionLabel data={transformedNutritionData} />
        </div>
        
        <GlassCard className="bento-trend" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <h3>近期关注点流变</h3>
          <div className="chart-container">
            <ReactECharts option={wordCloudOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <div className="bento-quote">
          {aiQuotes.length > 0 && <AIQuoteCard quote={aiQuotes[0]} onRefresh={refreshInsights} />}
        </div>

        <motion.div whileHover={{ y: -4 }} className="bento-review">
          <GlassCard className="review-card" style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="rc-header">
              <h3 onClick={() => setIsReviewOpen(true)}>待复习卡片</h3>
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
              <div onClick={() => setIsReviewOpen(true)}>
                <h4>{reviewCards[0].title}</h4>
                <p>{reviewCards[0].content}</p>
                <div className="rc-footer">{reviewCards[0].source}</div>
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
