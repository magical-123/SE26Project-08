import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ================================================================ */
/*  Mocks                                                           */
/* ================================================================ */

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }) => <div data-testid="react-flow">{children}</div>,
  ReactFlowProvider: ({ children }) => children,
  useReactFlow: () => ({ fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }),
  Background: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

vi.mock('../pages/KnowledgeGraph/graphShared', () => ({
  buildGraphData: vi.fn(() => ({ nodes: [], edges: [] })),
  ConceptNode: () => null,
  SourceNode: () => null,
}));

vi.mock('../components/DetailDrawer/DetailDrawer', () => ({
  DetailDrawer: vi.fn(() => null),
}));

vi.mock('echarts-for-react', () => ({
  default: ({ option }) => <div data-testid="echarts">{JSON.stringify(option)}</div>,
}));

vi.mock('echarts-wordcloud', () => ({}));

vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    X: ({ size }) => <span data-testid="icon-x" data-size={size}>X</span>,
    ZoomIn: ({ size }) => <span data-testid="icon-zoom-in" data-size={size}>ZoomIn</span>,
    ZoomOut: ({ size }) => <span data-testid="icon-zoom-out" data-size={size}>ZoomOut</span>,
    Loader2: ({ size }) => <span data-testid="icon-loader" data-size={size}>Loader2</span>,
  };
});

/* ================================================================ */
/*  Imports                                                         */
/* ================================================================ */

import { FriendGraphView } from '../components/FriendGraphView/FriendGraphView';
import { FriendTrendView } from '../components/FriendTrendView/FriendTrendView';
import { buildGraphData } from '../pages/KnowledgeGraph/graphShared';

/* ================================================================ */
/*  Helpers                                                         */
/* ================================================================ */

function setupMainGlassBoard() {
  // remove any leftover first
  const existing = document.querySelector('.main-glass-board');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'main-glass-board';
  el.style.overflow = 'auto';
  document.body.appendChild(el);
  return el;
}

