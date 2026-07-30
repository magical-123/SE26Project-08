import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track the option passed to echarts for verifying chart data
let lastChartOption = null;

vi.mock('echarts-for-react', () => ({
  default: ({ option }) => {
    lastChartOption = option;
    return React.createElement('div', { 'data-testid': 'echarts-react' });
  },
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return React.forwardRef(({ children, ...props }, ref) => {
            const { whileHover, initial, animate, exit, transition, ...rest } = props;
            return React.createElement(prop, { ...rest, ref }, children);
          });
        }
        return () => null;
      },
    }
  ),
  AnimatePresence: ({ children }) => children,
}));

vi.mock('lucide-react', () => {
  const icons = [
    'ChevronLeft', 'ChevronRight', 'ExternalLink', 'Quote', 'RefreshCw',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return { ...actual, createPortal: (children) => children };
});

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import { NutritionLabel } from '../components/NutritionLabel/NutritionLabel';
import { RotatingQuoteCard } from '../components/RotatingQuoteCard/RotatingQuoteCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the series data array from the chart option. */
function getSeriesData() {
  return lastChartOption?.series?.[0]?.data ?? [];
}

/** Finds a series item by a substring of its name. */
function findSeriesItem(nameSubstring) {
  return getSeriesData().find(d => d.name.includes(nameSubstring));
}

// ---------------------------------------------------------------------------
// NutritionLabel
// ---------------------------------------------------------------------------

describe('NutritionLabel', () => {
  beforeEach(() => {
    lastChartOption = null;
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it('renders header text and footer', () => {
    render(<NutritionLabel data={[]} />);
    expect(screen.getByText('数字营养成分')).toBeInTheDocument();
    expect(screen.getByText(/饼图展示了/)).toBeInTheDocument();
  });

  it('renders loading state initially when no data prop', () => {
    // Make fetch never resolve so the loading state persists
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<NutritionLabel />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Data prop — renders chart with correct mapping
  // -----------------------------------------------------------------------

  it('renders chart with provided data prop', () => {
    const testData = [
      { name: '蛋白质', value: 30 },
      { name: '碳水', value: 25 },
      { name: '维生素', value: 20 },
      { name: '脂肪', value: 15 },
      { name: '纤维', value: 10 },
    ];
    render(<NutritionLabel data={testData} />);
    expect(screen.getByTestId('echarts-react')).toBeInTheDocument();
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();
  });

  it('maps data prop names correctly to nutrition categories', () => {
    const testData = [
      { name: '蛋白质', value: 30 },
      { name: '碳水', value: 25 },
      { name: '维生素', value: 20 },
      { name: '脂肪', value: 15 },
      { name: '纤维', value: 10 },
    ];
    render(<NutritionLabel data={testData} />);

    expect(findSeriesItem('蛋白质').value).toBe(30);
    expect(findSeriesItem('碳水').value).toBe(25);
    expect(findSeriesItem('维生素').value).toBe(20);
    expect(findSeriesItem('脂肪').value).toBe(15);
    expect(findSeriesItem('纤维').value).toBe(10);
  });

  it('skips data items with names not matching any category', () => {
    const testData = [
      { name: '蛋白质', value: 30 },
      { name: '未知类别', value: 99 },
      { name: '碳水', value: 25 },
    ];
    render(<NutritionLabel data={testData} />);

    // Matched items get their values
    expect(findSeriesItem('蛋白质').value).toBe(30);
    expect(findSeriesItem('碳水').value).toBe(25);
    // Unmatched categories remain at their default (0)
    expect(findSeriesItem('维生素').value).toBe(0);
    expect(findSeriesItem('脂肪').value).toBe(0);
    expect(findSeriesItem('纤维').value).toBe(0);
  });

  // -----------------------------------------------------------------------
  // API fetching
  // -----------------------------------------------------------------------

  it('fetches nutrition stats from API when no data prop', async () => {
    const mockNutrition = {
      nutrition: {
        protein: 40, carbs: 30, vitamins: 15, fats: 10, fiber: 5,
      },
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockNutrition),
    });

    render(<NutritionLabel />);

    await waitFor(() => {
      expect(screen.getByTestId('echarts-react')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/analysis/nutrition-stats/1');
    expect(findSeriesItem('蛋白质').value).toBe(40);
    expect(findSeriesItem('碳水').value).toBe(30);
    expect(findSeriesItem('维生素').value).toBe(15);
    expect(findSeriesItem('脂肪').value).toBe(10);
    expect(findSeriesItem('纤维').value).toBe(5);
  });

  it('handles API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<NutritionLabel />);

    await waitFor(() => {
      expect(screen.getByTestId('echarts-react')).toBeInTheDocument();
    });

    // All values should remain at default (0) after an error
    getSeriesData().forEach(item => {
      expect(item.value).toBe(0);
    });
    expect(consoleSpy).toHaveBeenCalledWith('获取营养统计出错:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// RotatingQuoteCard
// ---------------------------------------------------------------------------

describe('RotatingQuoteCard', () => {
  const sampleQuotes = [
    {
      content: 'Quote one',
      sourcePlatform: 'Twitter',
      sourceTitle: 'Post 1',
      sourceUrl: 'https://twitter.com/1',
      reason: 'Insightful',
    },
    {
      content: 'Quote two',
      sourcePlatform: 'GitHub',
      sourceTitle: 'Repo two',
    },
    {
      content: 'Quote three',
      sourcePlatform: 'Medium',
      sourceTitle: 'Article three',
      sourceUrl: 'https://medium.com/3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Empty / missing quotes
  // -----------------------------------------------------------------------

  it('renders empty state when quotes is undefined', () => {
    render(<RotatingQuoteCard />);
    expect(screen.getByText('暂无金句摘录')).toBeInTheDocument();
  });

  it('renders empty state when quotes is empty array', () => {
    render(<RotatingQuoteCard quotes={[]} />);
    expect(screen.getByText('暂无金句摘录')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Rendering quotes
  // -----------------------------------------------------------------------

  it('renders quotes from the quotes array', () => {
    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    expect(screen.getByText('金句摘录')).toBeInTheDocument();
    // One of the three quotes should be displayed
    const blockquote = screen.getByText(/".*"/);
    expect(blockquote).toBeInTheDocument();
  });

  it('displays source platform, truncated source title, and footer hint', () => {
    render(<RotatingQuoteCard quotes={[sampleQuotes[0]]} />);
    expect(screen.getByText(/Twitter/)).toBeInTheDocument();
    expect(screen.getByText('点击翻阅')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Auto-rotation
  // -----------------------------------------------------------------------

  it('auto-rotates through quotes on timer', () => {
    vi.useFakeTimers();

    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      // First random call (initial randomIndex) -> index 0
      if (callCount === 1) return 0;
      // Second random call (timer callback) -> floor(0.5 * 3) = 1
      return 0.5;
    });

    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    expect(screen.getByText(/"Quote one"/)).toBeInTheDocument();

    // Advance by 10 seconds to trigger auto-rotation
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText(/"Quote two"/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('cleans up interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = render(<RotatingQuoteCard quotes={sampleQuotes} />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('does not set up timer when fewer than 2 quotes', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const { unmount } = render(<RotatingQuoteCard quotes={[sampleQuotes[0]]} />);
    unmount();

    // No interval was created, so clearInterval was never called
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });
});
