import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import './NutritionLabel.css';

export function NutritionLabel() {
  const chartOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: 'rgba(0,0,0,0.1)',
        textStyle: { color: '#111', fontWeight: 'bold' }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
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
          name: 'Time Value',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
            // Deep shadows for 3D glassy feel
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
              value: 35, 
              name: '深度知识',
              itemStyle: { color: 'rgba(14, 165, 233, 0.8)' } // Technology Blue
            },
            { 
              value: 45, 
              name: '娱乐短剧',
              itemStyle: { color: 'rgba(244, 63, 94, 0.8)' } // Rose / Accent
            },
            { 
              value: 15, 
              name: '行业资讯',
              itemStyle: { color: 'rgba(245, 158, 11, 0.8)' } // Amber
            },
            { 
              value: 5, 
              name: '创意灵感',
              itemStyle: { color: 'rgba(16, 185, 129, 0.8)' } // Emerald
            }
          ]
        }
      ]
    };
  }, []);

  return (
    <div className="nutrition-label glass-panel">
      <div className="nl-header">
        <h2>Time Allocation</h2>
        <p>Serving Size: 1 week (7 days)</p>
      </div>

      <div className="nl-chart-container">
        <ReactECharts 
          option={chartOption} 
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </div>

      <div className="nutrition-footer">
        * 饼图展示了您本周内的信息摄入比例。
      </div>
    </div>
  );
}
