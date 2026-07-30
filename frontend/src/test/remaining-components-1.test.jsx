import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared Mocks (used by both App and InsightDrawer tests)
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
    'X', 'Sparkles', 'Calendar', 'Clock',
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
  return {
    ...actual,
    createPortal: (children) => children,
  };
});

// ---------------------------------------------------------------------------
// App-specific Mocks
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    BrowserRouter: actual.MemoryRouter,
  };
});

vi.mock('../layouts/RootLayout', () => ({
  RootLayout: ({ children }) =>
    React.createElement('div', { 'data-testid': 'root-layout' }, children),
}));

vi.mock('../pages/Auth/AuthPage', () => ({
  AuthPage: () => React.createElement('div', { 'data-testid': 'auth-page' }, 'AuthPage'),
}));

vi.mock('../pages/Dashboard/Dashboard', () => ({
  Dashboard: () => React.createElement('div', { 'data-testid': 'dashboard' }, 'Dashboard'),
}));

vi.mock('../pages/Inbox/Inbox', () => ({
  Inbox: () => React.createElement('div', { 'data-testid': 'inbox' }, 'Inbox'),
}));

vi.mock('../pages/KnowledgeGraph/KnowledgeGraph', () => ({
  KnowledgeGraph: () => React.createElement('div', { 'data-testid': 'knowledge-graph' }, 'KnowledgeGraph'),
}));

vi.mock('../pages/Report/Report', () => ({
  Report: () => React.createElement('div', { 'data-testid': 'report' }, 'Report'),
}));

vi.mock('../pages/Social/Social', () => ({
  Social: () => React.createElement('div', { 'data-testid': 'social' }, 'Social'),
}));

vi.mock('../pages/Settings/Settings', () => ({
  Settings: () => React.createElement('div', { 'data-testid': 'settings' }, 'Settings'),
}));

vi.mock('../pages/Profile/ProfilePage', () => ({
  ProfilePage: () => React.createElement('div', { 'data-testid': 'profile' }, 'ProfilePage'),
}));

vi.mock('../components/Toast/Toast', () => ({
  ToastProvider: ({ children }) => React.createElement(React.Fragment, null, children),
}));

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import App from '../App';
import { InsightDrawer } from '../components/InsightDrawer/InsightDrawer';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

describe('App', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // 1. Renders login page at /login route
  it('renders login page at /login route', () => {
    // MemoryRouter defaults to initialEntries=['/'], but because BrowserRouter
    // is mocked to MemoryRouter and App doesn't pass initialEntries, the
    // default starts at '/'.  To test /login we rely on the fact that
    // ProtectedRoute redirects from '/' to '/login' when no token.
    // But we can also test by rendering and checking the redirect happens.
    render(<App />);
    // No token → ProtectedRoute redirects / to /login
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.getByText('AuthPage')).toBeInTheDocument();
  });

  // 2. Redirects unauthenticated users from protected routes to /login
  it('redirects unauthenticated users from protected routes to /login', () => {
    render(<App />);
    // No token → should be at /login, AuthPage renders
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    // Protected components should NOT render
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('root-layout')).not.toBeInTheDocument();
  });

  // 3. Renders protected pages when token exists
  it('renders protected pages when token exists', () => {
    sessionStorage.setItem('token', 'test-token');
    render(<App />);
    // With token, at / → Dashboard inside RootLayout
    expect(screen.getByTestId('root-layout')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    // AuthPage should NOT be rendered
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();
  });

  // 4. AuthRedirectListener redirects on auth:expired event
  it('AuthRedirectListener redirects on auth:expired event', () => {
    sessionStorage.setItem('token', 'test-token');
    render(<App />);
    // Initially at / with token → Dashboard
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument();

    // Dispatch auth:expired → AuthRedirectListener navigates to /login
    act(() => {
      window.dispatchEvent(new Event('auth:expired'));
    });

    // Now at /login → AuthPage renders
    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.getByText('AuthPage')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// InsightDrawer
// ---------------------------------------------------------------------------

describe('InsightDrawer', () => {
  const baseInsight = {
    insightTitle: 'Test Insight Title',
    insightFullText: 'First paragraph.\nSecond paragraph.',
    reportDate: '2024-06-15',
    version: 3,
    createdAt: '2024-06-15T10:30:00Z',
  };

  beforeEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = '';
    cleanup();
  });

  // 1. Returns null when no insight prop
  it('returns null when no insight prop', () => {
    const { container } = render(<InsightDrawer isOpen onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  // 2. When isOpen=false: does not render drawer
  it('when isOpen=false: does not render drawer', () => {
    render(
      <InsightDrawer
        isOpen={false}
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    expect(screen.queryByText('Test Insight Title')).not.toBeInTheDocument();
    expect(screen.queryByText(/First paragraph/)).not.toBeInTheDocument();
    expect(document.querySelector('.insight-drawer')).not.toBeInTheDocument();
  });

  // 3. When isOpen=true: renders insight with title, fullText, metadata
  it('when isOpen=true: renders insight with title, fullText, and metadata', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    // Title
    expect(screen.getByText('Test Insight Title')).toBeInTheDocument();
    // Full text paragraphs
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    // Metadata
    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
    expect(screen.getByText('版本 3')).toBeInTheDocument();
  });

  // 4. Shows report type in category pill (weekly)
  it('shows weekly report type in category pill', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
        reportType="weekly"
      />
    );
    const pill = document.querySelector('.drawer-category-pill');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe('周报洞察');
  });

  // 4b. Shows daily report type in category pill
  it('shows daily report type in category pill', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
        reportType="daily"
      />
    );
    const pill = document.querySelector('.drawer-category-pill');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe('日报洞察');
  });

  // 5. Close button calls onClose
  it('close button calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <InsightDrawer
        isOpen
        onClose={onClose}
        insight={baseInsight}
      />
    );
    const closeBtn = document.querySelector('.close-btn');
    expect(closeBtn).toBeInTheDocument();
    await userEvent.setup().click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 6. Scrim click calls onClose
  it('scrim click calls onClose', async () => {
    const onClose = vi.fn();
    render(
      <InsightDrawer
        isOpen
        onClose={onClose}
        insight={baseInsight}
      />
    );
    const scrim = document.querySelector('.drawer-scrim');
    expect(scrim).toBeInTheDocument();
    await userEvent.setup().click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 7. Locks body scroll when open
  it('locks body scroll when open (document.body.style.overflow = hidden)', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  // 7b. Restores body scroll on unmount
  it('restores body scroll on unmount', () => {
    const { unmount } = render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    // Cleanup restores previous overflow (empty string)
    expect(document.body.style.overflow).toBe('');
  });

  // 8. Renders reportDate, version, createdAt metadata
  it('renders reportDate, version, and createdAt metadata', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    // reportDate
    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
    // version
    expect(screen.getByText('版本 3')).toBeInTheDocument();
    // createdAt formatted as zh-CN locale
    const expectedDate = new Date('2024-06-15T10:30:00Z').toLocaleString('zh-CN');
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  // 9. Renders AI insight detail section with Sparkles icon
  it('renders AI insight detail section with Sparkles icon', () => {
    render(
      <InsightDrawer
        isOpen
        onClose={vi.fn()}
        insight={baseInsight}
      />
    );
    expect(screen.getByText('AI 洞察详情')).toBeInTheDocument();
    expect(screen.getByTestId('icon-Sparkles')).toBeInTheDocument();
  });
});
