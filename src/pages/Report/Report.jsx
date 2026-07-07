import React from 'react';
import ReactECharts from 'echarts-for-react';
import { GlassCard } from '../../components/GlassCard/GlassCard';
import { reportData } from '../../mock/reportData';
import { Download } from 'lucide-react';
import './Report.css';

export function Report() {
  const pieOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: { show: true, position: 'outside', color: '#444', fontWeight: 'bold' },
        labelLine: { show: true, lineStyle: { color: '#888' } },
        data: [
          { value: 35, name: '深度知识', itemStyle: { color: '#0EA5E9' } },
          { value: 45, name: '娱乐短剧', itemStyle: { color: '#F43F5E' } },
          { value: 15, name: '行业资讯', itemStyle: { color: '#F59E0B' } },
          { value: 5, name: '创意灵感', itemStyle: { color: '#10B981' } }
        ]
      }
    ]
  };

  const lineOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: reportData.trend.map(d => d.date),
      axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
      axisLabel: { color: '#666' }
    },
    yAxis: {
      type: 'value',
      splitLine: { show: true, lineStyle: { color: 'rgba(0,0,0,0.05)' } },
      axisLabel: { color: '#666' }
    },
    series: [{
      data: reportData.trend.map(d => d.value),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#0EA5E9', width: 3 }
    }]
  };

  return (
    <div className="report-page">
      <header className="report-header">
        <h1>数字饮食报告</h1>
        <div className="report-tabs">
          <button className="active">周报</button>
          <button>日报</button>
        </div>
      </header>

      <div className="report-grid">
        <GlassCard className="report-card pie-card">
          <h3>营养分类占比</h3>
          <div className="chart-box">
            <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <GlassCard className="report-card trend-card">
          <h3>关注度流变</h3>
          <div className="chart-box">
            <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </GlassCard>

        <GlassCard className="report-card topics-card">
          <h3>高频话题聚类</h3>
          <ul className="topic-list">
            {reportData.topicClusters.map((cluster, i) => (
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
        <button className="share-btn">
          <Download size={16} />
          生成分享海报
        </button>
      </div>
    </div>
  );
}
