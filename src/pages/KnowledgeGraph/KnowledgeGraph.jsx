import React, { useEffect, useRef, useState } from 'react';
import { Graph } from '@antv/g6';
import { DetailDrawer } from '../../components/DetailDrawer/DetailDrawer';
import { graphData } from '../../mock/graphData';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import './KnowledgeGraph.css';

export function KnowledgeGraph() {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Add graph-mode class to root-layout via body to collapse sidebar if we wanted
    // For now, let's just render the graph
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const graph = new Graph({
      container: containerRef.current,
      width,
      height,
      data: graphData,
      layout: {
        type: 'force',
        preventOverlap: true,
        linkDistance: 100,
        nodeStrength: -30,
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
      node: {
        style: (model) => {
          let color = '#0EA5E9';
          if (model.cluster === 'design') color = '#F59E0B';
          if (model.cluster === 'philosophy') color = '#F43F5E';
          return {
            fill: '#fff',
            stroke: color,
            lineWidth: 2,
            shadowColor: 'rgba(0,0,0,0.1)',
            shadowBlur: 10,
            labelPlacement: 'bottom',
            labelText: model.label,
            labelFill: '#111',
            labelBackgroundFill: 'rgba(255,255,255,0.8)',
            labelBackgroundRadius: 4,
            labelPadding: [2, 4]
          };
        },
      },
      edge: {
        style: {
          stroke: 'rgba(0,0,0,0.2)',
          lineWidth: 1,
          lineDash: [4, 4],
        }
      }
    });

    graph.render();
    graphRef.current = graph;

    graph.on('node:click', (e) => {
      const node = graph.getNodeData(e.target.id);
      setSelectedNode({ title: node.label, ...node });
    });

    const handleResize = () => {
      if(containerRef.current && graphRef.current) {
        graphRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      graph.destroy();
    };
  }, []);

  const handleZoomIn = () => graphRef.current?.zoomBy(1.2);
  const handleZoomOut = () => graphRef.current?.zoomBy(0.8);
  const handleFitView = () => graphRef.current?.fitView();

  return (
    <div className="knowledge-graph-page">
      <div className="kg-container" ref={containerRef}></div>
      
      <div className="kg-controls">
        <button onClick={handleZoomIn}><ZoomIn size={18} /></button>
        <button onClick={handleZoomOut}><ZoomOut size={18} /></button>
        <button onClick={handleFitView}><Maximize size={18} /></button>
      </div>

      <DetailDrawer 
        isOpen={!!selectedNode} 
        onClose={() => setSelectedNode(null)} 
        data={selectedNode}
        title={selectedNode?.title}
      />
    </div>
  );
}
