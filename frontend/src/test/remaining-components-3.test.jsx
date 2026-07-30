import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    'X', 'Sparkles', 'Edit3', 'PlayCircle', 'FileText', 'Mic', 'Clock',
    'Calendar', 'ExternalLink', 'Tag', 'Search', 'Compass', 'BookOpen',
    'User', 'Settings', 'PieChart', 'AlertTriangle',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': `icon-${name}`, className }, name);
  });
  return mock;
});

vi.mock('echarts-for-react', () => ({
  default: () => React.createElement('div', { 'data-testid': 'echarts-react' }),
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return { ...actual, createPortal: (children) => children };
});

vi.mock('cmdk', () => {
  const CommandComponent = React.forwardRef(({ children, ...props }, ref) => {
    // Simulate cmdk's built-in Escape key handling: when Escape is pressed
    // while the palette is open, toggle via Ctrl+K to close.
    React.useEffect(() => {
      const handler = (e) => {
        if (e.key === 'Escape') {
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k', ctrlKey: true, bubbles: true, cancelable: true,
          }));
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, []);
    return React.createElement('div', { 'data-testid': 'cmdk-command', ref, ...props }, children);
  });
  CommandComponent.Input = React.forwardRef(({ placeholder, ...props }, ref) =>
    React.createElement('input', { placeholder, 'data-testid': 'cmdk-input', ref, ...props })
  );
  CommandComponent.List = ({ children, ...props }) =>
    React.createElement('div', { 'data-testid': 'cmdk-list', ...props }, children);
  CommandComponent.Empty = ({ children, ...props }) =>
    React.createElement('div', { 'data-testid': 'cmdk-empty', ...props }, children);
  CommandComponent.Group = ({ children, heading, ...props }) =>
    React.createElement('div', { 'data-testid': 'cmdk-group', 'data-heading': heading, ...props }, children);
  CommandComponent.Item = ({ children, onSelect, ...props }) =>
    React.createElement('div', { 'data-testid': 'cmdk-item', onClick: () => onSelect?.(), ...props }, children);
  return { Command: CommandComponent };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../components/ConfirmModal/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, danger }) => {
    if (!isOpen) return null;
    return React.createElement('div', { 'data-testid': 'confirm-modal' },
      React.createElement('h3', { 'data-testid': 'confirm-title' }, title),
      React.createElement('p', { 'data-testid': 'confirm-message' }, message),
      React.createElement('button', {
        'data-testid': 'confirm-confirm-btn',
        onClick: () => { onConfirm(); onClose(); },
      }, confirmText || '确定'),
      React.createElement('button', {
        'data-testid': 'confirm-cancel-btn',
        onClick: onClose,
      }, cancelText || '取消')
    );
  },
}));

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import { DetailDrawer } from '../components/DetailDrawer/DetailDrawer';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';

// ---------------------------------------------------------------------------
// DetailDrawer
// ---------------------------------------------------------------------------

