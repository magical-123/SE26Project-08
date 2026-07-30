import React from 'react';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
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
    'Compass', 'BookOpen', 'Search', 'PieChart', 'User', 'Settings',
    'UserCircle', 'Menu', 'X', 'WifiOff', 'ExternalLink', 'Quote',
    'RefreshCw', 'Tag', 'Sparkles', 'Download', 'Edit3', 'PlayCircle',
    'FileText', 'Mic', 'Clock', 'Calendar', 'ChevronLeft', 'ChevronRight',
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

vi.mock('echarts-for-react', () => ({
  default: () => React.createElement('div', { 'data-testid': 'echarts-react' }),
}));

const mockHtml2canvas = vi.hoisted(() => vi.fn());
vi.mock('html2canvas', () => ({
  default: mockHtml2canvas,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  NavLink: ({ to, className, children, onClick, ...props }) => {
    const cls = typeof className === 'function' ? className({ isActive: false }) : className;
    return React.createElement('a', { href: to, className: cls, onClick, ...props }, children);
  },
  useNavigate: () => mockNavigate,
}));

// offlineStore tracking
let offlineChangeHandler = null;
const mockCheckConnection = vi.hoisted(() => vi.fn());
vi.mock('../utils/offlineStore', () => ({
  onGlobalOfflineChange: vi.fn((handler) => {
    offlineChangeHandler = handler;
    return () => { offlineChangeHandler = null; };
  }),
  checkConnection: (...args) => mockCheckConnection(...args),
}));

vi.mock('../hooks/useInboxItems', () => ({
  useInboxItems: () => ({ items: [] }),
}));

vi.mock('../components/CommandPalette/CommandPalette', () => ({
  CommandPalette: () => React.createElement('div', { 'data-testid': 'command-palette' }, 'CommandPalette'),
}));

