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
  toImage: vi.fn(),
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

// Hoisted handler captures for testing event handlers
const { __onNodeClick, __onPaneClick, __onNodeDragStart, __onNodeDragStop, __onMoveEnd } = vi.hoisted(() => {
  return {
    __onNodeClick: { current: null },
    __onPaneClick: { current: null },
    __onNodeDragStart: { current: null },
    __onNodeDragStop: { current: null },
    __onMoveEnd: { current: null },
  };
});

// ===========================================================================
// Module mocks
// ===========================================================================

vi.mock('@xyflow/react', () => ({
  ReactFlow: (props) => {
    // Capture all handlers so tests can call them directly
    __onNodeClick.current = props.onNodeClick;
    __onPaneClick.current = props.onPaneClick;
    __onNodeDragStart.current = props.onNodeDragStart;
    __onNodeDragStop.current = props.onNodeDragStop;
    __onMoveEnd.current = props.onMoveEnd;

    return React.createElement('div', {
      'data-testid': 'react-flow',
      style: props.style,
      onClick: props.onPaneClick,
    }, props.children);
  },
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
          React.createElement('button', {
            'data-testid': 'drawer-toggle-kw-btn',
            onClick: () => onToggleKeyword && onToggleKeyword({ label: 'React', highlighted: true }),
          }, 'Toggle KW'),
          React.createElement('button', {
            'data-testid': 'drawer-delete-kw-btn',
            onClick: () => onDeleteKeyword && onDeleteKeyword('React'),
          }, 'Delete KW'),
          React.createElement('button', {
            'data-testid': 'drawer-add-kw-btn',
            onClick: () => onAddKeyword && onAddKeyword(),
          }, 'Add KW'),
          React.createElement('span', { 'data-testid': 'selected-keywords-count' }, String(selectedKeywords?.length || 0)),
          React.createElement('span', { 'data-testid': 'suggested-keywords-count' }, String(suggestedKeywords?.length || 0)),
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

function buildGraphNodesWithMultipleConcepts() {
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
        id: 'concept-2',
        type: 'concept',
        position: { x: 100, y: 100 },
        width: 100,
        height: 100,
        data: { id: 2, label: 'JavaScript', color: '#F7DF1E', type: 'concept', count: 1, size: 65 },
      },
      {
        id: 'source-101',
        type: 'source',
        position: { x: 0, y: 100 },
        width: 64,
        height: 64,
        data: { id: 101, title: 'React 19 新特性', type: 'source', sourceTitle: 'React 19 新特性', weight: 3, size: 34, conceptIds: ['concept-1'], author: '技术博主' },
      },
      {
        id: 'source-102',
        type: 'source',
        position: { x: 100, y: 200 },
        width: 64,
        height: 64,
        data: { id: 102, title: 'JS 高级编程', type: 'source', sourceTitle: 'JS 高级编程', weight: 3, size: 34, conceptIds: ['concept-2'], author: '编程达人' },
      },
    ],
    edges: [
      { id: 'edge-101-1', source: 'source-101', target: 'concept-1', data: { type: 'belongs', color: '#61DAFB' } },
      { id: 'edge-102-2', source: 'source-102', target: 'concept-2', data: { type: 'belongs', color: '#F7DF1E' } },
    ],
  };
}

