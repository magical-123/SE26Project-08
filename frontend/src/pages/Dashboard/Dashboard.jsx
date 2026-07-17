import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { NutritionLabel } from '../../components/NutritionLabel/NutritionLabel';
import { StatBadge } from '../../components/StatBadge/StatBadge';
import { AIQuoteCard } from '../../components/AIQuoteCard/AIQuoteCard';
import { ReviewModal } from '../../components/ReviewModal/ReviewModal';
import { BookOpen, Zap, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { nutritionData, wordCloudData, aiQuotes, reviewCards } from '../../mock/dashboardData';
import { wordCloudApi } from '../../utils/api';
import './Dashboard.css';

export function Dashboard() {
  const navigate = useNavigate();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [realWordCloudData, setRealWordCloudData] = useState(null);
  const [loadingWordCloud, setLoadingWordCloud] = useState(true);

  // 获取今日词云数据
  useEffect(() => {
    const fetchWordCloud = async () => {
      try {
        const username = localStorage.getItem('username');
        console.log('[词云] 开始获取数据, username:', username);

        if (!username) {
          console.log('[词云] 未找到username，跳过获取');
          return;
        }

        // 获取用户ID（这里假设username就是userId，或者需要从其他API获取）
        const userId = 1; // TODO: 从用户信息中获取真实的userId
        const today = new Date().toISOString().split('T')[0]; // 格式: YYYY-MM-DD

        console.log('[词云] 请求参数:', { userId, today });

        const response = await wordCloudApi.getDaily(userId, today);
        console.log('[词云] API响应:', response);

        if (response.success && response.data && response.data.keywords) {
          // 将后端数据格式转换为ECharts需要的格式
          // keywords已经是数组，不需要JSON.parse
          const keywords = Array.isArray(response.data.keywords)
            ? response.data.keywords
            : JSON.parse(response.data.keywords);

          console.log('[词云] 解析后的keywords:', keywords);

          const formattedData = keywords.map(item => ({
            name: item.word,
            value: item.value
          }));
          console.log('[词云] 格式化后的数据:', formattedData);

          setRealWordCloudData(formattedData);
        } else {
          console.log('[词云] 响应数据格式不正确或无数据');
        }
      } catch (error) {
        console.error('[词云] 获取失败:', error);
        // 如果获取失败，使用mock数据
      } finally {
        setLoadingWordCloud(false);
      }
    };

    fetchWordCloud();
  }, []);

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
  }), [realWordCloudData]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>仪表盘 (Dashboard)</h1>
      </header>

      <div className="stats-row">
        <StatBadge icon={<BookOpen />} label="今日浏览总量" value="12" onClick={() => navigate('/inbox')} />
        <StatBadge icon={<Zap />} label="优质信息源" value="4" onClick={() => navigate('/graph')} />
        <StatBadge icon={<Clock />} label="今日沉浸时长" value="2.5" unit="h" onClick={() => navigate('/report')} />
      </div>

      <div className="bento-grid">
        <div className="bento-nutrition" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <NutritionLabel data={nutritionData} />
        </div>
        
        <GlassCard className="bento-trend" onClick={() => navigate('/report')} style={{ cursor: 'pointer' }}>
          <h3>近期关注点流变</h3>
          <div className="chart-container">
            <ReactECharts option={wordCloudOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <div className="bento-quote">
          <AIQuoteCard quote={aiQuotes[0]} />
        </div>

        <motion.div whileHover={{ y: -4 }} className="bento-review" onClick={() => setIsReviewOpen(true)}>
          <GlassCard className="review-card" style={{ cursor: 'pointer' }}>
            <div className="rc-header">
              <h3>待复习卡片</h3>
              <span className="rc-badge">记忆曲线</span>
            </div>
            <h4>{reviewCards[0].title}</h4>
            <p>{reviewCards[0].content}</p>
            <div className="rc-footer">{reviewCards[0].source}</div>
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
