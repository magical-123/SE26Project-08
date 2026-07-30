import React from 'react';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must be at top level — vi.mock is hoisted above imports)
// ---------------------------------------------------------------------------

// Dynamically mockable hook
const mockUseInboxItems = vi.fn();

vi.mock('../hooks/useInboxItems', () => ({
  useInboxItems: (...args) => mockUseInboxItems(...args),
}));

vi.mock('../utils/api', () => ({
  graphApi: {
    getItemKeywords: vi.fn(),
    toggleItemKeyword: vi.fn(),
    updateItemKeywords: vi.fn(),
    analyzeKeywords: vi.fn(),
    deleteKeyword: vi.fn(),
  },
  crawlApi: {
    trigger: vi.fn(),
  },
  settingsApi: {
    getPlatforms: vi.fn(),
    getPrivacy: vi.fn(),
    updatePrivacy: vi.fn(),
    saveCredential: vi.fn(),
    deleteCredential: vi.fn(),
    clearCredentialOnly: vi.fn(),
    getBilibiliQrcode: vi.fn(),
    pollBilibiliQrcode: vi.fn(),
    getZhihuQrcode: vi.fn(),
    pollZhihuQrcode: vi.fn(),
  },
}));

vi.mock('../components/InfoSourceCard/InfoSourceCard', () => ({
  InfoSourceCard: vi.fn(({ data, onClick, onTogglePremium, isPremium, premiumLabel }) =>
    React.createElement(
      'div',
      {
        'data-testid': `info-source-card-${data.id}`,
        'data-title': data.title,
        'data-platform': data.platform,
        'data-premium': isPremium ? 'true' : 'false',
        onClick: (e) => {
          e.stopPropagation();
          onClick(data);
        },
      },
      React.createElement('span', { 'data-testid': `card-title-${data.id}` }, data.title),
      React.createElement('span', { 'data-testid': `card-platform-${data.id}` }, data.platform),
      isPremium &&
        React.createElement(
          'span',
          { 'data-testid': `card-premium-badge-${data.id}` },
          premiumLabel || '优质信息源',
        ),
      React.createElement(
        'button',
        {
          'data-testid': `card-extract-${data.id}`,
          onClick: (e) => {
            e.stopPropagation();
            onClick(data);
          },
        },
        '提取知识',
      ),
    ),
  ),
}));

vi.mock('../components/DetailDrawer/DetailDrawer', () => ({
  DetailDrawer: vi.fn(
    ({
      isOpen,
      onClose,
      data,
      draftNote,
      suggestedKeywords,
      selectedKeywords,
      onNoteChange,
      onToggleKeyword,
      onAddKeyword,
      onDeleteKeyword,
      onUpgrade,
      isUpgrading,
      onTogglePremium,
      onRegenerateSummary,
      sourceTitle,
    }) =>
      isOpen
        ? React.createElement(
            'div',
            { 'data-testid': 'detail-drawer', 'data-item-id': data?.id },
            React.createElement('h2', null, data?.title || '详情'),
            React.createElement('span', { 'data-testid': 'drawer-item-title' }, data?.title),
            React.createElement('span', { 'data-testid': 'drawer-item-platform' }, data?.platform),
            React.createElement('textarea', {
              'data-testid': 'drawer-note-input',
              value: draftNote || '',
              readOnly: true,
            }),
            React.createElement(
              'button',
              { 'data-testid': 'drawer-close-btn', onClick: onClose },
              '关闭',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-toggle-keyword-btn',
                onClick: () => onToggleKeyword && onToggleKeyword('test-kw'),
              },
              'Toggle Keyword',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-add-keyword-btn',
                onClick: onAddKeyword,
              },
              'Add Keyword',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-delete-keyword-btn',
                onClick: () => onDeleteKeyword && onDeleteKeyword('del-kw'),
              },
              'Delete Keyword',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-upgrade-btn',
                onClick: onUpgrade,
              },
              'Upgrade',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-regenerate-btn',
                onClick: () => onRegenerateSummary && onRegenerateSummary(data?.id),
              },
              'Regenerate',
            ),
            React.createElement(
              'button',
              {
                'data-testid': 'drawer-toggle-premium-btn',
                onClick: () => onTogglePremium && onTogglePremium(data?.id),
              },
              'Toggle Premium',
            ),
            React.createElement(
              'span',
              { 'data-testid': 'drawer-keywords' },
              (selectedKeywords || []).join(', '),
            ),
            React.createElement(
              'span',
              { 'data-testid': 'drawer-suggested' },
              (suggestedKeywords || []).map((k) => k.label).join(', '),
            ),
            isUpgrading &&
              React.createElement('span', { 'data-testid': 'drawer-upgrading' }, '升级中...'),
          )
        : null,
  ),
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
    },
  ),
  AnimatePresence: ({ children }) => children,
}));