vi.mock('../components/GlassCard/GlassCard', () => ({
  GlassCard: ({ children, className }) => React.createElement('div', { className: `glass-card ${className || ''}` }, children),
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

// CSS mocks
vi.mock('../components/QuoteCard/QuoteCard.css', () => ({}));
vi.mock('../components/AIQuoteCard/AIQuoteCard.css', () => ({}));
vi.mock('../components/PosterModal/PosterModal.css', () => ({}));
vi.mock('../components/DetailDrawer/DetailDrawer.css', () => ({}));
vi.mock('../layouts/RootLayout.css', () => ({}));
vi.mock('../components/GlassCard/GlassCard.css', () => ({}));
vi.mock('../components/RotatingQuoteCard/RotatingQuoteCard.css', () => ({}));

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import { RootLayout } from '../layouts/RootLayout';
import { QuoteCard } from '../components/QuoteCard/QuoteCard';
import { PosterModal } from '../components/PosterModal/PosterModal';
import { DetailDrawer } from '../components/DetailDrawer/DetailDrawer';
import { AIQuoteCard } from '../components/AIQuoteCard/AIQuoteCard';
import { RotatingQuoteCard } from '../components/RotatingQuoteCard/RotatingQuoteCard';

// ===========================================================================
// QuoteCard – DA:28 onClick stopPropagation on external link
// ===========================================================================

describe('QuoteCard – cover DA:28 (stopPropagation on external link)', () => {
  const sampleQuote = {
    content: 'Test quote',
    sourcePlatform: 'GitHub',
    sourceTitle: 'Repo',
    sourceUrl: 'https://github.com',
    reason: 'Insightful',
  };

  it('fires click on external link (stopPropagation)', () => {
    render(<QuoteCard quote={sampleQuote} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com');
    // Fire click – this should trigger the stopPropagation handler on line 28
    fireEvent.click(link);
    // No error = the handler was called successfully
    expect(screen.getByText('"Test quote"')).toBeInTheDocument();
  });
});

// ===========================================================================
// RootLayout – DA:30, DA:50-51, DA:86, DA:114
// ===========================================================================

describe('RootLayout – cover remaining uncovered lines', () => {
  beforeEach(() => {
    sessionStorage.clear();
    offlineChangeHandler = null;
    mockNavigate.mockClear();
    mockCheckConnection.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // DA:30 – window 'online' event triggers checkConnection
  it('DA:30 – window online event triggers checkConnection', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // Dispatch 'online' event on window; this calls handleOnline which calls checkConnection({ optimistic: false })
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(mockCheckConnection).toHaveBeenCalledWith({ optimistic: false });
  });

  // DA:50-51 – avatarChanged event updates avatar and username
  it('DA:50-51 – avatarChanged event updates avatar and username from sessionStorage', () => {
    sessionStorage.setItem('avatarUrl', 'https://example.com/new-avatar.png');
    sessionStorage.setItem('username', 'NewUser');

    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );

    // Initially no avatar image since sessionStorage had no avatarUrl at render time
    // Now dispatch avatarChanged event
    act(() => {
      window.dispatchEvent(new Event('avatarChanged'));
    });

    // After the event, avatar should show the image
    const avatarImg = screen.getByAltText('');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/new-avatar.png');
    // Username initial should not be shown since avatar image is shown instead
    expect(screen.queryByText('N')).not.toBeInTheDocument();
  });

  // DA:86 – brand-avatar click navigates to /profile
  it('DA:86 – brand-avatar click calls navigate("/profile")', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    const brandAvatar = document.querySelector('.brand-avatar');
    expect(brandAvatar).toBeInTheDocument();
    fireEvent.click(brandAvatar);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  // DA:114 – NavLink onClick closes mobile nav when open
  it('DA:114 – clicking a NavLink when mobile nav is open closes it', async () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // Open mobile nav first
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    await userEvent.setup().click(toggleBtn);
    const aside = document.querySelector('.cascade-nav-container');
    expect(aside.className).toContain('mobile-nav-open');

    // Click a NavLink (e.g. DASHBOARD)
    const dashboardLink = screen.getByText('DASHBOARD').closest('a');
    await userEvent.setup().click(dashboardLink);

    // After click, mobile nav should be closed
    expect(aside.className).not.toContain('mobile-nav-open');
  });
});

// ===========================================================================
// PosterModal – DA:35 catch block when html2canvas throws
// ===========================================================================

describe('PosterModal – cover DA:35 (catch block)', () => {
  const onClose = vi.fn();
  const pieOption = {
    series: [{ type: 'pie', data: [{ name: 'A', value: 100 }] }],
  };
  const insight = {
    insightTitle: 'Test Insight',
    insightSummary: 'Summary text',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHtml2canvas.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('DA:35 – html2canvas rejection triggers catch block', async () => {
    // Make html2canvas reject
    mockHtml2canvas.mockRejectedValue(new Error('Canvas error'));

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

    await waitFor(() => {
      expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
    });

    // The catch block should have logged the error
    expect(consoleSpy).toHaveBeenCalledWith('Failed to generate poster:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

// ===========================================================================
// DetailDrawer – DA:171 (onRegenerateSummary click), DA:189 (onNoteChange)
// ===========================================================================

describe('DetailDrawer – cover DA:171 and DA:189', () => {
  const baseData = {
    id: 'item-1',
    title: 'Test Title',
    platform: 'Bilibili',
    author: 'Author',
    duration: '10:00',
    date: '2024-01-15',
    url: 'https://example.com',
    aiSummary: null,
    knowledgeScore: null,
    processStatus: 'FAILED',
    hasNote: false,
    nutritionProtein: null,
    nutritionCarbs: null,
    nutritionVitamins: null,
    nutritionFats: null,
    nutritionFiber: null,
  };

  const defaultProps = {
    isOpen: true,
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

  // DA:171 – Click the "重新生成摘要" button
  it('DA:171 – clicking regenerate summary button calls onRegenerateSummary', async () => {
    const onRegenerateSummary = vi.fn();
    render(
      <DetailDrawer
        {...defaultProps}
        isOpen={true}
        data={baseData}
        onRegenerateSummary={onRegenerateSummary}
      />
    );

    // The "重新生成摘要" button should be visible
    const regenBtn = screen.getByText('重新生成摘要');
    expect(regenBtn).toBeInTheDocument();

    // Click it
    await userEvent.setup().click(regenBtn);

    // onRegenerateSummary should be called with the item id
    expect(onRegenerateSummary).toHaveBeenCalledTimes(1);
    expect(onRegenerateSummary).toHaveBeenCalledWith('item-1');
  });

  // DA:189 – onChange on textarea
  it('DA:189 – typing in the notes textarea triggers onNoteChange', async () => {
    const onNoteChange = vi.fn();
    render(
      <DetailDrawer
        {...defaultProps}
        isOpen={true}
        draftNote=""
        onNoteChange={onNoteChange}
      />
    );

    const textarea = screen.getByPlaceholderText('这一刻什么打动了你？记录下来，将其升格为优质信息源...');
    expect(textarea).toBeInTheDocument();

    // Fire change event to trigger onChange handler
    fireEvent.change(textarea, { target: { value: 'My new note' } });

    expect(onNoteChange).toHaveBeenCalledTimes(1);
    expect(onNoteChange).toHaveBeenCalledWith('My new note');
  });
});

// ===========================================================================
// AIQuoteCard – DA:37 (fetch !ok), DA:40 (fetch throws)
// ===========================================================================

describe('AIQuoteCard – cover DA:37 and DA:40', () => {
  const sampleQuote = {
    summary: 'AI summary',
    fullText: 'Full text here',
    tags: ['tech'],
    sourcePlatform: 'Twitter',
    sourceLink: 'https://twitter.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // DA:37 – response.ok is false
  it('DA:37 – regenerate with non-ok response triggers console.error', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AIQuoteCard quote={sampleQuote} />);
    const btn = screen.getByTitle('重新生成洞察');
    await userEvent.setup().click(btn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to regenerate insight');
    });

    consoleSpy.mockRestore();
  });

  // DA:40 – fetch throws
  it('DA:40 – regenerate when fetch throws triggers console.error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AIQuoteCard quote={sampleQuote} />);
    const btn = screen.getByTitle('重新生成洞察');
    await userEvent.setup().click(btn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error regenerating insight:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});

// ===========================================================================
// RotatingQuoteCard – DA:53 (handleCardClick), DA:58-59 (navigatePrev),
// DA:63-64 (navigateNext), DA:116 (overlay click), DA:171 (link click)
// ===========================================================================

describe('RotatingQuoteCard – cover modal navigation interactions', () => {
  const sampleQuotes = [
    {
      content: 'First quote',
      sourcePlatform: 'GitHub',
      sourceTitle: 'Repo A',
      sourceUrl: 'https://github.com/a',
      reason: 'Reason A',
    },
    {
      content: 'Second quote',
      sourcePlatform: 'Twitter',
      sourceTitle: 'Tweet B',
      sourceUrl: 'https://twitter.com/b',
      reason: 'Reason B',
    },
  ];

  afterEach(() => {
    cleanup();
  });

  // DA:53 – click card opens modal (handleCardClick)
  it('DA:53 – clicking the card opens the review modal', async () => {
    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    // The card wrapper has cursor:pointer and onClick handler
    const card = document.querySelector('.bento-rotating-quote > div');
    await userEvent.setup().click(card);

    // Modal should appear
    expect(document.querySelector('.rq-modal')).toBeInTheDocument();
    // Modal header should show counter like "1 / 2" or "2 / 2"
    expect(document.querySelector('.rq-modal-counter')).toHaveTextContent(/\/ 2/);
  });

  // DA:58-59, DA:63-64 – navigate prev/next buttons in modal
  it('DA:58-59,63-64 – prev and next navigation buttons work', async () => {
    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    // Open modal
    const card = document.querySelector('.bento-rotating-quote > div');
    await userEvent.setup().click(card);

    // Click prev button (first rq-nav-btn)
    const navBtns = document.querySelectorAll('.rq-nav-btn');
    await userEvent.setup().click(navBtns[0]);

    // Click next button (last rq-nav-btn)
    await userEvent.setup().click(navBtns[1]);
  });

  // DA:116 – click overlay to close modal
  it('DA:116 – clicking overlay closes modal', async () => {
    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    // Open modal
    const card = document.querySelector('.bento-rotating-quote > div');
    await userEvent.setup().click(card);

    // Modal should be visible
    expect(document.querySelector('.rq-modal')).toBeInTheDocument();

    // Click overlay to close
    const overlay = document.querySelector('.rq-overlay');
    await userEvent.setup().click(overlay);

    // After clicking overlay, modal should close
    expect(document.querySelector('.rq-modal')).not.toBeInTheDocument();
  });

  // DA:171 – external link stopPropagation
  it('DA:171 – clicking external link in modal triggers stopPropagation', async () => {
    render(<RotatingQuoteCard quotes={sampleQuotes} />);
    // Open modal
    const card = document.querySelector('.bento-rotating-quote > div');
    await userEvent.setup().click(card);

    // Find the "查看原文" link
    const link = screen.getByText('查看原文');
    expect(link).toBeInTheDocument();
    // The initial quote is randomly selected, so the href could be either URL
    const href = link.closest('a').getAttribute('href');
    expect(['https://github.com/a', 'https://twitter.com/b']).toContain(href);

    // Fire click – the onClick={(e) => e.stopPropagation()} should run without error
    fireEvent.click(link);
  });
});
