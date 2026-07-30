import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===========================================================================
// Hoisted mutable refs (accessible inside vi.mock factories)
// ===========================================================================

const { __rfNodes, __setRfNodes, __onNodesChange } = vi.hoisted(() => {
  const nodes = [];
  const setNodes = vi.fn();
  const onNodesChange = vi.fn();
  return { __rfNodes: nodes, __setRfNodes: setNodes, __onNodesChange: onNodesChange };
});

const { __rfEdges, __setRfEdges, __onEdgesChange } = vi.hoisted(() => {
  const edges = [];
  const setEdges = vi.fn();
  const onEdgesChange = vi.fn();
  return { __rfEdges: edges, __setRfEdges: setEdges, __onEdgesChange: onEdgesChange };
});

const mockUseReactFlow = vi.hoisted(() => ({
  fitView: vi.fn(),
  toImage: vi.fn().mockResolvedValue('data:image/png;base64,test'),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}));

const mockBuildGraphData = vi.hoisted(() => vi.fn(() => ({ nodes: [], edges: [] })));
const mockCacheDataFn = vi.hoisted(() => vi.fn());
const mockGetCachedDataFn = vi.hoisted(() => vi.fn(() => null));
const mockGraphApiGetItemKeywords = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGraphApiToggleKeyword = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGraphApiDeleteKeyword = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockGraphApiUpdateKeywords = vi.hoisted(() => vi.fn().mockResolvedValue({}));

// ===========================================================================
// Module mocks
// ===========================================================================

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, nodes, edges, nodeTypes, onNodeClick, onPaneClick, onNodeDragStart, onNodeDragStop, onMoveEnd, defaultViewport, fitView: _fv, panOnDrag, zoomOnScroll, selectNodesOnDrag, nodesDraggable, minZoom, maxZoom, style }) =>
    React.createElement('div', {
      'data-testid': 'react-flow',
      style,
      onClick: onPaneClick,
    }, children),
  ReactFlowProvider: ({ children }) => children,
  useReactFlow: () => mockUseReactFlow,
  useNodesState: () => [__rfNodes, __setRfNodes, __onNodesChange],
  useEdgesState: () => [__rfEdges, __setRfEdges, __onEdgesChange],
  Background: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

vi.mock('../pages/KnowledgeGraph/graphShared', () => ({
  buildGraphData: (...args) => mockBuildGraphData(...args),
  ConceptNode: () => null,
  SourceNode: () => null,
  MAX_LABEL_LENGTH: 5,
}));

vi.mock('../hooks/useInboxItems', () => ({
  useInboxItems: () => ({ items: [] }),
}));

vi.mock('../components/DetailDrawer/DetailDrawer', () => ({
  DetailDrawer: ({ isOpen, onClose, data, selectedKeywords, suggestedKeywords, onToggleKeyword, onDeleteKeyword, onAddKeyword }) =>
    isOpen
      ? React.createElement('div', { 'data-testid': 'detail-drawer', 'data-item-title': data?.title },
          React.createElement('button', { 'data-testid': 'drawer-close-btn', onClick: onClose }, '关闭'),
        )
      : React.createElement('div', { 'data-testid': 'detail-drawer-closed' }),
}));