function createFetchMock(responses) {
  return vi.fn((url) => {
    for (const [path, getResponse] of Object.entries(responses)) {
      if (url.includes(path)) {
        const response = typeof getResponse === 'function' ? getResponse() : getResponse;
        if (response instanceof Error) {
          return Promise.reject(response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
          text: () => Promise.resolve(typeof response === 'object' ? JSON.stringify(response) : response),
        });
      }
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
  });
}

/** Creates a fetch that never resolves (for testing loading state). */
function neverResolvingFetch() {
  return vi.fn(() => new Promise(() => {}));
}

/* ================================================================ */
/*  FriendGraphView Tests                                            */
/* ================================================================ */

describe('FriendGraphView', () => {
  let board;

  beforeEach(() => {
    buildGraphData.mockReturnValue({ nodes: [], edges: [] });
    sessionStorage.setItem('token', 'test-token');
    board = setupMainGlassBoard();
  });

  afterEach(() => {
    if (board && board.parentNode) board.parentNode.removeChild(board);
  });

  /* ---- 1. Renders outer wrapper with ReactFlowProvider ---- */
  it('renders outer wrapper with ReactFlowProvider', async () => {
    window.fetch = createFetchMock({
      '/api/graph/data/user/42': {
        concepts: [], itemToConcepts: {}, positions: {}, items: [],
      },
    });

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    expect(screen.getByText('张三 的知识图谱')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('该好友暂无知识图谱数据')).toBeInTheDocument();
    });
  });

  /* ---- 2. Shows loading state initially ---- */
  it('shows loading state initially', () => {
    window.fetch = neverResolvingFetch();

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  /* ---- 3. Shows friend name in title ---- */
  it('shows friend name in title', () => {
    window.fetch = neverResolvingFetch();

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    expect(screen.getByText('张三 的知识图谱')).toBeInTheDocument();
  });

  /* ---- 4. Shows zoom controls ---- */
  it('shows zoom controls', () => {
    window.fetch = neverResolvingFetch();

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    expect(screen.getByTestId('icon-zoom-in')).toBeInTheDocument();
    expect(screen.getByTestId('icon-zoom-out')).toBeInTheDocument();
  });

  /* ---- 5. Close button calls onClose ---- */
  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    window.fetch = createFetchMock({
      '/api/graph/data/user/42': {
        concepts: [], itemToConcepts: {}, positions: {}, items: [],
      },
    });

    render(<FriendGraphView friendId={42} friendName="张三" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('该好友暂无知识图谱数据')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /* ---- 6. Shows error message on fetch failure ---- */
  it('shows error message on fetch failure', async () => {
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: '网络错误' }),
      })
    );

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });

  /* ---- 7. Shows empty state when no graph data ---- */
  it('shows empty state when no graph data', async () => {
    buildGraphData.mockReturnValue({ nodes: [], edges: [] });
    window.fetch = createFetchMock({
      '/api/graph/data/user/42': {
        concepts: [], itemToConcepts: {}, positions: {}, items: [],
      },
    });

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('该好友暂无知识图谱数据')).toBeInTheDocument();
    });
  });

  /* ---- 8. Handles successful data fetch ---- */
  it('handles successful data fetch and renders graph', async () => {
    buildGraphData.mockReturnValue({
      nodes: [
        { id: 'concept-1', data: { type: 'concept', label: 'C1' }, position: { x: 100, y: 100 } },
      ],
      edges: [
        { id: 'e1', source: 'src-1', target: 'concept-1', data: { color: '#ccc' } },
      ],
    });
    window.fetch = createFetchMock({
      '/api/graph/data/user/42': {
        concepts: [{ id: 1, name: 'Concept1' }],
        itemToConcepts: { '1': [1] },
        positions: { 'concept-1': { x: 100, y: 100 } },
        items: [{
          id: 1, title: 'A1', platform: 'Web', durationMinutes: 5,
          crawledAt: '2024-01-01', aiSummary: 'S', knowledgeScore: 80,
        }],
      },
    });

    render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  /* ---- 9. Background scroll is locked while open ---- */
  it('locks background scroll on main-glass-board', () => {
    window.fetch = neverResolvingFetch();

    expect(board.style.overflow).toBe('auto');

    const { unmount } = render(<FriendGraphView friendId={42} friendName="张三" onClose={vi.fn()} />);

    expect(board.style.overflow).toBe('hidden');

    unmount();

    expect(board.style.overflow).toBe('auto');
  });

  /* ---- 10. Overlay click calls onClose ---- */
  it('overlay click calls onClose', async () => {
    const onClose = vi.fn();
    window.fetch = createFetchMock({
      '/api/graph/data/user/42': {
        concepts: [], itemToConcepts: {}, positions: {}, items: [],
      },
    });

    render(<FriendGraphView friendId={42} friendName="张三" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('该好友暂无知识图谱数据')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.fgv-overlay');
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/* ================================================================ */
/*  FriendTrendView Tests                                            */
/* ================================================================ */

describe('FriendTrendView', () => {
  let board;

  beforeEach(() => {
    sessionStorage.setItem('token', 'test-token');
    board = setupMainGlassBoard();
  });

  afterEach(() => {
    if (board && board.parentNode) board.parentNode.removeChild(board);
  });

  /* ---- 1. Shows friend name in title ---- */
  it('shows friend name in title', () => {
    window.fetch = neverResolvingFetch();

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    expect(screen.getByText('李四 的浏览趋势')).toBeInTheDocument();
  });

  /* ---- 2. Shows loading state initially ---- */
  it('shows loading state initially', () => {
    window.fetch = neverResolvingFetch();

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
  });

  /* ---- 3. Shows error message ---- */
  it('shows error message', async () => {
    window.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    );

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('无法获取数据')).toBeInTheDocument();
    });
  });

  /* ---- 4. Shows nutrition data with pie chart and total hours ---- */
  it('shows nutrition data with pie chart and total hours', async () => {
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': {
        data: [
          { name: '科技', value: 60, itemStyle: { color: '#5470c6' } },
          { name: '人文', value: 40, itemStyle: { color: '#91cc75' } },
        ],
        totalHours: 12.5,
      },
      '/api/social/report/42/wordcloud': [],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('12.5h')).toBeInTheDocument();
    });

    expect(screen.getByText('科技')).toBeInTheDocument();
    expect(screen.getByText('人文')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
  });

  /* ---- 5. Shows word cloud when data available ---- */
  it('shows word cloud when data available', async () => {
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': { data: [], totalHours: 0 },
      '/api/social/report/42/wordcloud': [
        { word: 'AI', value: 100 },
        { word: 'React', value: 80 },
      ],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('暂无营养数据')).toBeInTheDocument();
    });

    expect(screen.getByText('今日高频话题')).toBeInTheDocument();
    const charts = screen.getAllByTestId('echarts');
    expect(charts.length).toBeGreaterThanOrEqual(1);
  });

  /* ---- 6. Shows "暂无营养数据" when no nutrition data ---- */
  it('shows "暂无营养数据" when no nutrition data', async () => {
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': { data: [], totalHours: 0 },
      '/api/social/report/42/wordcloud': [],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('暂无营养数据')).toBeInTheDocument();
    });
  });

  /* ---- 7. Shows "暂无词云数据" when no word cloud data ---- */
  it('shows "暂无词云数据" when no word cloud data', async () => {
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': {
        data: [{ name: '科技', value: 100, itemStyle: { color: '#5470c6' } }],
        totalHours: 5,
      },
      '/api/social/report/42/wordcloud': [],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('暂无词云数据')).toBeInTheDocument();
    });
  });

  /* ---- 8. Close button calls onClose ---- */
  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': { data: [], totalHours: 0 },
      '/api/social/report/42/wordcloud': [],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('暂无营养数据')).toBeInTheDocument();
    });

    const closeBtn = screen.getByTestId('icon-x').closest('button');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /* ---- 9. Overlay click calls onClose ---- */
  it('overlay click calls onClose', async () => {
    const onClose = vi.fn();
    window.fetch = createFetchMock({
      '/api/social/report/42/nutrition': { data: [], totalHours: 0 },
      '/api/social/report/42/wordcloud': [],
    });

    render(<FriendTrendView friendId={42} friendName="李四" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('暂无营养数据')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.ftv-overlay');
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /* ---- 10. Locked background scroll (main-glass-board overflow hidden) ---- */
  it('locks background scroll on main-glass-board', () => {
    window.fetch = neverResolvingFetch();

    expect(board.style.overflow).toBe('auto');

    const { unmount } = render(<FriendTrendView friendId={42} friendName="李四" onClose={vi.fn()} />);

    expect(board.style.overflow).toBe('hidden');

    unmount();

    expect(board.style.overflow).toBe('auto');
  });
});
