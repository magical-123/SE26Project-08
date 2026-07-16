import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import './NutritionLabel.css';

export function NutritionLabel({ data }) {
  const chartOption = useMemo(() => {
    const chartData = (data || []).map(item => ({
      value: item.value,
      name: item.name,
      itemStyle: item.color ? { color: item.color } : undefined,
    }));

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
          data: chartData
        }
      ]
    };
  }, [data]);

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
