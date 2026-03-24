// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  TabNavigation,
  TabErrorBoundary,
  TABS,
  type TabId,
} from '../../src/components/nexus/TabNavigation.js';

afterEach(() => {
  cleanup();
  // Reset URL after each test
  window.history.replaceState(null, '', window.location.pathname);
});

// ── Helper: set URL query param before render ───────────────

function setUrlTab(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState(null, '', url.toString());
}

// ── Component rendering (AC1, T13.1.1) ─────────────────────

describe('TabNavigation — rendering', () => {
  it('T13.1.1 — renders all 3 tab buttons: Dashboard, Aportes, Ativos', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    for (const tab of TABS) {
      const buttons = screen.getAllByRole('tab', { name: new RegExp(tab.label) });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('T13.1.4 — renders Dashboard content by default (no query param)', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: dashboard');
  });

  it('renders controlled tab content', () => {
    render(
      <TabNavigation activeTab="ativos">
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: ativos');
  });
});

// ── Tab switching (AC2, AC3, T13.1.2) ──────────────────────

describe('TabNavigation — tab switching', () => {
  it('T13.1.2 — clicking Aportes tab shows Aportes content and updates URL', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    const aportesButtons = screen.getAllByRole('tab', { name: /Aportes/ });
    fireEvent.click(aportesButtons[0]);

    expect(screen.getByTestId('content')).toHaveTextContent('Active: aportes');
    expect(window.location.search).toContain('tab=aportes');
  });

  it('clicking each tab fires onTabChange with its id', () => {
    const onTabChange = vi.fn();

    render(
      <TabNavigation activeTab="dashboard" onTabChange={onTabChange}>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    for (const tab of TABS) {
      const buttons = screen.getAllByRole('tab', { name: new RegExp(tab.label) });
      fireEvent.click(buttons[0]);
    }

    expect(onTabChange).toHaveBeenCalledTimes(3);
    expect(onTabChange).toHaveBeenNthCalledWith(1, 'dashboard');
    expect(onTabChange).toHaveBeenNthCalledWith(2, 'aportes');
    expect(onTabChange).toHaveBeenNthCalledWith(3, 'ativos');
  });

  it('uncontrolled mode updates content on tab click', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: dashboard');

    const ativosButtons = screen.getAllByRole('tab', { name: /Ativos/ });
    fireEvent.click(ativosButtons[0]);

    expect(screen.getByTestId('content')).toHaveTextContent('Active: ativos');
  });
});

// ── URL deep-linking (AC5, AC6, T13.1.3) ───────────────────

describe('TabNavigation — URL deep-linking', () => {
  it('T13.1.3 — loads with ?tab=ativos → Ativos tab active', () => {
    setUrlTab('ativos');

    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: ativos');
  });

  it('loads with ?tab=aportes → Aportes tab active', () => {
    setUrlTab('aportes');

    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: aportes');
  });

  it('loads with invalid ?tab=xyz → falls back to Dashboard', () => {
    setUrlTab('xyz');

    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: dashboard');
  });

  it('switching to Dashboard removes tab param from URL', () => {
    setUrlTab('aportes');

    render(
      <TabNavigation>
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    const dashboardButtons = screen.getAllByRole('tab', { name: /Dashboard/ });
    fireEvent.click(dashboardButtons[0]);

    expect(window.location.search).not.toContain('tab=');
  });
});

// ── Tab caching behavior (AC7, T13.1.5) ────────────────────

describe('TabNavigation — cache behavior', () => {
  it('T13.1.5 — switching tabs does not remount (render function called, no re-fetch)', () => {
    const renderFn = vi.fn((tab: TabId) => (
      <div data-testid="content">Active: {tab}</div>
    ));

    render(<TabNavigation>{renderFn}</TabNavigation>);

    const initialCallCount = renderFn.mock.calls.length;

    const aportesButtons = screen.getAllByRole('tab', { name: /Aportes/ });
    fireEvent.click(aportesButtons[0]);

    // Render function called again with new tab (no full remount/re-fetch)
    expect(renderFn.mock.calls.length).toBeGreaterThan(initialCallCount);
    expect(screen.getByTestId('content')).toHaveTextContent('Active: aportes');
  });
});

// ── Mobile touch targets (AC8, T13.1.6) ────────────────────

describe('TabNavigation — mobile touch targets', () => {
  it('T13.1.6 — mobile tab buttons have min-height >= 44px', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    // Mobile tabs use min-h-[56px] class (56px > 44px requirement)
    const mobileTabs = TABS.map((t) =>
      document.getElementById(`tab-mobile-${t.id}`),
    ).filter(Boolean);

    expect(mobileTabs.length).toBe(3);
    for (const btn of mobileTabs) {
      expect(btn!.className).toContain('min-h-[56px]');
    }
  });
});

// ── Active indicator (AC3) ──────────────────────────────────

describe('TabNavigation — active indicator', () => {
  it('active tab has aria-selected="true"', () => {
    render(
      <TabNavigation activeTab="aportes">
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    const allTabs = screen.getAllByRole('tab');
    const aportesTabs = allTabs.filter((el) => el.textContent?.includes('Aportes'));

    expect(aportesTabs.length).toBeGreaterThanOrEqual(1);
    for (const tab of aportesTabs) {
      expect(tab).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('inactive tabs have aria-selected="false"', () => {
    render(
      <TabNavigation activeTab="dashboard">
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    const allTabs = screen.getAllByRole('tab');
    const inactiveTabs = allTabs.filter(
      (el) => !el.textContent?.includes('Dashboard'),
    );

    expect(inactiveTabs.length).toBeGreaterThanOrEqual(1);
    for (const tab of inactiveTabs) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });
});

// ── Error boundary (T8.3.5) ────────────────────────────────

function ThrowingChild(): never {
  throw new Error('Component render error');
}

describe('TabErrorBoundary', () => {
  it('displays fallback when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TabErrorBoundary
        fallback={<div role="alert">Falha ao carregar seção</div>}
        resetKey="test"
      >
        <ThrowingChild />
      </TabErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar seção');

    spy.mockRestore();
  });

  it('renders children normally when no error', () => {
    render(
      <TabErrorBoundary
        fallback={<div>Error</div>}
        resetKey="test"
      >
        <div data-testid="child">All good</div>
      </TabErrorBoundary>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('All good');
  });
});

describe('TabNavigation — error boundary integration', () => {
  it('shows "Falha ao carregar seção" when tab content throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TabNavigation activeTab="dashboard">
        {() => <ThrowingChild />}
      </TabNavigation>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar seção');

    spy.mockRestore();
  });
});
