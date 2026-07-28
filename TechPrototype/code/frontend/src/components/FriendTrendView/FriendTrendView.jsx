import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';
import { X, Loader2 } from 'lucide-react';
import './FriendTrendView.css';

const API_BASE = 'http://localhost:8080';

function getAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return { Authorization: `Bearer ${token}` };
}

export function FriendTrendView({ friendId, friendName, onClose }) {
  const [nutritionData, setNutritionData] = useState([]);
  const [wordCloudData, setWordCloudData] = useState([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const headers = getAuthHeaders();
    Promise.all([
      fetch(`${API_BASE}/api/social/report/${friendId}/nutrition`, { headers }).then(r => {
        if (!r.ok) throw new Error('无法获取数据');
        return r.json();
      }),
      fetch(`${API_BASE}/api/social/report/${friendId}/wordcloud`, { headers }).then(r => {
        if (!r.ok) throw new Error('无法获取数据');
        return r.json();
      }),
    ])
      .then(([nutritionRes, wordCloudRes]) => {
        setNutritionData(nutritionRes.data || []);
        setTotalHours(nutritionRes.totalHours || 0);
        setWordCloudData(wordCloudRes || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [friendId]);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      avoidLabelOverlap: true,
      padAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        fontSize: 11,
        fontWeight: 600,
        color: '#333',
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      data: nutritionData,
    }],
  }), [nutritionData]);

  const wordCloudOption = useMemo(() => {
    const cloudData = wordCloudData.map(item => ({
      name: item.word,
      value: item.value,
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: { show: true, formatter: '{b}: {c}' },
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
        data: cloudData,
      }]
    };
  }, [wordCloudData]);

  return (
    <div className="ftv-overlay" onClick={onClose}>
      <div className="ftv-modal" onClick={e => e.stopPropagation()}>
        <div className="ftv-header">
          <h2 className="ftv-title">{friendName} 的浏览趋势</h2>
          <div className="ftv-header-actions">
            <button className="ftv-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="ftv-body">
          {loading && (
            <div className="ftv-loading">
              <Loader2 size={24} className="ftv-spin" />
              <span>加载中...</span>
            </div>
          )}

          {error && (
            <div className="ftv-empty">{error}</div>
          )}

          {!loading && !error && (
            <div className="ftv-content">
              {/* 营养分类饼图 */}
              <div className="ftv-section">
                <h3 className="ftv-section-title">营养分类占比</h3>
                {nutritionData.length > 0 ? (
                  <div className="ftv-chart-row">
                    <div className="ftv-pie-wrapper">
                      <ReactECharts option={pieOption} style={{ height: 240, width: '100%' }} />
                    </div>
                    <div className="ftv-nutrition-info">
                      <div className="ftv-total-hours">
                        <span className="ftv-hours-label">总摄入时长</span>
                        <span className="ftv-hours-value">{totalHours.toFixed(1)}h</span>
                      </div>
                      <div className="ftv-nutrition-list">
                        {nutritionData.map(n => (
                          <div key={n.name} className="ftv-nutrition-item">
                            <span className="ftv-nutrition-dot" style={{ background: n.itemStyle?.color || '#999' }} />
                            <span className="ftv-nutrition-name">{n.name}</span>
                            <span className="ftv-nutrition-value">{n.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ftv-no-data">暂无营养数据</div>
                )}
              </div>

              {/* 词云 */}
              <div className="ftv-section">
                <h3 className="ftv-section-title">今日高频话题</h3>
                {wordCloudData.length > 0 ? (
                  <div className="ftv-wordcloud-wrapper">
                    <ReactECharts option={wordCloudOption} style={{ height: 300, width: '100%' }} />
                  </div>
                ) : (
                  <div className="ftv-no-data">暂无词云数据</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
