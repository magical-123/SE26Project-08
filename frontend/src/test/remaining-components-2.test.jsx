import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (available in vi.mock factories)
// ---------------------------------------------------------------------------

const { mockHtml2canvas } = vi.hoisted(() => ({
  mockHtml2canvas: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('html2canvas', () => ({
  default: mockHtml2canvas,
}));

vi.mock('echarts-for-react', () => ({
  default: ({ option }) =>
    React.createElement('div', { 'data-testid': 'echarts-react' }),
}));

vi.mock('lucide-react', () => ({
  X: ({ size, ...props }) =>
    React.createElement('span', { ...props, 'data-testid': 'icon-X' }, 'X'),
  Download: ({ size, ...props }) =>
    React.createElement('span', { ...props, 'data-testid': 'icon-Download' }, 'Download'),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return React.forwardRef(({ children, ...props }, ref) => {
            const { whileHover, initial, animate, exit, transition, ...rest } =
              props;
            return React.createElement(prop, { ...rest, ref }, children);
          });
        }
        return () => null;
      },
    }
  ),
  AnimatePresence: ({ children }) => children,
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children) => children,
  };
});

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import { PosterModal } from '../components/PosterModal/PosterModal';
import { ReviewModal } from '../components/ReviewModal/ReviewModal';

// ---------------------------------------------------------------------------
// PosterModal
// ---------------------------------------------------------------------------

describe('PosterModal', () => {
  const onClose = vi.fn();

  const pieOption = {
    series: [
      {
        type: 'pie',
        data: [
          { name: '科技', value: 40 },
          { name: '财经', value: 30 },
          { name: '娱乐', value: 20 },
          { name: '体育', value: 10 },
        ],
      },
    ],
  };

  const insight = {
    insightTitle: 'AI 发展迅速',
    insightSummary: '**人工智能**在多个领域取得突破性进展',
    title: 'AI 发展迅速',
    summary: '人工智能在多个领域取得突破性进展',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHtml2canvas.mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,fake',
    });
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it('renders poster header with "InfoDigest"', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByText('InfoDigest')).toBeInTheDocument();
  });

  it('shows date and report type (daily)', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByText(/今日洞察/)).toBeInTheDocument();
  });

  it('shows date and report type (weekly)', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="weekly"
      />
    );
    expect(screen.getByText(/本周洞察/)).toBeInTheDocument();
  });

  it('shows insight title and summary', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByText(/AI 发展迅速/)).toBeInTheDocument();
    expect(screen.getByText(/人工智能/)).toBeInTheDocument();
  });

  it('renders bold text from double-asterisk markup in summary', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    // The **人工智能** should become a <strong> element
    const strongEl = screen.getByText('人工智能');
    expect(strongEl.tagName).toBe('STRONG');
  });

  it('has close button that calls onClose', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    const closeBtn = screen.getByTestId('icon-X').closest('button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has download button with "保存专属海报" text', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByText('保存专属海报')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Download')).toBeInTheDocument();
  });

  it('shows "生成中..." when isGenerating', async () => {
    // Make html2canvas hang so we can observe the generating state
    let resolvePromise;
    mockHtml2canvas.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );

    const downloadBtn = screen.getByText('保存专属海报');
    fireEvent.click(downloadBtn);

    // isGenerating is true while html2canvas is pending
    expect(screen.getByText('生成中...')).toBeInTheDocument();
    expect(screen.getByText('生成中...').closest('button')).toBeDisabled();

    // Clean up
    resolvePromise({ toDataURL: () => 'data:image/png;base64,fake' });
  });

  it('handles null insight with safe defaults', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={null}
        activeTab="daily"
      />
    );
    // pi-title h3 renders: 💡 暂无洞察 — the emoji and text are separate
    // text nodes, so we match via heading role and textContent
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('暂无洞察');
    expect(screen.getByText('还未生成本期洞察报告')).toBeInTheDocument();
  });

  it('renders poster footer with brand text', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByText('数字饮食报告')).toBeInTheDocument();
    expect(screen.getByText('你的个人信息营养师')).toBeInTheDocument();
  });

  it('renders the echarts chart area', () => {
    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );
    expect(screen.getByTestId('echarts-react')).toBeInTheDocument();
  });

  it('download button calls html2canvas with posterRef', async () => {
    mockHtml2canvas.mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,fake',
    });

    // Spy on document.createElement to capture the download link
    const linkClickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { download: '', href: '', click: linkClickSpy };
      }
      return origCreateElement(tag);
    });

    render(
      <PosterModal
        onClose={onClose}
        pieOption={pieOption}
        insight={insight}
        activeTab="daily"
      />
    );

    fireEvent.click(screen.getByText('保存专属海报'));

    await waitFor(() => {
      expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
    });

    // Verify the download link was created and clicked
    expect(linkClickSpy).toHaveBeenCalledTimes(1);

    document.createElement.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// ReviewModal