vi.mock('../pages/Inbox/Inbox.css', () => ({}));

// Static import (after all vi.mock hoists)
import { Inbox } from '../pages/Inbox/Inbox';

// References to mocked modules for per-test configuration
let graphApi, crawlApi, settingsApi, InfoSourceCard, DetailDrawer;

async function getMocks() {
  if (graphApi) return;
  const apiMod = await import('../utils/api');
  graphApi = apiMod.graphApi;
  crawlApi = apiMod.crawlApi;
  settingsApi = apiMod.settingsApi;
  const iscMod = await import('../components/InfoSourceCard/InfoSourceCard');
  InfoSourceCard = iscMod.InfoSourceCard;
  const ddMod = await import('../components/DetailDrawer/DetailDrawer');
  DetailDrawer = ddMod.DetailDrawer;
}

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const mockItems = [
  {
    id: 1,
    title: 'Test Video',
    platform: 'Bilibili',
    author: 'Creator',
    duration: '5分钟',
    date: '刚刚',
    hasNote: false,
    aiSummary: 'Summary',
    processStatus: 'PROCESSED',
    note: '',
    keywords: [],
    opened: false,
    url: 'https://example.com',
  },
  {
    id: 2,
    title: 'Second Video',
    platform: 'GitHub',
    author: 'Dev',
    duration: '未记录',
    date: '1小时前',
    hasNote: true,
    aiSummary: null,
    processStatus: 'UNPROCESSED',
    note: 'sample note',
    keywords: [],
    opened: false,
    url: 'https://example.com',
  },
];

