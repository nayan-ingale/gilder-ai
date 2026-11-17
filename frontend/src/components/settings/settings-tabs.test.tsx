// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsTabList, SettingsTabs } from './settings-tabs';

let segment: string | null = 'billing';
vi.mock('next/navigation', () => ({ useSelectedLayoutSegment: () => segment }));

afterEach(() => {
  cleanup();
});

describe('SettingsTabs', () => {
  it('links every tab and marks the open one as the current page', () => {
    segment = 'billing';
    render(<SettingsTabs />);

    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    const links = screen.getAllByRole('link');
    expect(nav).toBeTruthy();
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['General', '/settings/general'],
      ['Billing', '/settings/billing'],
      ['Usage', '/settings/usage'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('marks none while the open page is not known yet', () => {
    render(<SettingsTabList active={null} />);

    expect(
      screen.getAllByRole('link').every((link) => link.getAttribute('aria-current') === null),
    ).toBe(true);
  });
});