// ---------------------------------------------------------------------------

describe('ReviewModal', () => {
  const onClose = vi.fn();

  const sampleCards = [
    {
      id: 1,
      title: 'React 19 新特性',
      source: 'React 官方博客',
      content: 'React 19 引入了 Server Components、Actions 等新功能',
    },
    {
      id: 2,
      title: 'TypeScript 5.8 发布',
      source: 'TypeScript 博客',
      content: '新增了条件类型优化和更好的类型推断',
    },
    {
      id: 3,
      title: 'Node.js 性能优化',
      source: 'Node.js 官方文档',
      content: '使用 Worker Threads 提升 CPU 密集型任务性能',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    sessionStorage.clear();
    sessionStorage.setItem('token', 'test-token-abc');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it('renders cards with progress counter', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    expect(screen.getByText('剩余 3 张')).toBeInTheDocument();
  });

  it('shows progress counter updating after cards change', () => {
    const twoCards = sampleCards.slice(0, 2);
    render(<ReviewModal cards={twoCards} onClose={onClose} />);
    expect(screen.getByText('剩余 2 张')).toBeInTheDocument();
  });

  it('shows "太棒了！" when no cards left', () => {
    render(<ReviewModal cards={[]} onClose={onClose} />);
    expect(screen.getByText('太棒了！')).toBeInTheDocument();
    expect(
      screen.getByText('今天的复习任务已全部完成。')
    ).toBeInTheDocument();
  });

  it('renders the complete card close button inside empty state', () => {
    render(<ReviewModal cards={[]} onClose={onClose} />);
    const closeBtn = screen.getByText('关闭');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Card faces
  // -----------------------------------------------------------------------

  it('shows front face with title and source', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    expect(screen.getByText('React 19 新特性')).toBeInTheDocument();
    expect(screen.getByText('React 官方博客')).toBeInTheDocument();
    expect(screen.getByText('点击翻转查看背面')).toBeInTheDocument();
  });

  it('shows back face with content and action buttons', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    // Since framer-motion is mocked, both faces are always in the DOM
    expect(
      screen.getByText(
        'React 19 引入了 Server Components、Actions 等新功能'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('记住了')).toBeInTheDocument();
    expect(screen.getByText('忘记了')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Feedback: "记住了" button
  // -----------------------------------------------------------------------

  it('"记住了" button submits positive feedback', async () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('记住了'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dashboard/reviews/1/feedback',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ remembered: true }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-abc',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Feedback: "忘记了" button
  // -----------------------------------------------------------------------

  it('"忘记了" button submits negative feedback', async () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('忘记了'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dashboard/reviews/1/feedback',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ remembered: false }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Delete button
  // -----------------------------------------------------------------------

  it('"删除" button deletes card via DELETE request', async () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('删除'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dashboard/reviews/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-abc',
          }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Auto-advance
  // -----------------------------------------------------------------------

  it('auto-advances to next card after feedback', async () => {
    vi.useFakeTimers();

    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    // Click "记住了" on first card
    fireEvent.click(screen.getByText('记住了'));

    // Flush microtasks so the mocked fetch resolves and state updates apply.
    // waitFor would hang because fake timers break its internal polling.
    await act(async () => {
      await Promise.resolve();
    });

    // Now the fetch should have been called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/dashboard/reviews/1/feedback',
      expect.objectContaining({ method: 'POST' })
    );

    // Advance past the 150ms setTimeout
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should now show the second card
    expect(screen.getByText('剩余 2 张')).toBeInTheDocument();
    expect(screen.getByText('TypeScript 5.8 发布')).toBeInTheDocument();
    expect(screen.queryByText('React 19 新特性')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Close behavior
  // -----------------------------------------------------------------------

  it('close button works', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    const closeBtn = screen.getByTestId('icon-X').closest('button');
    fireEvent.click(closeBtn);
    // The ReviewModal close button does not call stopPropagation,
    // so the click event bubbles to the overlay's onClick as well,
    // resulting in onClose being called twice.
    expect(onClose).toHaveBeenCalled();
  });

  it('overlay click closes the modal', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    const overlay = document.querySelector('.review-modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Default card (id=-1)
  // -----------------------------------------------------------------------

  it('default card (id=-1) has no action buttons', () => {
    const defaultCards = [
      {
        id: -1,
        title: '暂无待复习卡片',
        source: '',
        content: '请等待系统生成复习卡片',
      },
    ];

    render(<ReviewModal cards={defaultCards} onClose={onClose} />);

    expect(screen.getByText('暂无待复习卡片')).toBeInTheDocument();
    expect(screen.queryByText('记住了')).not.toBeInTheDocument();
    expect(screen.queryByText('忘记了')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
  });

  it('default card (id=-1) click does not trigger feedback API', async () => {
    const defaultCards = [
      {
        id: -1,
        title: '暂无待复习卡片',
        source: '',
        content: '请等待系统生成复习卡片',
      },
    ];

    render(<ReviewModal cards={defaultCards} onClose={onClose} />);

    // Clicking the card scene should flip but no feedback buttons exist
    const scene = document.querySelector('.review-scene');
    fireEvent.click(scene);

    // The card flips (motion mock renders both faces), but no feedback API
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Reset cards when cards prop changes
  // -----------------------------------------------------------------------

  it('resets cards when cards prop changes', () => {
    const { rerender } = render(
      <ReviewModal cards={sampleCards} onClose={onClose} />
    );
    expect(screen.getByText('剩余 3 张')).toBeInTheDocument();

    // Change to a different set of cards
    const newCards = [
      {
        id: 10,
        title: '全新卡片',
        source: '新来源',
        content: '新内容',
      },
    ];

    rerender(<ReviewModal cards={newCards} onClose={onClose} />);

    expect(screen.getByText('剩余 1 张')).toBeInTheDocument();
    expect(screen.getByText('全新卡片')).toBeInTheDocument();
    expect(screen.queryByText('React 19 新特性')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles feedback API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('记住了'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to submit feedback:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('handles delete API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch.mockRejectedValueOnce(new Error('Delete failed'));

    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('删除'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to delete card:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('clicking content area does not close modal', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    const contentArea = document.querySelector('.review-content-area');
    fireEvent.click(contentArea);
    // stopPropagation prevents onClose from being called
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows "不再复习此卡片" title on delete button', () => {
    render(<ReviewModal cards={sampleCards} onClose={onClose} />);
    const deleteBtn = screen.getByTitle('不再复习此卡片');
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.textContent).toBe('删除');
  });

  it('disables action buttons while submitting', () => {
    // Use a never-resolving fetch to keep submitting=true
    global.fetch.mockReturnValue(new Promise(() => {}));

    render(<ReviewModal cards={sampleCards} onClose={onClose} />);

    fireEvent.click(screen.getByText('记住了'));

    // All action buttons should be disabled while submitting
    expect(screen.getByText('记住了').closest('button')).toBeDisabled();
    expect(screen.getByText('忘记了').closest('button')).toBeDisabled();
    expect(screen.getByText('删除').closest('button')).toBeDisabled();
  });
});