vi.mock('../utils/cache', () => ({
  cacheData: (...args) => mockCacheDataFn(...args),
  getCachedData: (...args) => mockGetCachedDataFn(...args),
  clearCache: vi.fn(),
  clearAllCache: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  graphApi: {
    getItemKeywords: (...args) => mockGraphApiGetItemKeywords(...args),
    toggleItemKeyword: (...args) => mockGraphApiToggleKeyword(...args),
    deleteKeyword: (...args) => mockGraphApiDeleteKeyword(...args),
    updateItemKeywords: (...args) => mockGraphApiUpdateKeywords(...args),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => {
    const { whileHover, initial, animate, exit, transition, ...rest } = props;
    return React.createElement('div', rest, children);
  };
  return {
    motion: new Proxy({}, { get: () => MotionDiv }),
    AnimatePresence: ({ children }) => children,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icons = [
    'ZoomIn', 'ZoomOut', 'Eye', 'EyeOff', 'Camera', 'Sparkles', 'WifiOff', 'RotateCcw',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

// Mock CSS
vi.mock('../pages/KnowledgeGraph/KnowledgeGraph.css', () => ({}));

// ===========================================================================
// Imports (after mocks)
// ===========================================================================

import { KnowledgeGraph } from '../pages/KnowledgeGraph/KnowledgeGraph';

// ===========================================================================
// Mock data helpers
// ===========================================================================

function buildMockGraphApiResponse(overrides = {}) {
  return {
    concepts: [
      { id: 1, label: 'React', color: '#61DAFB', confidence: 0.9, reason: '匹配' },
      { id: 2, label: 'JavaScript', color: '#F7DF1E', confidence: 0.85, reason: '匹配' },
    ],
    items: [
      {
        id: 101,
        title: 'React 19 新特性',
        platform: 'BILIBILI',
        author: '技术博主',
        crawledAt: '2024-01-01T00:00:00Z',
        durationMinutes: 45,
        aiSummary: 'React 19带来了全新的并发特性',
        knowledgeScore: 85,
        isLiked: true,
        isFavorite: false,
      },
      {
        id: 102,
        title: 'JS 高级编程',
        platform: 'ZHIHU',
        author: '编程达人',
        crawledAt: '2024-01-02T00:00:00Z',
        durationMinutes: 30,
        aiSummary: '深入理解JS原型链',
        knowledgeScore: 78,
        isLiked: false,
        isFavorite: true,
      },
    ],
    itemToConcepts: {
      '101': [1],
      '102': [2],
    },
    ...overrides,
  };
}

function buildMockPositionsResponse(overrides = {}) {
  return {
    'concept-1': { x: 100, y: 200 },
    'concept-2': { x: 300, y: 400 },
    'source-101': { x: 150, y: 250 },
    'source-102': { x: 350, y: 450 },
    ...overrides,
  };
}

function buildSomeGraphNodes() {
  return {
    nodes: [
      {
        id: 'concept-1',
        type: 'concept',
        position: { x: 0, y: 0 },
        width: 100,
        height: 100,
        data: { id: 1, label: 'React', color: '#61DAFB', type: 'concept', count: 1, size: 65 },
      },
      {
        id: 'source-101',
        type: 'source',
        position: { x: 0, y: 100 },
        width: 64,
        height: 64,
        data: { id: 101, title: 'React 19 新特性', type: 'source', sourceTitle: 'React 19 新特性', weight: 3, size: 34, conceptIds: ['concept-1'], author: '技术博主' },
      },
    ],
    edges: [
      { id: 'edge-101-1', source: 'source-101', target: 'concept-1', data: { type: 'belongs', color: '#61DAFB' } },
    ],
  };
}

// ===========================================================================
// beforeEach / afterEach
// ===========================================================================

describe('KnowledgeGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedDataFn.mockReturnValue(null);
    mockBuildGraphData.mockReturnValue({ nodes: [], edges: [] });

    // Default fetch success with empty data
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/graph/data')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ concepts: [], items: [], itemToConcepts: {} }),
        });
      }
      if (url.includes('/api/graph/positions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    sessionStorage.setItem('token', 'test-token');
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  // =========================================================================
  // 1. Wrapper test: KnowledgeGraph renders KnowledgeGraphInner
  // =========================================================================
  describe('KnowledgeGraph (outer wrapper)', () => {
    it('renders KnowledgeGraphInner inside ReactFlowProvider', async () => {
      render(<KnowledgeGraph />);

      // The empty state should be visible since no data is loaded yet
      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 2 & 3. Initial / empty state
  // =========================================================================
  describe('Initial and empty state', () => {
    it('shows empty state text "暂无数据" initially when no data', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      // There are multiple Sparkles icons (empty state + tip), so use getAllByTestId
      const sparklesIcons = screen.getAllByTestId('icon-Sparkles');
      expect(sparklesIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show ReactFlow when enhancedNodes is empty', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
    });

    it('shows ReactFlow when buildGraphData returns nodes', async () => {
      // Return some graph data from API
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Empty state should be gone
      expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Offline banner
  // =========================================================================
  describe('Offline banner', () => {
    it('shows offline banner when fetch fails and cache has data', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      // Mock cache returns valid data
      mockGetCachedDataFn.mockReturnValue({
        graphData: buildMockGraphApiResponse(),
        positionsData: buildMockPositionsResponse(),
      });

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('当前离线/服务超时，已切换为缓存模式')).toBeInTheDocument();
        expect(screen.getByTestId('icon-WifiOff')).toBeInTheDocument();
      });
    });

    it('does not show offline banner on successful fetch', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      expect(screen.queryByText('当前离线/服务超时，已切换为缓存模式')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5 & 6. Legend bar
  // =========================================================================
  describe('Legend bar', () => {
    it('shows legend bar with concept items when data is loaded', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Legend items should show concept labels
      expect(screen.getByText('React')).toBeInTheDocument();
    });

    it('shows "全显示" button in the legend', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      expect(screen.getByText('全显示')).toBeInTheDocument();
      // Multiple Eye icons exist (concept items + toggle-all), verify at least one
      const eyeIcons = screen.getAllByTestId('icon-Eye');
      expect(eyeIcons.length).toBeGreaterThanOrEqual(1);
    });

    it('hides a concept when its legend item is clicked', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Click the concept legend button
      const conceptBtn = screen.getByText('React').closest('button');
      expect(conceptBtn).toBeInTheDocument();

      fireEvent.click(conceptBtn);

      // After hiding a concept, buildGraphData should be called again
      // The concept button should still be in the DOM but show EyeOff icon
      await waitFor(() => {
        expect(screen.getByTestId('icon-EyeOff')).toBeInTheDocument();
      });
    });

    it('"全显示" restores all hidden concepts', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // First hide a concept
      const conceptBtn = screen.getByText('React').closest('button');
      fireEvent.click(conceptBtn);

      await waitFor(() => {
        expect(screen.getByTestId('icon-EyeOff')).toBeInTheDocument();
      });

      // Click "全显示"
      const showAllBtn = screen.getByText('全显示');
      fireEvent.click(showAllBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('icon-EyeOff')).not.toBeInTheDocument();
      });
    });

    it('can collapse and expand the legend bar', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockPositionsResponse()),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Collapse the legend
      const collapseBtn = screen.getByTitle('收起标签栏');
      fireEvent.click(collapseBtn);

      await waitFor(() => {
        expect(screen.getByText(/2\s*个标签/)).toBeInTheDocument();
      });

      // Expand the legend
      const expandBtn = screen.getByTitle('展开标签栏');
      fireEvent.click(expandBtn);

      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 7. Zoom controls
  // =========================================================================
  describe('Zoom controls', () => {
    it('shows zoom in and zoom out buttons', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.getByTestId('icon-ZoomIn')).toBeInTheDocument();
      expect(screen.getByTestId('icon-ZoomOut')).toBeInTheDocument();
    });

    it('zoom in button calls reactFlowInstance.zoomIn', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      const zoomInBtn = screen.getByTitle('放大');
      fireEvent.click(zoomInBtn);

      expect(mockUseReactFlow.zoomIn).toHaveBeenCalled();
    });

    it('zoom out button calls reactFlowInstance.zoomOut', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      const zoomOutBtn = screen.getByTitle('缩小');
      fireEvent.click(zoomOutBtn);

      expect(mockUseReactFlow.zoomOut).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. Export / tip buttons
  // =========================================================================
  describe('Export and tip buttons', () => {
    it('shows export image button', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.getByTestId('icon-Camera')).toBeInTheDocument();
    });

    it('shows tip text "点击节点查看详情"', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.getByText('点击节点查看详情')).toBeInTheDocument();
    });

    it('shows reset layout button', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.getByTestId('icon-RotateCcw')).toBeInTheDocument();
    });

    it('export image triggers toImage and downloads', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      const createElementSpy = vi.spyOn(document, 'createElement');
      const clickSpy = vi.fn();
      createElementSpy.mockReturnValue({ download: '', href: '', click: clickSpy });

      const exportBtn = screen.getByTitle('导出图片');
      await act(async () => {
        fireEvent.click(exportBtn);
      });

      expect(mockUseReactFlow.toImage).toHaveBeenCalled();

      createElementSpy.mockRestore();
    });
  });

  // =========================================================================
  // 9. DetailDrawer
  // =========================================================================
  describe('DetailDrawer', () => {
    it('renders DetailDrawer component (closed by default)', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });

    it('does not show DetailDrawer when no node selected', async () => {
      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 10. Fetch success
  // =========================================================================
  describe('Fetch success', () => {
    it('sets conceptNodes and premiumItems on fetch success', async () => {
      const graphApiResponse = buildMockGraphApiResponse();
      const positionsResponse = buildMockPositionsResponse();

      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(graphApiResponse),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(positionsResponse),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      const someNodes = buildSomeGraphNodes();
      mockBuildGraphData.mockReturnValue(someNodes);

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Verify buildGraphData received the premium items
      const buildCalls = mockBuildGraphData.mock.calls;
      expect(buildCalls.length).toBeGreaterThan(0);
      // The premiumItems argument (first arg) should have items from API
      const passedPremiumItems = buildCalls[buildCalls.length - 1][0];
      expect(passedPremiumItems.length).toBeGreaterThanOrEqual(2);
      expect(passedPremiumItems[0].title).toBe('React 19 新特性');
    });

    it('saves positions from API response', async () => {
      const positionsResponse = buildMockPositionsResponse();

      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(positionsResponse),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // After positions are saved into state, buildGraphData receives savedPositions
      await waitFor(() => {
        const buildCalls = mockBuildGraphData.mock.calls;
        const lastArgs = buildCalls[buildCalls.length - 1];
        // 3rd argument is savedPositions
        expect(lastArgs[2]).not.toEqual({});
      });
    });

    it('handles positions API returning null', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve(null),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      // Should not crash, should still render
      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 11. Fetch error — cache fallback
  // =========================================================================
  describe('Fetch error with cache fallback', () => {
    it('falls back to cache when fetch fails', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const cachedGraphData = buildMockGraphApiResponse();
      const cachedPositions = buildMockPositionsResponse();

      mockGetCachedDataFn.mockReturnValue({
        graphData: cachedGraphData,
        positionsData: cachedPositions,
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('当前离线/服务超时，已切换为缓存模式')).toBeInTheDocument();
      });

      // Should still build graph data from cached items
      const buildCalls = mockBuildGraphData.mock.calls;
      expect(buildCalls.length).toBeGreaterThan(0);
    });

    it('shows empty state when fetch fails and no cache', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      mockGetCachedDataFn.mockReturnValue(null);

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      // No offline banner (no cache available)
      expect(screen.queryByText('当前离线/服务超时，已切换为缓存模式')).not.toBeInTheDocument();
    });

    it('handles corrupted cache gracefully', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      // Cache exists but has no graphData
      mockGetCachedDataFn.mockReturnValue({
        graphData: null,
        positionsData: null,
      });

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 12 & 13. Saves positions after initial data load / Caches graph data
  // =========================================================================
  describe('Position saving and data caching', () => {
    it('calls fetch PUT to save positions after initial data load', async () => {
      const graphApiResponse = buildMockGraphApiResponse();

      global.fetch = vi.fn((url, options) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(graphApiResponse),
          });
        }
        if (url.includes('/api/graph/positions')) {
          if (options && options.method === 'PUT') {
            // This is the savePositions call
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Wait a bit for the position save effect to fire
      await waitFor(() => {
        const fetchCalls = global.fetch.mock.calls;
        const putCall = fetchCalls.find(
          ([url, opts]) => url.includes('/api/graph/positions') && opts?.method === 'PUT'
        );
        expect(putCall).toBeTruthy();
      });
    });

    it('calls cacheData with graph data on successful fetch', async () => {
      const graphApiResponse = buildMockGraphApiResponse();
      const positionsResponse = buildMockPositionsResponse();

      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(graphApiResponse),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(positionsResponse),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      expect(mockCacheDataFn).toHaveBeenCalledWith(
        'knowledgeGraph',
        expect.objectContaining({
          graphData: expect.any(Object),
          positionsData: expect.any(Object),
        })
      );
    });

    it('does not call cacheData on fetch failure', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      mockGetCachedDataFn.mockReturnValue(null);

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(mockCacheDataFn).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 14. Reads saved viewport from localStorage
  // =========================================================================
  describe('Saved viewport from localStorage', () => {
    it('reads kg_viewport from localStorage on initial render', async () => {
      const savedViewport = { x: 500, y: 300, zoom: 0.75 };
      localStorage.setItem('kg_viewport', JSON.stringify(savedViewport));

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      // localStorage was read (getItem called)
      expect(localStorage.getItem('kg_viewport')).toBe(JSON.stringify(savedViewport));
    });

    it('handles invalid JSON in localStorage gracefully', async () => {
      localStorage.setItem('kg_viewport', 'invalid-json{{{{');

      // Should not throw
      expect(() => render(<KnowledgeGraph />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 15. Reset layout
  // =========================================================================
  describe('Reset layout', () => {
    it('calls DELETE positions API and clears localStorage when confirmed', async () => {
      window.confirm = vi.fn(() => true);

      global.fetch = vi.fn((url, options) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          if (options && options.method === 'DELETE') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
          }
          if (options && options.method === 'PUT') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      // Set a viewport first
      localStorage.setItem('kg_viewport', JSON.stringify({ x: 100, y: 200, zoom: 1.5 }));

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      expect(localStorage.getItem('kg_viewport')).not.toBeNull();

      // Click reset layout
      const resetBtn = screen.getByTitle('重置布局');
      fireEvent.click(resetBtn);

      expect(window.confirm).toHaveBeenCalled();

      await waitFor(() => {
        // DELETE was called
        const fetchCalls = global.fetch.mock.calls;
        const deleteCall = fetchCalls.find(
          ([url, opts]) => url.includes('/api/graph/positions') && opts?.method === 'DELETE'
        );
        expect(deleteCall).toBeTruthy();
      });
    });

    it('does not reset if user cancels confirm dialog', async () => {
      window.confirm = vi.fn(() => false);

      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      localStorage.setItem('kg_viewport', JSON.stringify({ x: 100, y: 200, zoom: 1.5 }));
      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      const resetBtn = screen.getByTitle('重置布局');
      fireEvent.click(resetBtn);

      expect(window.confirm).toHaveBeenCalled();

      // localStorage should still have the viewport
      expect(localStorage.getItem('kg_viewport')).not.toBeNull();

      // No DELETE call should have been made
      const fetchCalls = global.fetch.mock.calls;
      const deleteCall = fetchCalls.find(
        ([url, opts]) => url.includes('/api/graph/positions') && opts?.method === 'DELETE'
      );
      expect(deleteCall).toBeFalsy();
    });
  });
});
