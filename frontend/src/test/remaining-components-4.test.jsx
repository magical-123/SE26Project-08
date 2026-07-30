import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
    'Clock', 'PlayCircle', 'FileText', 'Mic', 'ArrowUpRight',
    'Heart', 'Star', 'Sparkles',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, fill, color, ...props }) =>
      React.createElement('span', {
        ...props,
        'data-testid': `icon-${name}`,
        'data-fill': fill,
        'data-color': color,
        className,
      }, name);
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

import { DynamicWordCloud } from '../components/DynamicWordCloud/DynamicWordCloud';
import { InfoSourceCard } from '../components/InfoSourceCard/InfoSourceCard';

// ===========================================================================
// DynamicWordCloud
// ===========================================================================

describe('DynamicWordCloud', () => {
  const sampleData = [
    { name: '大模型架构', value: 100 },
    { name: 'React 19', value: 50 },
    { name: 'Framer Motion', value: 25 },
    { name: 'WebGL 渲染', value: 10 },
  ];

  // -----------------------------------------------------------------------
  // 1. Renders all words from data array
  // -----------------------------------------------------------------------
  it('renders all words from data array', () => {
    render(<DynamicWordCloud data={sampleData} />);

    expect(screen.getByText('大模型架构')).toBeInTheDocument();
    expect(screen.getByText('React 19')).toBeInTheDocument();
    expect(screen.getByText('Framer Motion')).toBeInTheDocument();
    expect(screen.getByText('WebGL 渲染')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Word font size proportional to value (bigger value = bigger font)
  // -----------------------------------------------------------------------
  it('word font size proportional to value - bigger value gets bigger font', () => {
    render(<DynamicWordCloud data={sampleData} />);

    const maxWord = screen.getByText('大模型架构');
    const minWord = screen.getByText('WebGL 渲染');

    const maxFontSize = parseFloat(maxWord.style.fontSize);
    const minFontSize = parseFloat(minWord.style.fontSize);

    expect(maxFontSize).toBeGreaterThan(minFontSize);

    // Max value (100): fontSize = 12 + (100/100) * 36 = 48
    expect(maxFontSize).toBe(48);

    // Min value (10): fontSize = 12 + (10/100) * 36 = 12 + 3.6 = 15.6
    expect(minFontSize).toBeCloseTo(15.6, 1);
  });

  // -----------------------------------------------------------------------
  // 3. Click on word calls onWordClick with word name
  // -----------------------------------------------------------------------
  it('click on word calls onWordClick with word name', () => {
    const onWordClick = vi.fn();
    render(<DynamicWordCloud data={sampleData} onWordClick={onWordClick} />);

    fireEvent.click(screen.getByText('React 19'));
    expect(onWordClick).toHaveBeenCalledTimes(1);
    expect(onWordClick).toHaveBeenCalledWith('React 19');

    fireEvent.click(screen.getByText('大模型架构'));
    expect(onWordClick).toHaveBeenCalledTimes(2);
    expect(onWordClick).toHaveBeenCalledWith('大模型架构');
  });

  // -----------------------------------------------------------------------
  // 4. Words positioned based on POSITIONS map or fallback to center
  // -----------------------------------------------------------------------
  it('words positioned based on POSITIONS map or fallback to center', () => {
    const data = [
      { name: '大模型架构', value: 100 },    // in POSITIONS map
      { name: 'Unknown Word', value: 50 },  // NOT in POSITIONS map → fallback
    ];

    render(<DynamicWordCloud data={data} />);

    const knownWord = screen.getByText('大模型架构');
    expect(knownWord.style.top).toBe('45%');
    expect(knownWord.style.left).toBe('45%');

    const unknownWord = screen.getByText('Unknown Word');
    // Fallback position when name is not in POSITIONS map
    expect(unknownWord.style.top).toBe('50%');
    expect(unknownWord.style.left).toBe('50%');
  });

  // -----------------------------------------------------------------------
  // 5. Word color assigned from COLORS array
  // -----------------------------------------------------------------------
  it('word color assigned from COLORS array', () => {
    render(<DynamicWordCloud data={sampleData} />);

    // First item gets COLORS[0], second gets COLORS[1], etc.
    const word0 = screen.getByText('大模型架构');
    const word1 = screen.getByText('React 19');
    const word2 = screen.getByText('Framer Motion');
    const word3 = screen.getByText('WebGL 渲染');

    // COLORS[0] = '#0EA5E9', COLORS[1] = '#F43F5E', etc.
    expect(word0.style.color).toBe('rgb(14, 165, 233)');
    expect(word1.style.color).toBe('rgb(244, 63, 94)');
    expect(word2.style.color).toBe('rgb(139, 92, 246)');
    expect(word3.style.color).toBe('rgb(16, 185, 129)');
  });

  // -----------------------------------------------------------------------
  // 6. Word opacity based on value ratio
  // -----------------------------------------------------------------------
  it('word opacity based on value ratio', () => {
    render(<DynamicWordCloud data={sampleData} />);

    const maxWord = screen.getByText('大模型架构');
    const minWord = screen.getByText('WebGL 渲染');

    // Max value (100): opacity = 0.4 + 1.0 * 0.6 = 1.0
    expect(parseFloat(maxWord.style.opacity)).toBe(1);

    // Min value (10): opacity = 0.4 + 0.1 * 0.6 = 0.46
    expect(parseFloat(minWord.style.opacity)).toBeCloseTo(0.46, 2);
  });

  // -----------------------------------------------------------------------
  // 7. Handles empty data array gracefully
  // -----------------------------------------------------------------------
  it('handles empty data array gracefully', () => {
    const { container } = render(<DynamicWordCloud data={[]} />);

    // Container should render, no words
    expect(container.querySelector('.dynamic-wordcloud-container')).toBeInTheDocument();
    expect(container.querySelector('.dw-word')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Handles all items at max value (no division by zero)
  // -----------------------------------------------------------------------
  it('handles all items at max value - no division by zero', () => {
    const data = [
      { name: '大模型架构', value: 100 },
      { name: 'React 19', value: 100 },
      { name: 'Framer Motion', value: 100 },
    ];

    render(<DynamicWordCloud data={data} />);

    // All items have maxValue ratio = 1, so fontSize = 12 + 36 = 48
    const words = ['大模型架构', 'React 19', 'Framer Motion'];
    words.forEach((name) => {
      const el = screen.getByText(name);
      expect(parseFloat(el.style.fontSize)).toBe(48);
      expect(parseFloat(el.style.opacity)).toBe(1);
    });
  });
});

// ===========================================================================
// InfoSourceCard
// ===========================================================================

describe('InfoSourceCard', () => {
  const baseData = {
    id: '1',
    title: 'Test Title',
    author: 'Test Author',
    platform: 'Bilibili',
    duration: '10:00',
    date: '2024-01-01',
    keywords: ['react', 'testing'],
    isLiked: false,
    isFavorite: false,
    aiSummary: 'summary',
    processStatus: 'COMPLETED',
  };

  const onClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Handles null/missing keywords (no crash)
  // -----------------------------------------------------------------------
  it('handles null keywords without crashing', () => {
    const data = { ...baseData, keywords: null };
    render(<InfoSourceCard data={data} />);
    // Should render without error and show the title
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('handles undefined keywords without crashing', () => {
    const data = { ...baseData };
    delete data.keywords;
    render(<InfoSourceCard data={data} />);
    // Should render without error and show the title
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 2. Shows extract knowledge button
  // -----------------------------------------------------------------------
  it('shows extract knowledge button', () => {
    render(<InfoSourceCard data={baseData} />);
    expect(screen.getByText('提取知识')).toBeInTheDocument();
    expect(screen.getByTestId('icon-ArrowUpRight')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 3. Clicking extract button calls onClick
  // -----------------------------------------------------------------------
  it('clicking extract button calls onClick with data', () => {
    render(<InfoSourceCard data={baseData} onClick={onClick} />);

    const extractBtn = screen.getByText('提取知识').closest('button');
    fireEvent.click(extractBtn);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(baseData);
  });

  // -----------------------------------------------------------------------
  // 4. Shows liked indicator (red heart) when isLiked
  // -----------------------------------------------------------------------
  it('shows liked indicator (red heart) when isLiked', () => {
    const data = { ...baseData, isLiked: true };
    render(<InfoSourceCard data={data} />);

    const heartIcon = screen.getByTestId('icon-Heart');
    expect(heartIcon).toBeInTheDocument();
    expect(heartIcon.getAttribute('data-fill')).toBe('#EF4444');
  });

  it('does not show liked indicator when isLiked is false', () => {
    render(<InfoSourceCard data={baseData} />);

    const heartIcon = screen.getByTestId('icon-Heart');
    expect(heartIcon.getAttribute('data-fill')).toBe('none');
  });

  // -----------------------------------------------------------------------
  // 5. Shows favorited indicator (gold star) when isFavorite
  // -----------------------------------------------------------------------
  it('shows favorited indicator (gold star) when isFavorite', () => {
    const data = { ...baseData, isFavorite: true };
    render(<InfoSourceCard data={data} />);

    const starIcon = screen.getByTestId('icon-Star');
    expect(starIcon).toBeInTheDocument();
    expect(starIcon.getAttribute('data-fill')).toBe('#F59E0B');
  });

  it('does not show favorited indicator when isFavorite is false', () => {
    render(<InfoSourceCard data={baseData} />);

    const starIcon = screen.getByTestId('icon-Star');
    expect(starIcon.getAttribute('data-fill')).toBe('none');
  });

  // -----------------------------------------------------------------------
  // 6. Both like and favorite indicators visible simultaneously
  // -----------------------------------------------------------------------
  it('both like and favorite indicators visible simultaneously', () => {
    const data = { ...baseData, isLiked: true, isFavorite: true };
    render(<InfoSourceCard data={data} />);

    const heartIcon = screen.getByTestId('icon-Heart');
    const starIcon = screen.getByTestId('icon-Star');

    expect(heartIcon).toBeInTheDocument();
    expect(heartIcon.getAttribute('data-fill')).toBe('#EF4444');
    expect(starIcon).toBeInTheDocument();
    expect(starIcon.getAttribute('data-fill')).toBe('#F59E0B');
  });

  // -----------------------------------------------------------------------
  // 7. Shows AI analysis badge when processStatus UNPROCESSED
  // -----------------------------------------------------------------------
  it('shows AI analysis badge when processStatus UNPROCESSED and no aiSummary', () => {
    const data = { ...baseData, aiSummary: null, processStatus: 'UNPROCESSED' };
    render(<InfoSourceCard data={data} />);

    expect(screen.getByText('AI 分析中...')).toBeInTheDocument();
  });

  it('does not show AI analysis badge when processStatus is not UNPROCESSED', () => {
    const data = { ...baseData, aiSummary: null, processStatus: 'PROCESSING' };
    render(<InfoSourceCard data={data} />);

    expect(screen.queryByText('AI 分析中...')).not.toBeInTheDocument();
  });

  it('does not show AI analysis badge when aiSummary exists even if UNPROCESSED', () => {
    const data = { ...baseData, aiSummary: 'has summary', processStatus: 'UNPROCESSED' };
    render(<InfoSourceCard data={data} />);

    expect(screen.queryByText('AI 分析中...')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 8. Shows platform-specific icons correctly
  // -----------------------------------------------------------------------
  it('shows PlayCircle icon for Bilibili platform', () => {
    render(<InfoSourceCard data={{ ...baseData, platform: 'Bilibili' }} />);

    expect(screen.getByText('Bilibili')).toBeInTheDocument();
    expect(screen.getByTestId('icon-PlayCircle')).toBeInTheDocument();
  });

  it('shows FileText icon for Zhihu platform', () => {
    render(<InfoSourceCard data={{ ...baseData, platform: 'Zhihu' }} />);

    expect(screen.getByText('Zhihu')).toBeInTheDocument();
    expect(screen.getByTestId('icon-FileText')).toBeInTheDocument();
  });

  it('falls back to FileText icon for unknown platform', () => {
    render(<InfoSourceCard data={{ ...baseData, platform: 'UnknownPlatform' }} />);

    expect(screen.getByText('UnknownPlatform')).toBeInTheDocument();
    expect(screen.getByTestId('icon-FileText')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // 9. Premium badge shows correct label
  // -----------------------------------------------------------------------
  it('shows premium badge with correct label', () => {
    render(<InfoSourceCard data={baseData} isPremium premiumLabel="精选" />);

    expect(screen.getByText('精选')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Sparkles')).toBeInTheDocument();
  });

  it('shows premium badge with custom label', () => {
    render(<InfoSourceCard data={baseData} isPremium premiumLabel="优质" />);

    expect(screen.getByText('优质')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Sparkles')).toBeInTheDocument();
  });

  it('does not show premium badge when isPremium is false', () => {
    render(<InfoSourceCard data={baseData} isPremium={false} premiumLabel="精选" />);

    expect(screen.queryByText('精选')).not.toBeInTheDocument();
  });
});
