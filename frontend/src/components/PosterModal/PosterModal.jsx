import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import ReactECharts from 'echarts-for-react';
import { X, Download } from 'lucide-react';
import './PosterModal.css';

export function PosterModal({ onClose, pieOption, insight, activeTab }) {
  const posterRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 提供默认值，防止 insight 为 null 时报错
  const safeInsight = insight || {
    insightTitle: '暂无洞察',
    insightSummary: '还未生成本期洞察报告',
    title: '暂无洞察', // 兼容旧字段
    summary: '还未生成本期洞察报告' // 兼容旧字段
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `InfoDigest-${activeTab === 'daily' ? '日报' : '周报'}-${new Date().toISOString().slice(0,10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate poster:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderSummary = (text) => {
    if (!text) return '';
    return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  const posterPieOption = {
    ...pieOption,
    animation: false,
    series: [
      {
        ...pieOption.series[0],
        radius: ['40%', '55%'], // Shrink radius to give labels more room
        center: ['50%', '50%']
      }
    ]
  };

  return createPortal(
    <div className="poster-modal-overlay">
      <div className="poster-modal-container">
        <button className="poster-close-btn" onClick={onClose}><X size={24} /></button>
        
        <div className="poster-capture-wrapper">
          <div className="poster-capture-area" ref={posterRef}>
            <div className="poster-header">
              <h2>InfoDigest</h2>
              <p className="poster-date">
                {new Date().toLocaleDateString()} · {activeTab === 'daily' ? '今日洞察' : '本周洞察'}
              </p>
            </div>
            
            <div className="poster-chart">
              <ReactECharts 
                option={posterPieOption} 
                style={{ height: '240px', width: '100%' }} 
              />
            </div>
            
            <div className="poster-insight">
              <h3 className="pi-title">💡 {safeInsight.insightTitle || safeInsight.title}</h3>
              <p className="pi-content">{renderSummary(safeInsight.insightSummary || safeInsight.summary)}</p>
            </div>
            
            <div className="poster-footer">
              <div className="pf-brand">
                <strong>数字饮食报告</strong>
                <span>你的个人信息营养师</span>
              </div>
              <div className="pf-qr">
                <div className="fake-qr-box"></div>
              </div>
            </div>
          </div>
        </div>

        <button 
          className="poster-download-btn" 
          onClick={handleDownload}
          disabled={isGenerating}
        >
          <Download size={18} />
          {isGenerating ? '生成中...' : '保存专属海报'}
        </button>
      </div>
    </div>,
    document.body
  );
}