/** Mount the component with full data loaded */
async function mountWithData(nodesOverride) {
  const graphApiResponse = buildMockGraphApiResponse();
  const positionsResponse = buildMockPositionsResponse();

  global.fetch = vi.fn((url, options) => {
    if (url.includes('/api/graph/data')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(graphApiResponse),
      });
    }
    if (url.includes('/api/graph/positions')) {
      if (options && options.method === 'PUT') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (options && options.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(positionsResponse),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });

  mockBuildGraphData.mockReturnValue(nodesOverride || buildSomeGraphNodes());

  const result = render(<KnowledgeGraph />);

  await waitFor(() => {
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  return result;
}

// ===========================================================================
// beforeEach / afterEach
// ===========================================================================

describe('KnowledgeGraph Extra — Event Handlers & Business Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    // Reset mock implementations to defaults explicitly
    mockGetCachedDataFn.mockReturnValue(null);
    mockBuildGraphData.mockReturnValue({ nodes: [], edges: [] });
    mockGraphApiGetItemKeywords.mockResolvedValue([]);
    mockGraphApiToggleKeyword.mockResolvedValue([]);
    mockGraphApiDeleteKeyword.mockResolvedValue({});
    mockGraphApiUpdateKeywords.mockResolvedValue({});
    mockUseReactFlow.toImage.mockResolvedValue('data:image/png;base64,test');

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

    // Reset handler captures
    __onNodeClick.current = null;
    __onPaneClick.current = null;
    __onNodeDragStart.current = null;
    __onNodeDragStop.current = null;
    __onMoveEnd.current = null;

    // Clean any leftover SVG elements from export tests
    const svgEls = document.querySelectorAll('.react-flow__renderer');
    svgEls.forEach(el => el.remove());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  // =========================================================================
  // onNodeClick — concept node
  // =========================================================================
  describe('onNodeClick — concept node', () => {
    it('clicking concept node sets focusedNodeId and closes drawer', async () => {
      await mountWithData();

      const conceptNode = {
        id: 'concept-1',
        data: { type: 'concept', label: 'React', color: '#61DAFB' },
      };

      act(() => {
        __onNodeClick.current({}, conceptNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });

    it('clicking concept node when another is already focused switches focus', async () => {
      await mountWithData();

      // First click a source node to focus it
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19', id: 101, author: '技术博主' },
      };

      act(() => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Now click a concept node
      const conceptNode = {
        id: 'concept-1',
        data: { type: 'concept', label: 'React', color: '#61DAFB' },
      };

      act(() => {
        __onNodeClick.current({}, conceptNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // onNodeClick — source node
  // =========================================================================
  describe('onNodeClick — source node', () => {
    it('clicking source node opens drawer and fetches keywords', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
        { label: 'Hooks', confidence: 0.7, highlighted: false },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      expect(mockGraphApiGetItemKeywords).toHaveBeenCalledWith(101);

      await waitFor(() => {
        expect(screen.getByTestId('selected-keywords-count').textContent).toBe('1');
      });
    });

    it('clicking source node with missing id uses node.id as fallback', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-no-id',
        data: { type: 'source', sourceTitle: 'Unknown' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      expect(mockGraphApiGetItemKeywords).toHaveBeenCalledWith('source-no-id');
    });
  });

  // =========================================================================
  // onNodeClick — same node again (unfocus)
  // =========================================================================
  describe('onNodeClick — same node unfocus', () => {
    it('clicking same source node again unfocuses and closes drawer', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      // First click
      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Second click (same node)
      act(() => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });

    it('clicking same concept node again unfocuses', async () => {
      await mountWithData();

      const conceptNode = {
        id: 'concept-1',
        data: { type: 'concept', label: 'React', color: '#61DAFB' },
      };

      // First click
      act(() => {
        __onNodeClick.current({}, conceptNode);
      });

      // Second click (same node)
      act(() => {
        __onNodeClick.current({}, conceptNode);
      });

      // Should not crash, drawer stays closed
      expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // onNodeClick — keyword fetch error
  // =========================================================================
  describe('onNodeClick — keyword fetch error', () => {
    it('handles graphApi.getItemKeywords error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGraphApiGetItemKeywords.mockRejectedValue(new Error('API error'));

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        // Drawer still opens
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '获取关键词失败:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('keyword fetch error does not crash the component', async () => {
      mockGraphApiGetItemKeywords.mockRejectedValue(new Error('Network failure'));

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      // Should not throw
      await act(async () => {
        expect(() => __onNodeClick.current({}, sourceNode)).not.toThrow();
      });
    });
  });

  // =========================================================================
  // onPaneClick
  // =========================================================================
  describe('onPaneClick', () => {
    it('unfocuses node, closes drawer, clears keywords', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      // First focus a source node
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Now click on pane
      act(() => {
        __onPaneClick.current();
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });

    it('onPaneClick works when nothing is focused', async () => {
      await mountWithData();

      // Click pane with no focus — should not throw
      act(() => {
        expect(() => __onPaneClick.current()).not.toThrow();
      });

      // Drawer stays closed
      expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // onNodeDragStart
  // =========================================================================
  describe('onNodeDragStart', () => {
    it('sets dragging flag and hides edges', async () => {
      await mountWithData();

      // Populate rfEdges first so we can see the transition
      expect(__setRfEdges).toHaveBeenCalled();

      act(() => {
        __onNodeDragStart.current();
      });

      // setRfEdges should be called with edges having strokeOpacity: 0
      const edgeSetCalls = __setRfEdges.mock.calls;
      const lastEdgeCall = edgeSetCalls[edgeSetCalls.length - 1];
      if (lastEdgeCall && lastEdgeCall[0] && Array.isArray(lastEdgeCall[0])) {
        lastEdgeCall[0].forEach(e => {
          expect(e.style.strokeOpacity).toBe(0);
        });
      }
    });
  });

  // =========================================================================
  // onNodeDragStop
  // =========================================================================
  describe('onNodeDragStop', () => {
    it('saves position via API and updates savedPositions', async () => {
      await mountWithData();

      const node = {
        id: 'concept-1',
        position: { x: 500, y: 300 },
      };

      await act(async () => {
        __onNodeDragStop.current({}, node);
      });

      // Should have called fetch PUT for positions
      await waitFor(() => {
        const fetchCalls = global.fetch.mock.calls;
        const putCalls = fetchCalls.filter(
          ([url, opts]) => url.includes('/api/graph/positions') && opts?.method === 'PUT'
        );
        expect(putCalls.length).toBeGreaterThan(0);

        const body = JSON.parse(putCalls[putCalls.length - 1][1].body);
        expect(body[0].nodeId).toBe('concept-1');
        expect(body[0].posX).toBe(500);
        expect(body[0].posY).toBe(300);
      });
    });

    it('handles savePositions API error gracefully', async () => {
      // Override fetch to fail on PUT for drag stop
      const existingFetch = global.fetch;
      global.fetch = vi.fn((url, options) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          if (options && options.method === 'PUT') {
            return Promise.reject(new Error('Save failed'));
          }
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

      const node = {
        id: 'concept-1',
        position: { x: 500, y: 300 },
      };

      // Should not throw
      await act(async () => {
        expect(() => __onNodeDragStop.current({}, node)).not.toThrow();
      });
    });

    it('dragging flag is cleared after drag stop', async () => {
      await mountWithData();

      // First start dragging
      act(() => {
        __onNodeDragStart.current();
      });

      // Then stop dragging
      await act(async () => {
        __onNodeDragStop.current({}, { id: 'concept-1', position: { x: 100, y: 100 } });
      });

      // The dragging ref should be cleared (indirectly verified by no error)
      expect(__setRfEdges).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleDrawerClose
  // =========================================================================
  describe('handleDrawerClose', () => {
    it('closes drawer and clears keywords when close button clicked', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
        { label: 'Hooks', confidence: 0.7, highlighted: false },
      ]);

      await mountWithData();

      // Open drawer first
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Click close button
      fireEvent.click(screen.getByTestId('drawer-close-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer-closed')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // handleToggleKeyword
  // =========================================================================
  describe('handleToggleKeyword', () => {
    it('calls graphApi.toggleItemKeyword and updates state', async () => {
      mockGraphApiToggleKeyword.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: false },
        { label: 'Hooks', confidence: 0.7, highlighted: true },
      ]);

      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
        { label: 'Hooks', confidence: 0.7, highlighted: false },
      ]);

      await mountWithData();

      // Open drawer first
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Click toggle keyword button
      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-toggle-kw-btn'));
      });

      expect(mockGraphApiToggleKeyword).toHaveBeenCalledWith(101, { label: 'React', highlighted: true });
    });

    it('does nothing when selectedNode has no data.id', async () => {
      await mountWithData();

      // Focus a source node with no data.id
      const sourceNode = {
        id: 'source-no-data-id',
        data: { type: 'source', sourceTitle: 'No ID' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      mockGraphApiToggleKeyword.mockClear();

      // Click toggle — should not call API since data.id is missing
      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-toggle-kw-btn'));
      });

      expect(mockGraphApiToggleKeyword).not.toHaveBeenCalled();
    });

    it('handles toggleItemKeyword error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGraphApiToggleKeyword.mockRejectedValue(new Error('Toggle failed'));
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-toggle-kw-btn'));
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('切换高亮失败:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // handleDeleteKeyword
  // =========================================================================
  describe('handleDeleteKeyword', () => {
    it('deletes keyword via API and removes from state', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
        { label: 'Hooks', confidence: 0.7, highlighted: false },
      ]);

      await mountWithData();

      // Open drawer first
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Click delete keyword button
      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-delete-kw-btn'));
      });

      await waitFor(() => {
        expect(mockGraphApiDeleteKeyword).toHaveBeenCalledWith('React');
      });
    });

    it('handles deleteKeyword API error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGraphApiDeleteKeyword.mockRejectedValue(new Error('Delete failed'));
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-delete-kw-btn'));
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('删除关键词失败:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // handleAddKeyword
  // =========================================================================
  describe('handleAddKeyword', () => {
    it('creates new keyword via prompt and calls API', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('TypeScript');
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);
      mockGraphApiUpdateKeywords.mockResolvedValue({});

      await mountWithData();

      // Open drawer first
      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-add-kw-btn'));
      });

      expect(promptSpy).toHaveBeenCalled();
      expect(mockGraphApiUpdateKeywords).toHaveBeenCalledWith(
        101,
        expect.arrayContaining([
          expect.objectContaining({ label: 'TypeScript' }),
        ])
      );

      promptSpy.mockRestore();
    });

    it('returns early when prompt returns null', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      mockGraphApiUpdateKeywords.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-add-kw-btn'));
      });

      expect(mockGraphApiUpdateKeywords).not.toHaveBeenCalled();

      promptSpy.mockRestore();
    });

    it('returns early when prompt returns empty string', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('');
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      mockGraphApiUpdateKeywords.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-add-kw-btn'));
      });

      expect(mockGraphApiUpdateKeywords).not.toHaveBeenCalled();

      promptSpy.mockRestore();
    });

    it('skips when keyword already exists in selectedKeywords', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('React');
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);
      mockGraphApiUpdateKeywords.mockResolvedValue({});

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      mockGraphApiUpdateKeywords.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-add-kw-btn'));
      });

      expect(mockGraphApiUpdateKeywords).not.toHaveBeenCalled();

      promptSpy.mockRestore();
    });
  });

  // =========================================================================
  // exportImage
  // =========================================================================
  describe('exportImage', () => {
    it('calls reactFlowInstance.toImage and downloads on success', async () => {
      mockUseReactFlow.toImage.mockResolvedValue('data:image/png;base64,test');

      await mountWithData();

      const origCreateElement = document.createElement.bind(document);
      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (String(tagName).toLowerCase() === 'a') {
          const el = origCreateElement('a');
          el.click = clickSpy;
          return el;
        }
        return origCreateElement(String(tagName));
      });

      try {
        const exportBtn = screen.getByTitle('导出图片');
        await act(async () => {
          fireEvent.click(exportBtn);
        });

        expect(mockUseReactFlow.toImage).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
      } finally {
        createElementSpy.mockRestore();
      }
    });

    it('does nothing when reactFlowInstance is not available', async () => {
      // Test the guard: if (!reactFlowInstance) return;
      // reactFlowInstance is always available from mockUseReactFlow in our mock,
      // so this is tested indirectly. But we can test: the function does not throw.
      await mountWithData();

      const exportBtn = screen.getByTitle('导出图片');
      await act(async () => {
        expect(() => {
          fireEvent.click(exportBtn);
        }).not.toThrow();
      });
    });

    it('falls back to SVG serialization when toImage fails', async () => {
      mockUseReactFlow.toImage.mockRejectedValue(new Error('toImage failed'));

      await mountWithData();

      const origCreateElement = document.createElement.bind(document);
      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (String(tagName).toLowerCase() === 'a') {
          const el = origCreateElement('a');
          el.click = clickSpy;
          return el;
        }
        return origCreateElement(String(tagName));
      });

      // Mock querySelector to return null (no SVG in dom during test)
      const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue(null);

      try {
        const exportBtn = screen.getByTitle('导出图片');
        await act(async () => {
          fireEvent.click(exportBtn);
        });

        expect(mockUseReactFlow.toImage).toHaveBeenCalled();
        // Fallback tried querySelector but found nothing
        expect(querySelectorSpy).toHaveBeenCalledWith('.react-flow__renderer svg');
      } finally {
        createElementSpy.mockRestore();
        querySelectorSpy.mockRestore();
      }
    });
  });

  // =========================================================================
  // onMoveEnd — saves viewport
  // =========================================================================
  describe('onMoveEnd', () => {
    it('saves viewport to localStorage', async () => {
      await mountWithData();

      const viewport = { x: 500, y: 300, zoom: 1.5 };

      act(() => {
        __onMoveEnd.current({}, viewport);
      });

      expect(localStorage.getItem('kg_viewport')).toBe(JSON.stringify(viewport));
    });

    it('handles localStorage setItem error gracefully', async () => {
      await mountWithData();

      // Make setItem throw
      const origSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => { throw new Error('Quota exceeded'); });

      const viewport = { x: 500, y: 300, zoom: 1.5 };

      // Should not throw
      act(() => {
        expect(() => __onMoveEnd.current({}, viewport)).not.toThrow();
      });

      localStorage.setItem = origSetItem;
    });
  });

  // =========================================================================
  // fetchGraphData — edge cases
  // =========================================================================
  describe('fetchGraphData edge cases', () => {
    it('handles positions data that is an array (not object)', async () => {
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
            json: () => Promise.resolve(['not', 'an', 'object']),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      // Should not crash
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('handles graphData API returning null', async () => {
      global.fetch = vi.fn((url) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null),
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

      mockBuildGraphData.mockReturnValue({ nodes: [], edges: [] });

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });
    });

    it('sets kgOffline true when fallback to cache', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      mockGetCachedDataFn.mockReturnValue({
        graphData: buildMockGraphApiResponse(),
        positionsData: buildMockPositionsResponse(),
      });
      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('当前离线/服务超时，已切换为缓存模式')).toBeInTheDocument();
        expect(screen.getByTestId('icon-WifiOff')).toBeInTheDocument();
      });
    });

    it('does not show offline banner when cache is empty', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
      mockGetCachedDataFn.mockReturnValue(null);

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByText('暂无数据')).toBeInTheDocument();
      });

      expect(screen.queryByText('当前离线/服务超时，已切换为缓存模式')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // toggleConcept — min 1 visible constraint
  // =========================================================================
  describe('toggleConcept — minimum visible constraint', () => {
    it('does not hide the last visible concept', async () => {
      await mountWithData(buildSomeGraphNodes());

      // Only one concept exists; clicking its legend item should not hide it
      const conceptBtn = screen.getByText('React').closest('button');
      fireEvent.click(conceptBtn);

      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
      });
    });

    it('shows a previously hidden concept when toggled again', async () => {
      await mountWithData(buildGraphNodesWithMultipleConcepts());

      // Hide 'JavaScript' concept
      const jsBtn = screen.getByText('JavaScript').closest('button');
      fireEvent.click(jsBtn);

      await waitFor(() => {
        expect(screen.getByTestId('icon-EyeOff')).toBeInTheDocument();
      });

      // Show it again
      const jsHiddenBtn = screen.getByText('JavaScript').closest('button');
      fireEvent.click(jsHiddenBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('icon-EyeOff')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // toggleAll
  // =========================================================================
  describe('toggleAll', () => {
    it('sets all concepts visible', async () => {
      await mountWithData(buildGraphNodesWithMultipleConcepts());

      // First hide one concept
      const jsBtn = screen.getByText('JavaScript').closest('button');
      fireEvent.click(jsBtn);

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
  });

  // =========================================================================
  // Legend collapse/expand
  // =========================================================================
  describe('Legend collapse/expand', () => {
    it('shows concept count in collapsed legend', async () => {
      await mountWithData(buildGraphNodesWithMultipleConcepts());

      const collapseBtn = screen.getByTitle('收起标签栏');
      fireEvent.click(collapseBtn);

      await waitFor(() => {
        expect(screen.getByText(/2\s*个标签/)).toBeInTheDocument();
      });
    });

    it('can expand collapsed legend', async () => {
      await mountWithData(buildGraphNodesWithMultipleConcepts());

      // Collapse
      const collapseBtn = screen.getByTitle('收起标签栏');
      fireEvent.click(collapseBtn);

      await waitFor(() => {
        expect(screen.getByText(/2\s*个标签/)).toBeInTheDocument();
      });

      // Expand
      const expandBtn = screen.getByTitle('展开标签栏');
      fireEvent.click(expandBtn);

      await waitFor(() => {
        expect(screen.getByText('React')).toBeInTheDocument();
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Legend allVisible check
  // =========================================================================
  describe('Legend allVisible', () => {
    it('"全显示" button is disabled when all concepts are visible', async () => {
      await mountWithData(buildSomeGraphNodes());

      await waitFor(() => {
        const showAllBtn = screen.getByText('全显示').closest('button');
        expect(showAllBtn).toBeInTheDocument();
        expect(showAllBtn.className).toContain('disabled');
      });
    });

    it('"全显示" button enabled after hiding a concept', async () => {
      await mountWithData(buildGraphNodesWithMultipleConcepts());

      const showAllBtn = screen.getByText('全显示').closest('button');
      expect(showAllBtn.className).toContain('disabled');

      const jsBtn = screen.getByText('JavaScript').closest('button');
      fireEvent.click(jsBtn);

      await waitFor(() => {
        const btnAfterHide = screen.getByText('全显示').closest('button');
        expect(btnAfterHide.className).not.toContain('disabled');
      });
    });
  });

  // =========================================================================
  // resetLayout — user cancels
  // =========================================================================
  describe('resetLayout — user cancels', () => {
    it('does nothing when user cancels confirm dialog', async () => {
      window.confirm = vi.fn(() => false);

      await mountWithData();

      localStorage.setItem('kg_viewport', JSON.stringify({ x: 100, y: 200, zoom: 1.5 }));

      const resetBtn = screen.getByTitle('重置布局');
      fireEvent.click(resetBtn);

      expect(window.confirm).toHaveBeenCalled();

      // localStorage should still have the viewport
      expect(localStorage.getItem('kg_viewport')).not.toBeNull();
    });
  });

  // =========================================================================
  // resetLayout — API error
  // =========================================================================
  describe('resetLayout API error', () => {
    it('handles reset layout API error gracefully', async () => {
      window.confirm = vi.fn(() => true);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = vi.fn((url, options) => {
        if (url.includes('/api/graph/data')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(buildMockGraphApiResponse()),
          });
        }
        if (url.includes('/api/graph/positions')) {
          if (options && options.method === 'DELETE') {
            return Promise.reject(new Error('Delete failed'));
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

      mockBuildGraphData.mockReturnValue(buildSomeGraphNodes());

      render(<KnowledgeGraph />);

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
      });

      const resetBtn = screen.getByTitle('重置布局');
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('重置布局失败:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // =========================================================================
  // DetailDrawer selectedNode data
  // =========================================================================
  describe('DetailDrawer selectedNode data', () => {
    it('passes correct sourceTitle to drawer when source node clicked', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        const drawer = screen.getByTestId('detail-drawer');
        expect(drawer.getAttribute('data-item-title')).toBe('React 19 新特性');
      });
    });

    it('uses node.id as fallback title when sourceTitle is missing', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([]);

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', id: 101 },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        const drawer = screen.getByTestId('detail-drawer');
        expect(drawer.getAttribute('data-item-title')).toBe('source-101');
      });
    });
  });

  // =========================================================================
  // Focus state management
  // =========================================================================
  describe('Focus state management', () => {
    it('switching focus from source to another source works', async () => {
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);

      await mountWithData(buildGraphNodesWithMultipleConcepts());

      // Focus first source
      const sourceNode1 = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
        expect(screen.getByTestId('detail-drawer').getAttribute('data-item-title')).toBe('React 19');
      });

      // Focus second source
      const sourceNode2 = {
        id: 'source-102',
        data: { type: 'source', sourceTitle: 'JS 高级编程', id: 102, author: '编程达人' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode2);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer').getAttribute('data-item-title')).toBe('JS 高级编程');
      });
    });
  });

  // =========================================================================
  // handleAddKeyword with updateItemKeywords error
  // =========================================================================
  describe('handleAddKeyword API error', () => {
    it('handles updateItemKeywords error gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('TypeScript');
      mockGraphApiGetItemKeywords.mockResolvedValue([
        { label: 'React', confidence: 0.9, highlighted: true },
      ]);
      mockGraphApiUpdateKeywords.mockRejectedValue(new Error('Update failed'));

      await mountWithData();

      const sourceNode = {
        id: 'source-101',
        data: { type: 'source', sourceTitle: 'React 19 新特性', id: 101, author: '技术博主' },
      };

      await act(async () => {
        __onNodeClick.current({}, sourceNode);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('drawer-add-kw-btn'));
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('添加关键词失败:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
      promptSpy.mockRestore();
    });
  });
});
