import React, { useMemo, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import './NutritionLabel.css';

export function NutritionLabel() {
  const [nutritionData, setNutritionData] = useState({
    protein: 0,
    carbs: 0,
    vitamins: 0,
    fats: 0,
    fiber: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNutritionStats();
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
      } else {
        console.error('获取营养统计失败');
      }
    } catch (error) {
      console.error('获取营养统计出错:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const chartOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: 'rgba(0,0,0,0.1)',
        textStyle: { color: '#111', fontWeight: 'bold' },
        formatter: '{b}: {d}%'
      },
      legend: {
        orient: 'horizontal',
        bottom: '0',
        left: 'center',
        itemGap: 20,
        textStyle: {
          color: '#111',
          fontSize: 13,
          fontWeight: 'bold',
          fontFamily: 'Inter'
        }
      },
      series: [
        {
          name: '营养成分',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '40%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 20,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              color: '#111',
              formatter: '{d}%'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            {
              value: nutritionData.protein,
              name: '蛋白质（深度认知）',
              itemStyle: { color: 'rgba(14, 165, 233, 0.8)' }
            },
            {
              value: nutritionData.carbs,
              name: '碳水（实用技能）',
              itemStyle: { color: 'rgba(16, 185, 129, 0.8)' }
            },
            {
              value: nutritionData.vitamins,
              name: '维生素（创意灵感）',
              itemStyle: { color: 'rgba(245, 158, 11, 0.8)' }
            },
            {
              value: nutritionData.fats,
              name: '脂肪（纯娱乐）',
              itemStyle: { color: 'rgba(244, 63, 94, 0.8)' }
            },
            {
              value: nutritionData.fiber,
              name: '纤维（哲思）',
              itemStyle: { color: 'rgba(139, 92, 246, 0.8)' }
            }
          ]
        }
      ]
    };
  }, [nutritionData]);

  return (
    <div className="nutrition-label glass-panel">
      <div className="nl-header">
        <h2>数字营养成分</h2>
        <p>基于您已分析的视频内容</p>
      </div>

      <div className="nl-chart-container">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p>加载中...</p>
          </div>
        ) : (
          <ReactECharts
            option={chartOption}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
          />
        )}
      </div>

      <div className="nutrition-footer">
        * 饼图展示了您所有已分析视频的五维度营养平均分布
      </div>
    </div>
  );
}
