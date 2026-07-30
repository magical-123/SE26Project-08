import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    'User', 'Lock', 'Mail', 'ArrowRight', 'Loader2',
    'Compass', 'BookOpen', 'Search', 'PieChart', 'Settings',
    'UserCircle', 'Menu', 'X', 'WifiOff',
  ];
  const mock = {};
  icons.forEach((name) => {
    mock[name] = ({ size, className, 'data-testid': dt, ...props }) =>
      React.createElement('span', { ...props, 'data-testid': dt || `icon-${name}`, className }, name);
  });
  return mock;
});

vi.mock('react-router-dom', () => ({
  NavLink: ({ to, className, children, onClick, ...props }) => {
    const cls = typeof className === 'function' ? className({ isActive: false }) : className;
    return React.createElement('a', { href: to, className: cls, onClick, ...props }, children);
  },
  useNavigate: () => vi.fn(),
}));

vi.mock('../components/CommandPalette/CommandPalette', () => ({
  CommandPalette: () => React.createElement('div', { 'data-testid': 'command-palette' }, 'CommandPalette'),
}));

vi.mock('../hooks/useInboxItems', () => ({
  useInboxItems: () => ({ items: [] }),
}));

// Track the offline change handler so tests can trigger offline state
let offlineChangeHandler = null;
vi.mock('../utils/offlineStore', () => ({
  onGlobalOfflineChange: vi.fn((handler) => {
    offlineChangeHandler = handler;
    return () => { offlineChangeHandler = null; };
  }),
  checkConnection: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import { AuthPage } from '../pages/Auth/AuthPage';
import { RootLayout } from '../layouts/RootLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUsernameInput() { return screen.getByPlaceholderText('Username'); }
function getPasswordInput() { return screen.getByPlaceholderText('Password'); }
function getEmailInput() { return screen.queryByPlaceholderText('Email Address'); }
function getSubmitBtn() { return document.querySelector('button[type="submit"]'); }
function getToggleBtn() { return document.querySelector('.toggle-mode-btn'); }

// ---------------------------------------------------------------------------
// AuthPage
// ---------------------------------------------------------------------------

describe('AuthPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    sessionStorage.clear();
    // Make window.location.href writable so we can observe assignment
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Renders login form by default
  it('renders login form by default with username and password fields', () => {
    render(<AuthPage />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Log in to continue to InfoDigest')).toBeInTheDocument();
    expect(getUsernameInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(getSubmitBtn()).toHaveTextContent('Login');
  });

  // 2. Does NOT show email field in login mode
  it('does NOT show email field in login mode', () => {
    render(<AuthPage />);
    expect(getEmailInput()).not.toBeInTheDocument();
  });

  // 3. Toggle to register mode shows email field
  it('toggle to register mode shows email field', async () => {
    render(<AuthPage />);
    await userEvent.setup().click(getToggleBtn());
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByText('Start synthesizing your information')).toBeInTheDocument();
    expect(getEmailInput()).toBeInTheDocument();
    expect(getSubmitBtn()).toHaveTextContent('Sign Up');
  });

  // 4. Toggle back to login hides email field
  it('toggle back to login hides email field', async () => {
    render(<AuthPage />);
    await userEvent.setup().click(getToggleBtn());  // to register
    expect(getEmailInput()).toBeInTheDocument();
    await userEvent.setup().click(getToggleBtn());  // back to login
    expect(getEmailInput()).not.toBeInTheDocument();
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  // 5. Submit with empty fields — inputs have HTML5 required attribute
  it('inputs have HTML5 required attribute for validation', () => {
    render(<AuthPage />);
    expect(getUsernameInput()).toHaveAttribute('required');
    expect(getPasswordInput()).toHaveAttribute('required');
  });

  // 6. Submit calls fetch with correct login payload
  it('submit calls fetch with correct login payload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 't', username: 'u' }),
    });
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'secret');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alice', password: 'secret' }),
      });
    });
  });

  // 7. Submit calls fetch with correct register payload
  it('submit calls fetch with correct register payload', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 't', username: 'u' }),
    });
    render(<AuthPage />);
    await userEvent.setup().click(getToggleBtn()); // switch to register
    await userEvent.setup().type(getUsernameInput(), 'bob');
    await userEvent.setup().type(getEmailInput(), 'bob@example.com');
    await userEvent.setup().type(getPasswordInput(), 'p@ss');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bob', email: 'bob@example.com', password: 'p@ss' }),
      });
    });
  });

  // 8. On successful login: stores token/username in sessionStorage, dispatches avatarChanged, redirects
  it('on successful login stores data and redirects', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'my-token', username: 'alice', avatarUrl: 'https://example.com/avatar.png' }),
    });
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'secret');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(sessionStorage.getItem('token')).toBe('my-token');
      expect(sessionStorage.getItem('username')).toBe('alice');
      expect(sessionStorage.getItem('avatarUrl')).toBe('https://example.com/avatar.png');
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'avatarChanged' }));
      expect(window.location.href).toBe('/');
    });
    dispatchSpy.mockRestore();
  });

  // 9. On failed login: shows error message
  it('on failed login shows error message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Invalid credentials'),
    });
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'wrong');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  // 10. Loading state: shows spinner, disables button
  it('loading state shows spinner and disables button', async () => {
    // Don't resolve fetch so loading persists
    global.fetch.mockReturnValueOnce(new Promise(() => {}));
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'secret');
    await userEvent.setup().click(getSubmitBtn());

    // The button should be disabled with a spinner
    const btn = getSubmitBtn();
    expect(btn).toBeDisabled();
    // Loader2 icon is rendered as a span with data-testid
    expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
    // ArrowRight should NOT be present during loading
    expect(screen.queryByTestId('icon-ArrowRight')).not.toBeInTheDocument();
  });

  // 11. Toggle mode clears error
  it('toggle mode clears error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Error message'),
    });
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'x');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    // Toggle to register clears the error
    await userEvent.setup().click(getToggleBtn());
    expect(screen.queryByText('Error message')).not.toBeInTheDocument();
  });

  // 12. Error text clears when typing
  it('error text clears when typing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Auth error'),
    });
    render(<AuthPage />);
    await userEvent.setup().type(getUsernameInput(), 'alice');
    await userEvent.setup().type(getPasswordInput(), 'x');
    await userEvent.setup().click(getSubmitBtn());

    await waitFor(() => {
      expect(screen.getByText('Auth error')).toBeInTheDocument();
    });

    // Start typing to clear error
    await userEvent.setup().type(getUsernameInput(), 'a');
    expect(screen.queryByText('Auth error')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RootLayout
// ---------------------------------------------------------------------------

describe('RootLayout', () => {
  const navLabels = ['DASHBOARD', 'INBOX', 'KNOWLEDGE', 'REPORT', 'SOCIAL', 'SETTINGS', 'PROFILE'];

  beforeEach(() => {
    sessionStorage.clear();
    offlineChangeHandler = null;
  });

  // 1. Renders all nav items with correct paths and labels
  it('renders all nav items with correct paths and labels', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    navLabels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    // Check that links have correct hrefs
    const paths = ['/', '/inbox', '/graph', '/report', '/social', '/settings', '/profile'];
    const links = screen.getAllByRole('link');
    paths.forEach((path) => {
      expect(links.some((link) => link.getAttribute('href') === path)).toBe(true);
    });
  });

  // 2. Renders children inside main content area
  it('renders children inside main content area', () => {
    render(
      <RootLayout>
        <div data-testid="child-content">Hello World</div>
      </RootLayout>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  // 3. Shows avatar initial when no avatarUrl
  it('shows avatar initial when no avatarUrl', () => {
    sessionStorage.setItem('username', 'Alice');
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // The avatar shows the first letter of the username
    expect(screen.getByText('A')).toBeInTheDocument();
    // No img element for avatar
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // 4. Shows avatar image when avatarUrl exists
  it('shows avatar image when avatarUrl exists', () => {
    sessionStorage.setItem('avatarUrl', 'https://example.com/avatar.png');
    sessionStorage.setItem('username', 'Bob');
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    const avatarImg = screen.getByAltText('');
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute('src', 'https://example.com/avatar.png');
    expect(avatarImg).toHaveClass('user-avatar-img');
  });

  // 5. Mobile menu toggle opens/closes
  it('mobile menu toggle opens and closes the nav', async () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    const getToggle = () => document.querySelector('.mobile-menu-toggle');
    const toggleBtn = getToggle();
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-label', '打开导航菜单');

    // Open
    await userEvent.setup().click(toggleBtn);
    const toggleOpen = getToggle();
    expect(toggleOpen).toHaveAttribute('aria-expanded', 'true');
    expect(toggleOpen).toHaveAttribute('aria-label', '关闭导航菜单');
    // The aside should have the mobile-nav-open class
    const aside = document.querySelector('.cascade-nav-container');
    expect(aside.className).toContain('mobile-nav-open');

    // Close
    await userEvent.setup().click(getToggle());
    expect(getToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(getToggle()).toHaveAttribute('aria-label', '打开导航菜单');
    expect(aside.className).not.toContain('mobile-nav-open');
  });

  // 6. Mobile backdrop closes nav
  it('mobile backdrop closes nav when clicked', async () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // Open mobile nav
    await userEvent.setup().click(document.querySelector('.mobile-menu-toggle'));
    expect(document.querySelector('.cascade-nav-container').className).toContain('mobile-nav-open');

    // Backdrop should be present
    const backdropBtn = document.querySelector('.mobile-nav-backdrop');
    expect(backdropBtn).toBeInTheDocument();

    // Click backdrop
    await userEvent.setup().click(backdropBtn);
    const aside = document.querySelector('.cascade-nav-container');
    expect(aside.className).not.toContain('mobile-nav-open');
    expect(document.querySelector('.mobile-menu-toggle')).toHaveAttribute('aria-label', '打开导航菜单');
  });

  // 7. Offline banner shows when globalOffline is true
  it('shows offline banner when globalOffline becomes true', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // Initially no offline banner
    expect(screen.queryByText('当前离线/服务超时，已切换为缓存模式')).not.toBeInTheDocument();

    // Trigger offline state via the handler captured by the mock
    act(() => {
      offlineChangeHandler(true);
    });

    expect(screen.getByText('当前离线/服务超时，已切换为缓存模式')).toBeInTheDocument();
    expect(screen.getByTestId('icon-WifiOff')).toBeInTheDocument();
  });

  // 8. NavLink renders with class name from function
  it('nav items have correct class names from NavLink className function', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    const navItems = document.querySelectorAll('.nav-item');
    // There should be 7 nav items
    expect(navItems.length).toBe(7);
    // Each nav item should have the 'nav-item' class
    navItems.forEach((item) => {
      expect(item.className).toContain('nav-item');
    });
  });

  // 9. Uses CommandPalette component
  it('renders CommandPalette component', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByText('CommandPalette')).toBeInTheDocument();
  });

  // 10. Has branding with "InfoDigest" title
  it('has branding with InfoDigest title and logo', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>
    );
    // Brand title
    expect(screen.getByText('InfoDigest')).toBeInTheDocument();
    // Subtitle
    expect(screen.getByText('SYNTHESIZE INFORMATION OS')).toBeInTheDocument();
    // Logo mark
    expect(screen.getByText('ID')).toBeInTheDocument();
    // The logo-box should be present
    expect(document.querySelector('.logo-box')).toBeInTheDocument();
  });
});