describe('DetailDrawer', () => {
  const baseData = {
    id: 'item-1',
    title: '测试标题',
    platform: 'Bilibili',
    author: '测试作者',
    duration: '10:30',
    date: '2024-01-15',
    url: 'https://example.com/article',
    aiSummary: '这是一个AI生成的摘要内容。',
    knowledgeScore: 85,
    processStatus: 'COMPLETED',
    hasNote: false,
  };

  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    data: baseData,
    draftNote: '',
    suggestedKeywords: [],
    selectedKeywords: [],
    onNoteChange: vi.fn(),
    onToggleKeyword: vi.fn(),
    onAddKeyword: vi.fn(),
    onDeleteKeyword: vi.fn(),
    onUpgrade: vi.fn(),
    isUpgrading: false,
    onTogglePremium: vi.fn(),
    onRegenerateSummary: vi.fn(),
    sourceTitle: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // 1
  it('does not render when isOpen=false', () => {
    render(<DetailDrawer {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('测试标题')).not.toBeInTheDocument();
  });

  // 2
  it('renders when isOpen=true with title', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('测试标题')).toBeInTheDocument();
  });

  // 2b – title from sourceTitle prop
  it('renders sourceTitle prop as title when provided', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} sourceTitle="自定义标题" />);
    expect(screen.getByText('自定义标题')).toBeInTheDocument();
  });

  // 3
  it('shows platform and author metadata', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Bilibili')).toBeInTheDocument();
    expect(screen.getByText('测试作者')).toBeInTheDocument();
  });

  // 4
  it('shows watch duration and date', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  // 5
  it('shows source URL link', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    const link = screen.getByText('查看原文').closest('a');
    expect(link).toHaveAttribute('href', 'https://example.com/article');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // 6
  it('shows AI summary card with summary text', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('AI 智能摘要')).toBeInTheDocument();
    expect(screen.getByText('这是一个AI生成的摘要内容。')).toBeInTheDocument();
  });

  // 7
  it('shows skeleton loading when UNPROCESSED and no aiSummary', () => {
    const unprocessedData = {
      ...baseData,
      aiSummary: null,
      processStatus: 'UNPROCESSED',
    };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={unprocessedData} />);
    expect(screen.getByText('正在全力分析知识结构...')).toBeInTheDocument();
    // skeleton lines should exist
    expect(document.querySelector('.drawer-skeleton-line')).toBeInTheDocument();
  });

  // 8
  it('shows regenerate button when no aiSummary and status !== UNPROCESSED', () => {
    const failedData = {
      ...baseData,
      aiSummary: null,
      processStatus: 'FAILED',
    };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={failedData} />);
    expect(screen.getByText('重新生成摘要')).toBeInTheDocument();
  });

  // 9
  it('shows knowledge score tag', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('知识评分：85')).toBeInTheDocument();
  });

  // 10
  it('shows notes textarea with draftNote', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} draftNote="我的笔记内容" />);
    const textarea = screen.getByPlaceholderText('这一刻什么打动了你？记录下来，将其升格为优质信息源...');
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('我的笔记内容');
  });

  // 10b – falls back to data.note when draftNote is undefined
  it('shows notes textarea with data.note when draftNote is undefined', () => {
    const dataWithNote = { ...baseData, note: '已有笔记' };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={dataWithNote} draftNote={undefined} />);
    const textarea = screen.getByPlaceholderText('这一刻什么打动了你？记录下来，将其升格为优质信息源...');
    expect(textarea.value).toBe('已有笔记');
  });

  // 11
  it('shows keyword chips with click handler', async () => {
    const onToggleKeyword = vi.fn();
    const keywords = [
      { label: 'React', confidence: 0.95 },
      { label: '前端', reason: '涉及前端技术' },
    ];
    render(
      <DetailDrawer
        {...defaultProps}
        isOpen={true}
        suggestedKeywords={keywords}
        selectedKeywords={['React']}
        onToggleKeyword={onToggleKeyword}
      />
    );
    expect(screen.getByText(/React/)).toBeInTheDocument();
    expect(screen.getByText(/前端/)).toBeInTheDocument();

    // Click the React chip to toggle
    const reactChip = screen.getByText(/React/).closest('.keyword-chip');
    await userEvent.setup().click(reactChip);
    expect(onToggleKeyword).toHaveBeenCalledWith('React');
  });

  // 12
  it('shows "添加关键词" button', () => {
    const onAddKeyword = vi.fn();
    render(<DetailDrawer {...defaultProps} isOpen={true} onAddKeyword={onAddKeyword} />);
    const btn = screen.getByText('+ 添加关键词');
    expect(btn).toBeInTheDocument();
  });

  // 13
  it('shows nutrition bars when data available', () => {
    const nutritionData = {
      ...baseData,
      nutritionProtein: 30,
      nutritionCarbs: 25,
      nutritionVitamins: 15,
      nutritionFats: 20,
      nutritionFiber: 10,
    };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={nutritionData} />);
    expect(screen.getByText('数字营养成分')).toBeInTheDocument();
    expect(screen.getByText('蛋白质（深度知识）')).toBeInTheDocument();
    expect(screen.getByText('碳水（实用技能）')).toBeInTheDocument();
    expect(screen.getByText('维生素（创意灵感）')).toBeInTheDocument();
    expect(screen.getByText('脂肪（纯娱乐）')).toBeInTheDocument();
    expect(screen.getByText('纤维（哲思冥想）')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  // 14
  it('does NOT show nutrition bars when no data', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.queryByText('数字营养成分')).not.toBeInTheDocument();
  });

  // 14b – all zeros should also not render
  it('does NOT show nutrition bars when all values are zero', () => {
    const zeroNutrition = {
      ...baseData,
      nutritionProtein: 0,
      nutritionCarbs: 0,
      nutritionVitamins: 0,
      nutritionFats: 0,
      nutritionFiber: 0,
    };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={zeroNutrition} />);
    expect(screen.queryByText('数字营养成分')).not.toBeInTheDocument();
  });

  // 15
  it('shows "升格为优质信息源" button', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} />);
    expect(screen.getByText('升格为优质信息源')).toBeInTheDocument();
  });

  // 16
  it('shows "取消优质信息源标识" when already premium', () => {
    const premiumData = { ...baseData, hasNote: true };
    render(<DetailDrawer {...defaultProps} isOpen={true} data={premiumData} />);
    expect(screen.getByText('取消优质信息源标识')).toBeInTheDocument();
    expect(screen.queryByText('升格为优质信息源')).not.toBeInTheDocument();
  });

  // 17
  it('shows loading spinner when isUpgrading', () => {
    render(<DetailDrawer {...defaultProps} isOpen={true} isUpgrading={true} />);
    expect(screen.getByText('AI 正在分析领域...')).toBeInTheDocument();
    expect(screen.queryByText('升格为优质信息源')).not.toBeInTheDocument();
  });

  // 18
  it('close button works', async () => {
    const onClose = vi.fn();
    render(<DetailDrawer {...defaultProps} isOpen={true} onClose={onClose} />);
    const closeBtn = screen.getByTestId('icon-X').closest('button');
    await userEvent.setup().click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 19
  it('delete keyword confirmation modal', async () => {
    const keywords = [{ label: 'React', confidence: 0.95 }];
    render(
      <DetailDrawer
        {...defaultProps}
        isOpen={true}
        suggestedKeywords={keywords}
      />
    );
    // Click the X button on the keyword chip to trigger delete confirmation
    const deleteBtn = screen.getByTitle('彻底删除该关键词');
    await userEvent.setup().click(deleteBtn);

    // ConfirmModal should appear
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-title')).toHaveTextContent('删除关键词');
    expect(screen.getByTestId('confirm-message')).toHaveTextContent('React');
  });
});

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // 1
  it('does NOT render when closed (default)', () => {
    render(<CommandPalette />);
    expect(screen.queryByTestId('cmdk-command')).not.toBeInTheDocument();
    expect(screen.queryByText('仪表盘 (Dashboard)')).not.toBeInTheDocument();
  });

  // 2
  it('opens on Ctrl+K', () => {
    render(<CommandPalette />);
    expect(screen.queryByTestId('cmdk-command')).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    expect(screen.getByTestId('cmdk-command')).toBeInTheDocument();
  });

  // 3
  it('closes on Ctrl+K toggle', () => {
    render(<CommandPalette />);

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('cmdk-command')).toBeInTheDocument();

    // Close
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.queryByTestId('cmdk-command')).not.toBeInTheDocument();
  });

  // 4
  it('closes on overlay click', async () => {
    render(<CommandPalette />);

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('cmdk-command')).toBeInTheDocument();

    // Click overlay (the div with class cmdk-overlay)
    const overlay = document.querySelector('.cmdk-overlay');
    await userEvent.setup().click(overlay);

    expect(screen.queryByTestId('cmdk-command')).not.toBeInTheDocument();
  });

  // 5
  it('renders navigation items: Dashboard, Inbox, Knowledge Graph, Report, Social', () => {
    render(<CommandPalette />);

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    expect(screen.getByText(/仪表盘/)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/捕获箱/)).toBeInTheDocument();
    expect(screen.getByText(/Inbox/)).toBeInTheDocument();
    expect(screen.getByText(/知识图谱/)).toBeInTheDocument();
    expect(screen.getByText(/Knowledge Graph/)).toBeInTheDocument();
    expect(screen.getByText(/数字报告/)).toBeInTheDocument();
    expect(screen.getByText(/Report/)).toBeInTheDocument();
    expect(screen.getByText(/社交发现/)).toBeInTheDocument();
    expect(screen.getByText(/Social/)).toBeInTheDocument();
  });

  // 6
  it('renders Settings section', () => {
    render(<CommandPalette />);

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    expect(screen.getByText(/设置/)).toBeInTheDocument();
    expect(screen.getByText('设置 (Settings)')).toBeInTheDocument();
  });

  // 7
  it('renders Command.Input with placeholder', () => {
    render(<CommandPalette />);

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    const input = screen.getByTestId('cmdk-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search anything... (Type a command)');
  });

  // 8
  it('shows "No results found" empty state', () => {
    render(<CommandPalette />);

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });

    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  // 9
  it('closes on Escape key', () => {
    render(<CommandPalette />);

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('cmdk-command')).toBeInTheDocument();

    // Press Escape — mock translates this to a Ctrl+K toggle which closes
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.queryByTestId('cmdk-command')).not.toBeInTheDocument();
  });

  // 10
  it('prevents default on Ctrl+K', () => {
    render(<CommandPalette />);

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => {
      document.dispatchEvent(event);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