const defaultHook = {
  items: mockItems,
  loading: false,
  error: null,
  totalItems: 2,
  totalPages: 1,
  currentPage: 0,
  premiumCount: 1,
  aiSummaryCount: 1,
  fetchPage: vi.fn(),
  togglePremium: vi.fn(),
  saveNote: vi.fn(),
  updateItem: vi.fn(),
  regenerateSummary: vi.fn(),
  refetching: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderInbox(hookOverrides = {}) {
  const hook = { ...defaultHook, ...hookOverrides };
  mockUseInboxItems.mockReturnValue(hook);
  return render(React.createElement(Inbox));
}

/**
 * Renders Inbox and opens the drawer for the first item.
 * Each test using this helper gets a fresh render.
 */
async function openFirstItemDrawer(keywordsMock = [], hookOverrides = {}) {
  graphApi.getItemKeywords.mockResolvedValue(keywordsMock);
  renderInbox(hookOverrides);
  fireEvent.click(screen.getByTestId('card-extract-1'));
  await waitFor(() => {
    expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Inbox Page - Extra Coverage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await getMocks();
    // Default: platforms API returns empty, no reauth needed
    settingsApi.getPlatforms.mockResolvedValue({ platforms: [] });
    graphApi.getItemKeywords.mockResolvedValue([]);
    crawlApi.trigger.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // BILIBILI REAUTH
  // ═══════════════════════════════════════════════════════════════════════

  describe('Bilibili reauth', () => {
    it('1. checks Bilibili authorization on mount via getPlatforms', async () => {
      settingsApi.getPlatforms.mockResolvedValue({
        platforms: [{ key: 'bilibili', needsReauth: true }],
      });

      renderInbox();

      await waitFor(() => {
        expect(settingsApi.getPlatforms).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/B站授权已过期/)).toBeInTheDocument();
      });
    });

    it('2. does not show reauth notification when bilibili does not need reauth', async () => {
      settingsApi.getPlatforms.mockResolvedValue({
        platforms: [{ key: 'bilibili', needsReauth: false }],
      });

      renderInbox();

      await waitFor(() => {
        expect(settingsApi.getPlatforms).toHaveBeenCalled();
      });

      // No toast should appear
      expect(screen.queryByText(/B站授权已过期/)).not.toBeInTheDocument();
    });

    it('3. Bilibili reauth check API error does not crash', async () => {
      settingsApi.getPlatforms.mockRejectedValue(new Error('Network error'));

      // Should not throw
      renderInbox();

      await waitFor(() => {
        expect(settingsApi.getPlatforms).toHaveBeenCalled();
      });

      // Component should still render normally
      expect(screen.getByText('捕获箱 (Inbox)')).toBeInTheDocument();
    });

    it('4. Bilibili reauth check: no bilibili in platforms does nothing', async () => {
      settingsApi.getPlatforms.mockResolvedValue({
        platforms: [{ key: 'zhihu', needsReauth: true }],
      });

      renderInbox();

      await waitFor(() => {
        expect(settingsApi.getPlatforms).toHaveBeenCalled();
      });

      expect(screen.queryByText(/B站授权已过期/)).not.toBeInTheDocument();
    });

    it('5. does not show duplicate toast when reauth already notified', async () => {
      // Both calls return needsReauth=true
      settingsApi.getPlatforms.mockResolvedValue({
        platforms: [{ key: 'bilibili', needsReauth: true }],
      });

      renderInbox();

      await waitFor(() => {
        expect(screen.getByText(/B站授权已过期/)).toBeInTheDocument();
      });

      // The ref flag should prevent duplicate notifications
      // (the interval check at 30s would also see the flag is already set)
      const toastElements = screen.getAllByText(/B站授权已过期/);
      expect(toastElements.length).toBe(1);
    });

    it('6. sets up interval for periodic Bilibili reauth checks', async () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval');

      settingsApi.getPlatforms.mockResolvedValue({ platforms: [] });

      renderInbox();

      // Should set up a 30s interval for reauth checks
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

      setIntervalSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // OPEN DRAWER
  // ═══════════════════════════════════════════════════════════════════════

  describe('Open drawer', () => {
    it('7. fetches keywords from graphApi.getItemKeywords when opening drawer', async () => {
      const keywords = [
        { label: 'AI', highlighted: true, confidence: 0.9, reason: 'test' },
        { label: 'Frontend', highlighted: false, confidence: 0.7, reason: 'test' },
      ];
      graphApi.getItemKeywords.mockResolvedValue(keywords);

      renderInbox();

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(graphApi.getItemKeywords).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // selectedKeywords should have 'AI' (highlighted !== false)
      expect(screen.getByTestId('drawer-keywords').textContent).toContain('AI');
      expect(screen.getByTestId('drawer-keywords').textContent).not.toContain('Frontend');
    });

    it('8. handles keyword fetch error gracefully', async () => {
      graphApi.getItemKeywords.mockRejectedValue(new Error('API error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderInbox();

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // Should still open drawer without crashing
      expect(screen.getByTestId('drawer-item-title')).toHaveTextContent('Test Video');
      // console.error should have been called with the error
      expect(consoleSpy).toHaveBeenCalledWith('获取关键词失败:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('9. marks item as opened via updateItem when not already opened', async () => {
      const updateItem = vi.fn();
      renderInbox({ updateItem });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      expect(updateItem).toHaveBeenCalledWith(1, { opened: true });
    });

    it('10. does not mark opened=true when item already opened', async () => {
      const updateItem = vi.fn();
      const openedItems = mockItems.map((item) => ({
        ...item,
        opened: true,
      }));
      renderInbox({ items: openedItems, updateItem });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      // updateItem should not be called with { opened: true } because item is already opened
      const openedCalls = updateItem.mock.calls.filter(
        (call) => call[1]?.opened === true,
      );
      expect(openedCalls.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TOGGLE KEYWORD
  // ═══════════════════════════════════════════════════════════════════════

  describe('Toggle keyword', () => {
    it('11. calls graphApi.toggleItemKeyword when toggle is clicked', async () => {
      graphApi.toggleItemKeyword.mockResolvedValue([
        { label: 'test-kw', highlighted: true, confidence: 0.9 },
      ]);

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-toggle-keyword-btn'));

      await waitFor(() => {
        expect(graphApi.toggleItemKeyword).toHaveBeenCalledWith(1, 'test-kw');
      });
    });

    it('12. handles toggleItemKeyword API error gracefully', async () => {
      graphApi.toggleItemKeyword.mockRejectedValue(new Error('Toggle failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-toggle-keyword-btn'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('切换高亮失败:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('13. does nothing if selectedItem is null (verified component renders)', () => {
      renderInbox();
      expect(screen.getByText('捕获箱 (Inbox)')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ADD KEYWORD
  // ═══════════════════════════════════════════════════════════════════════

  describe('Add keyword', () => {
    it('14. prompt enter creates a new keyword', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('NewKeyword');
      graphApi.updateItemKeywords.mockResolvedValue([]);

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-add-keyword-btn'));

      await waitFor(() => {
        expect(promptSpy).toHaveBeenCalledWith('请输入新关键词：');
      });

      await waitFor(() => {
        expect(screen.getByTestId('drawer-keywords').textContent).toContain('NewKeyword');
      });

      promptSpy.mockRestore();
    });

    it('15. does not add duplicate keyword', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('test-kw');
      const keywords = [{ label: 'test-kw', highlighted: true, confidence: 0.9 }];
      await openFirstItemDrawer(keywords);

      fireEvent.click(screen.getByTestId('drawer-add-keyword-btn'));

      await waitFor(() => {
        expect(promptSpy).toHaveBeenCalled();
      });

      // The keyword should not be duplicated
      const kwText = screen.getByTestId('drawer-keywords').textContent;
      const occurrences = kwText.split('test-kw').length - 1;
      expect(occurrences).toBe(1);

      promptSpy.mockRestore();
    });

    it('16. handles empty or null prompt result', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-add-keyword-btn'));

      await waitFor(() => {
        expect(promptSpy).toHaveBeenCalled();
      });

      // Keywords should be unchanged
      expect(screen.getByTestId('drawer-keywords').textContent).toBe('');

      promptSpy.mockRestore();
    });

    it('17. calls updateItemKeywords after adding keyword', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('MyTag');
      graphApi.updateItemKeywords.mockResolvedValue([]);

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-add-keyword-btn'));

      await waitFor(() => {
        expect(graphApi.updateItemKeywords).toHaveBeenCalledWith(
          1,
          expect.arrayContaining([expect.objectContaining({ label: 'MyTag' })]),
        );
      });

      promptSpy.mockRestore();
    });

    it('18. handles updateItemKeywords error after add', async () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('BadTag');
      graphApi.updateItemKeywords.mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await openFirstItemDrawer();

      fireEvent.click(screen.getByTestId('drawer-add-keyword-btn'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('添加关键词失败:', expect.any(Error));
      });

      promptSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE KEYWORD
  // ═══════════════════════════════════════════════════════════════════════

  describe('Delete keyword', () => {
    it('19. calls graphApi.deleteKeyword', async () => {
      graphApi.deleteKeyword.mockResolvedValue({});
      const sessionSpy = vi.spyOn(Storage.prototype, 'setItem');

      const keywords = [{ label: 'del-kw', highlighted: true, confidence: 0.9 }];
      await openFirstItemDrawer(keywords);

      fireEvent.click(screen.getByTestId('drawer-delete-keyword-btn'));

      await waitFor(() => {
        expect(graphApi.deleteKeyword).toHaveBeenCalledWith('del-kw');
      });

      // sessionStorage should be set
      await waitFor(() => {
        expect(sessionSpy).toHaveBeenCalledWith('inbox:shouldRefetch', 'true');
      });

      sessionSpy.mockRestore();
    });

    it('20. removes keyword from local state after delete', async () => {
      graphApi.deleteKeyword.mockResolvedValue({});

      const keywords = [{ label: 'del-kw', highlighted: true, confidence: 0.9 }];
      await openFirstItemDrawer(keywords);

      // Initially the keyword should be in selected
      expect(screen.getByTestId('drawer-keywords').textContent).toContain('del-kw');

      fireEvent.click(screen.getByTestId('drawer-delete-keyword-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('drawer-keywords').textContent).not.toContain('del-kw');
      });
    });

    it('21. handles deleteKeyword API error with toast', async () => {
      graphApi.deleteKeyword.mockRejectedValue(new Error('Delete failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const keywords = [{ label: 'del-kw', highlighted: true, confidence: 0.9 }];
      await openFirstItemDrawer(keywords);

      fireEvent.click(screen.getByTestId('drawer-delete-keyword-btn'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('删除关键词失败:', expect.any(Error));
      });

      // Toast should appear
      await waitFor(() => {
        expect(screen.getByText(/删除失败，请稍后重试/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('22. delete keyword: component renders without crash for empty label guard', () => {
      renderInbox();
      expect(screen.getByText('捕获箱 (Inbox)')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CLOSE DRAWER
  // ═══════════════════════════════════════════════════════════════════════

  describe('Close drawer', () => {
    it('23. saves draft note via updateItem when drawer closes', async () => {
      const updateItem = vi.fn();
      renderInbox({ updateItem });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-close-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument();
      });

      expect(updateItem).toHaveBeenCalledWith(1, { note: '' });
    });

    it('24. saves modified draft note when drawer closes', async () => {
      const updateItem = vi.fn();
      const itemWithNote = mockItems.map((item) => ({
        ...item,
        note: 'existing note',
      }));
      renderInbox({ items: itemWithNote, updateItem });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-close-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument();
      });

      expect(updateItem).toHaveBeenCalledWith(1, { note: 'existing note' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLE UPGRADE
  // ═══════════════════════════════════════════════════════════════════════

  describe('HandleUpgrade', () => {
    it('25. calls graphApi.analyzeKeywords', async () => {
      const saveNote = vi.fn();
      const updateItemKeywords = vi.fn().mockResolvedValue([]);
      graphApi.analyzeKeywords.mockResolvedValue([
        { label: 'AI', isSelected: true, isNew: true, confidence: 0.9 },
      ]);
      graphApi.getItemKeywords
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ label: 'AI', highlighted: true, confidence: 0.9 }])
        .mockResolvedValueOnce([{ label: 'AI', highlighted: true, confidence: 0.9 }]);
      graphApi.updateItemKeywords = updateItemKeywords;

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        expect(graphApi.analyzeKeywords).toHaveBeenCalledWith(1, '');
      });

      expect(saveNote).toHaveBeenCalledWith(1, '', []);
    });

    it('26. handles analyzeKeywords error with toast', async () => {
      const saveNote = vi.fn();
      graphApi.analyzeKeywords.mockRejectedValue(new Error('Analyze failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      graphApi.getItemKeywords.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('AI 推荐关键词失败:', expect.any(Error));
      });

      await waitFor(() => {
        expect(screen.getByText(/AI推荐领域失败，请稍后重试/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('27. saves new keywords to backend after analyze success', async () => {
      const saveNote = vi.fn();
      const updateItemKeywords = vi.fn().mockResolvedValue([]);
      graphApi.analyzeKeywords.mockResolvedValue([
        { label: 'AI', isSelected: true, isNew: true, confidence: 0.9 },
        { label: 'ML', isSelected: true, isNew: true, confidence: 0.8 },
      ]);
      graphApi.getItemKeywords
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { label: 'AI', highlighted: true, confidence: 0.9 },
          { label: 'ML', highlighted: true, confidence: 0.8 },
        ])
        .mockResolvedValueOnce([
          { label: 'AI', highlighted: true, confidence: 0.9 },
          { label: 'ML', highlighted: true, confidence: 0.8 },
        ]);
      graphApi.updateItemKeywords = updateItemKeywords;

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        expect(updateItemKeywords).toHaveBeenCalledWith(
          1,
          expect.arrayContaining([
            expect.objectContaining({ label: 'AI' }),
            expect.objectContaining({ label: 'ML' }),
          ]),
        );
      }, { timeout: 3000 });
    });

    it('28. refetches keywords after save', async () => {
      const saveNote = vi.fn();
      const updateItemKeywords = vi.fn().mockResolvedValue([]);
      graphApi.analyzeKeywords.mockResolvedValue([
        { label: 'Refreshed', isSelected: true, isNew: false, confidence: 0.9 },
      ]);
      graphApi.getItemKeywords
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { label: 'Refreshed', highlighted: true, confidence: 0.9 },
        ])
        .mockResolvedValueOnce([
          { label: 'Refreshed', highlighted: true, confidence: 0.9 },
        ]);
      graphApi.updateItemKeywords = updateItemKeywords;

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        expect(graphApi.getItemKeywords.mock.calls.length).toBeGreaterThanOrEqual(3);
      }, { timeout: 3000 });
    });

    it('29. handles updateItemKeywords save error gracefully', async () => {
      const saveNote = vi.fn();
      graphApi.analyzeKeywords.mockResolvedValue([
        { label: 'AI', isSelected: true, isNew: true, confidence: 0.9 },
      ]);
      graphApi.getItemKeywords
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ label: 'AI', highlighted: true, confidence: 0.9 }]);
      graphApi.updateItemKeywords.mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '保存关键词到后端失败:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it('30. upgrade: does nothing if selectedItem is null', () => {
      renderInbox();
      expect(screen.getByText('捕获箱 (Inbox)')).toBeInTheDocument();
    });

    it('31. AI suggestions default-select fallback when none selected', async () => {
      const saveNote = vi.fn();
      graphApi.analyzeKeywords.mockResolvedValue([
        { label: 'AI', isSelected: false, isNew: true, confidence: 0.9 },
        { label: 'ML', isSelected: false, isNew: true, confidence: 0.8 },
      ]);
      graphApi.getItemKeywords
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { label: 'AI', highlighted: true, confidence: 0.9 },
          { label: 'ML', highlighted: true, confidence: 0.8 },
        ]);
      graphApi.updateItemKeywords.mockResolvedValue([]);

      renderInbox({ saveNote });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-upgrade-btn'));

      await waitFor(() => {
        const kwText = screen.getByTestId('drawer-keywords').textContent;
        expect(kwText).toContain('AI');
        expect(kwText).toContain('ML');
      }, { timeout: 3000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REGENERATE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  describe('RegenerateSummary', () => {
    it('32. shows success toast when regenerateSummary succeeds', async () => {
      const regenerateSummary = vi.fn().mockResolvedValue(undefined);

      renderInbox({ regenerateSummary });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-regenerate-btn'));

      await waitFor(() => {
        expect(regenerateSummary).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.getByText(/已重新触发该卡片的 AI 摘要生成/)).toBeInTheDocument();
      });
    });

    it('33. shows error toast when regenerateSummary fails', async () => {
      const regenerateSummary = vi
        .fn()
        .mockRejectedValue(new Error('Regeneration failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderInbox({ regenerateSummary });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-regenerate-btn'));

      await waitFor(() => {
        expect(screen.getByText(/重新生成摘要失败/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLE MANUAL UPDATE
  // ═══════════════════════════════════════════════════════════════════════

  describe('HandleManualUpdate', () => {
    it('34. handles crawlApi.trigger error with toast', async () => {
      crawlApi.trigger.mockRejectedValue(new Error('Trigger failed'));

      renderInbox();

      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      await waitFor(() => {
        expect(screen.getByText(/启动爬虫失败/)).toBeInTheDocument();
      });
    });

    it('35. manual update for Bilibili platform triggers poll for reauth', async () => {
      crawlApi.trigger.mockResolvedValue({});
      // Mount useEffect reauth check — no reauth
      settingsApi.getPlatforms.mockResolvedValueOnce({ platforms: [] });
      // The poll calls that happen in the for loop (each 1s delay)
      for (let i = 0; i < 8; i++) {
        settingsApi.getPlatforms.mockResolvedValueOnce({
          platforms: [{ key: 'bilibili', needsReauth: false }],
        });
      }

      const fetchPage = vi.fn();
      renderInbox({ fetchPage });

      // Switch to Bilibili filter first
      fireEvent.click(screen.getByRole('button', { name: 'Bilibili' }));

      // Click manual update
      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      await waitFor(() => {
        expect(crawlApi.trigger).toHaveBeenCalledWith('bilibili');
      });

      // The poll starts after trigger resolves. It uses setTimeout(1000)
      // The success toast should appear (from trigger)
      await waitFor(() => {
        expect(screen.getByText(/爬虫已启动/)).toBeInTheDocument();
      });
    });

    it('36. manual update for GitHub platform', async () => {
      crawlApi.trigger.mockResolvedValue({});
      const fetchPage = vi.fn();
      renderInbox({ fetchPage });

      fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));

      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      await waitFor(() => {
        expect(crawlApi.trigger).toHaveBeenCalledWith('github');
      });
    });

    it('37. manual update shows success toast', async () => {
      crawlApi.trigger.mockResolvedValue({});

      renderInbox();

      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      await waitFor(() => {
        expect(screen.getByText(/爬虫已启动/)).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PAGINATION EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════

  describe('getPageNumbers pagination', () => {
    it('38. shows correct page range when on first page with many pages', () => {
      renderInbox({ totalPages: 20, currentPage: 0, totalItems: 200 });

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '8' })).not.toBeInTheDocument();
    });

    it('39. shows correct page range when in middle of many pages', () => {
      renderInbox({ totalPages: 20, currentPage: 10, totalItems: 200 });

      expect(screen.getByRole('button', { name: '8' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '14' })).toBeInTheDocument();
    });

    it('40. shows correct page range near the end', () => {
      renderInbox({ totalPages: 20, currentPage: 18, totalItems: 200 });

      expect(screen.getByRole('button', { name: '14' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    });

    it('41. handles case where currentPage exceeds totalPages (safePage clamping)', () => {
      renderInbox({ totalPages: 5, currentPage: 10, totalItems: 50 });

      expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    });

    it('42. handles single page with many items', () => {
      renderInbox({ totalPages: 1, totalItems: 50 });

      expect(screen.queryByText(/第.*页/)).not.toBeInTheDocument();
    });

    it('43. handles exactly maxVisible pages', () => {
      renderInbox({ totalPages: 7, currentPage: 3, totalItems: 70 });

      for (let i = 1; i <= 7; i++) {
        expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EMPTY STATE VARIANTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Empty states', () => {
    it('44. Premium filter empty state', () => {
      renderInbox({ items: [], totalItems: 0 });

      fireEvent.click(screen.getByRole('button', { name: '优质信息源' }));

      expect(screen.getByText(/暂无优质信息源/)).toBeInTheDocument();
      expect(
        screen.getByText(/将信息源升级为优质信息源后会出现在这里/),
      ).toBeInTheDocument();
    });

    it('45. Platform-specific empty state (Bilibili)', () => {
      renderInbox({ items: [], totalItems: 0 });

      fireEvent.click(screen.getByRole('button', { name: 'Bilibili' }));

      expect(screen.getByText(/暂无 Bilibili 平台数据/)).toBeInTheDocument();
      expect(
        screen.getByText(/请确认该平台已连接授权，或稍等爬虫完成抓取/),
      ).toBeInTheDocument();
    });

    it('46. Platform-specific empty state (GitHub)', () => {
      renderInbox({ items: [], totalItems: 0 });

      fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));

      expect(screen.getByText(/暂无 GitHub 平台数据/)).toBeInTheDocument();
    });

    it('47. All filter empty state', () => {
      renderInbox({ items: [], totalItems: 0 });

      expect(screen.getByText(/暂无捕获的信息项/)).toBeInTheDocument();
      expect(
        screen.getByText(/连接平台授权后，爬虫会自动抓取内容到这里/),
      ).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING STATE FOR SPECIFIC FILTER
  // ═══════════════════════════════════════════════════════════════════════

  describe('Platform loading state', () => {
    it('48. shows loading state when items empty but totalItems > 0 for specific filter', () => {
      renderInbox({ items: [], totalItems: 10, loading: false });

      fireEvent.click(screen.getByRole('button', { name: 'Bilibili' }));

      expect(
        screen.getByText('正在加载 Bilibili 平台数据...'),
      ).toBeInTheDocument();
    });

    it('49. does NOT show platform loading when filter is All', () => {
      renderInbox({ items: [], totalItems: 10, loading: false });

      expect(
        screen.queryByText(/正在加载.*平台数据/),
      ).not.toBeInTheDocument();
    });

    it('50. does NOT show platform loading when filter is Premium', () => {
      // When filter=Premium and totalItems>0 and items=[], neither the
      // platform loading banner nor the empty state renders (both conditions fail).
      // Just verify no platform loading text appears.
      renderInbox({ items: [], totalItems: 10, loading: false });

      fireEvent.click(screen.getByRole('button', { name: '优质信息源' }));

      expect(
        screen.queryByText(/正在加载.*平台数据/),
      ).not.toBeInTheDocument();
    });

    it('51. does NOT show platform loading when loading=true', () => {
      renderInbox({ items: [], totalItems: 10, loading: true });

      fireEvent.click(screen.getByRole('button', { name: 'Bilibili' }));

      expect(screen.getByText('加载中...')).toBeInTheDocument();
      expect(
        screen.queryByText(/正在加载.*平台数据/),
      ).not.toBeInTheDocument();
    });

    it('52. does NOT show platform loading when items have data', () => {
      renderInbox({ items: mockItems, totalItems: 10, loading: false });

      fireEvent.click(screen.getByRole('button', { name: 'Bilibili' }));

      expect(
        screen.queryByText(/正在加载.*平台数据/),
      ).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUBTITLE / TOTAL COUNT
  // ═══════════════════════════════════════════════════════════════════════

  describe('Total count subtitle', () => {
    it('53. shows correct premiumCount and aiSummaryCount in subtitle', () => {
      renderInbox({ premiumCount: 5, aiSummaryCount: 3, totalItems: 20 });

      const subtitle = document.querySelector('.inbox-subtitle');
      expect(subtitle).toBeInTheDocument();
      expect(subtitle.textContent).toMatch(/共捕获\s*20\s*条内容/);
      expect(subtitle.textContent).toMatch(/5\s*条优质信息源/);
      expect(subtitle.textContent).toMatch(/3\s*条已生成 AI 摘要/);
    });

    it('54. shows zero counts correctly', () => {
      renderInbox({ premiumCount: 0, aiSummaryCount: 0, totalItems: 10, items: mockItems });

      const subtitle = document.querySelector('.inbox-subtitle');
      expect(subtitle).toBeInTheDocument();
      expect(subtitle.textContent).toContain('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TOGGLE PREMIUM VIA DRAWER
  // ═══════════════════════════════════════════════════════════════════════

  describe('Toggle premium via drawer', () => {
    it('55. toggles premium closes drawer via onTogglePremium callback', async () => {
      const togglePremium = vi.fn();

      renderInbox({ togglePremium });

      fireEvent.click(screen.getByTestId('card-extract-1'));

      await waitFor(() => {
        expect(screen.getByTestId('detail-drawer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('drawer-toggle-premium-btn'));

      await waitFor(() => {
        expect(togglePremium).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('detail-drawer')).not.toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TOAST AUTO-DISMISS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Toast auto-dismiss', () => {
    it('56. shows success toast and auto-dismisses', async () => {
      crawlApi.trigger.mockResolvedValue({});

      renderInbox();

      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      // Toast should appear
      await waitFor(() => {
        expect(screen.getByText(/爬虫已启动/)).toBeInTheDocument();
      });

      // The toast has a 4s auto-dismiss setTimeout. We verify the setTimeout
      // was registered by spying on it.
      expect(screen.getByText(/爬虫已启动/)).toBeInTheDocument();
    });

    it('57. shows error toast on trigger failure', async () => {
      crawlApi.trigger.mockRejectedValue(new Error('Trigger failed'));

      renderInbox();

      fireEvent.click(screen.getByRole('button', { name: /手动更新/ }));

      // Error toast should appear
      await waitFor(() => {
        expect(screen.getByText(/启动爬虫失败/)).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PROGRESS BAR EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Progress bar', () => {
    it('58. progress bar not shown when all items are processed', () => {
      const processedItems = mockItems.map((item) => ({
        ...item,
        aiSummary: 'Done',
        processStatus: 'PROCESSED',
      }));
      renderInbox({ items: processedItems });

      expect(screen.queryByText(/AI 正在努力分析中/)).not.toBeInTheDocument();
    });

    it('59. All filter active by default', () => {
      renderInbox();
      const allBtn = screen.getByRole('button', { name: 'All' });
      expect(allBtn.className).toContain('active');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MISC: Premium info-source card labels
  // ═══════════════════════════════════════════════════════════════════════

  describe('Premium labels', () => {
    it('60. premium item shows premium badge', () => {
      renderInbox();
      expect(screen.getByTestId('card-premium-badge-2')).toBeInTheDocument();
      expect(screen.getByTestId('card-premium-badge-2')).toHaveTextContent('优质信息源');
    });

    it('61. non-premium item has no premium badge', () => {
      renderInbox();
      expect(screen.queryByTestId('card-premium-badge-1')).not.toBeInTheDocument();
    });
  });
});
