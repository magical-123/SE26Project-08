import React from 'react';
import ReactECharts from 'echarts-for-react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { NutritionLabel } from '../../components/NutritionLabel/NutritionLabel';
import { StatBadge } from '../../components/StatBadge/StatBadge';
import { BookOpen, Zap, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { nutritionData, trendData, aiQuotes, reviewCards } from '../../mock/dashboardData';
import './Dashboard.css';

export function Dashboard() {
  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    grid: { top: 40, right: 20, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: trendData.days,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisLabel: { color: 'rgba(255,255,255,0.6)' }
    },
    yAxis: {
      type: 'value',
      splitLine: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.6)' }
    },
    series: [{
      data: trendData.values,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: {
        color: '#10B981',
        width: 3,
        shadowColor: 'rgba(16,185,129,0.8)',
        shadowBlur: 10
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(16,185,129,0.3)' },
            { offset: 1, color: 'rgba(16,185,129,0)' }
          ]
        }
      }
    }]
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>仪表盘 (Dashboard)</h1>
      </header>

      <div className="stats-row">
        <StatBadge icon={<BookOpen />} label="今日浏览总量" value="12" />
        <StatBadge icon={<Zap />} label="优质信息源" value="4" />
        <StatBadge icon={<Clock />} label="今日沉浸时长" value="2.5" unit="h" />
      </div>

      <div className="bento-grid">
        <div className="bento-nutrition">
          <NutritionLabel data={nutritionData} />
        </div>
        
        <GlassCard className="bento-trend">
          <h3>近期关注点流变趋势</h3>
          <div className="chart-container">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <motion.div whileHover={{ y: -4 }} className="bento-quote">
          <GlassCard className="quote-card">
            <h3>💡 AI 洞察金句</h3>
            <p>{aiQuotes[0]}</p>
          </GlassCard>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bento-review">
          <GlassCard className="review-card">
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
    </div>
  );
}
