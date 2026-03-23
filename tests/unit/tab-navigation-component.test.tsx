// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
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
});

// ── Component rendering (AC1) ──────────────────────────────

describe('TabNavigation — rendering', () => {
  it('T8.3.1 — renders all 3 tab buttons', () => {
    render(
      <TabNavigation>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    // Desktop + mobile tab bars both render, so each label appears twice (6 total)
    for (const tab of TABS) {
      const buttons = screen.getAllByRole('tab', { name: new RegExp(tab.label) });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders default tab content on mount', () => {
    render(
      <TabNavigation defaultTab="overview">
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: overview');
  });

  it('renders controlled tab content', () => {
    render(
      <TabNavigation activeTab="rebalancear">
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: rebalancear');
  });
});

// ── Tab switching (AC2) ─────────────────────────────────────

describe('TabNavigation — tab switching', () => {
  it('T8.3.2 — clicking a tab triggers onTabChange with correct TabId', () => {
    const onTabChange = vi.fn();

    render(
      <TabNavigation activeTab="overview" onTabChange={onTabChange}>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    const rebalancearButtons = screen.getAllByRole('tab', { name: /Rebalancear/ });
    fireEvent.click(rebalancearButtons[0]);

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('rebalancear');
  });

  it('clicking each tab fires onTabChange with its id', () => {
    const onTabChange = vi.fn();

    render(
      <TabNavigation activeTab="overview" onTabChange={onTabChange}>
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    for (const tab of TABS) {
      const buttons = screen.getAllByRole('tab', { name: new RegExp(tab.label) });
      fireEvent.click(buttons[0]);
    }

    expect(onTabChange).toHaveBeenCalledTimes(3);
    expect(onTabChange).toHaveBeenNthCalledWith(1, 'overview');
    expect(onTabChange).toHaveBeenNthCalledWith(2, 'detalhes');
    expect(onTabChange).toHaveBeenNthCalledWith(3, 'rebalancear');
  });

  it('uncontrolled mode updates content on tab click', () => {
    render(
      <TabNavigation defaultTab="overview">
        {(tab: TabId) => <div data-testid="content">Active: {tab}</div>}
      </TabNavigation>,
    );

    expect(screen.getByTestId('content')).toHaveTextContent('Active: overview');

    const detalhesButtons = screen.getAllByRole('tab', { name: /Detalhes/ });
    fireEvent.click(detalhesButtons[0]);

    expect(screen.getByTestId('content')).toHaveTextContent('Active: detalhes');
  });
});

// ── Active indicator (AC3) ──────────────────────────────────

describe('TabNavigation — active indicator', () => {
  it('T8.3.3 — active tab has aria-selected="true"', () => {
    render(
      <TabNavigation activeTab="detalhes">
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    const allTabs = screen.getAllByRole('tab');
    const detalhesTabs = allTabs.filter((el) => el.textContent?.includes('Detalhes'));

    // At least one tab button for Detalhes with aria-selected="true"
    expect(detalhesTabs.length).toBeGreaterThanOrEqual(1);
    for (const tab of detalhesTabs) {
      expect(tab).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('inactive tabs have aria-selected="false"', () => {
    render(
      <TabNavigation activeTab="overview">
        {(tab: TabId) => <div>Content: {tab}</div>}
      </TabNavigation>,
    );

    const allTabs = screen.getAllByRole('tab');
    const inactiveTabs = allTabs.filter(
      (el) => !el.textContent?.includes('Overview'),
    );

    expect(inactiveTabs.length).toBeGreaterThanOrEqual(1);
    for (const tab of inactiveTabs) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });
});

// ── Error boundary (AC4, T8.3.5) ────────────────────────────

function ThrowingChild(): never {
  throw new Error('Component render error');
}

describe('TabErrorBoundary', () => {
  it('T8.3.5 — displays fallback "Falha ao carregar seção" when child throws', () => {
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
      <TabNavigation activeTab="overview">
        {() => <ThrowingChild />}
      </TabNavigation>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar seção');

    spy.mockRestore();
  });
});
