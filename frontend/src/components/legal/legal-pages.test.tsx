// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';

afterEach(cleanup);

describe('legal pages', () => {
  it('Privacy names what is collected and every service that handles it', () => {
    render(<PrivacyPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeTruthy();
    for (const service of [
      'Firebase',
      'Groq',
      'OpenRouter',
      'Gemini',
      'Tavily',
      'Amazon',
      'Razorpay',
    ]) {
      expect(screen.getAllByText(new RegExp(service)).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('link', { name: 'Terms of Use' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'me.nayan.dev@gmail.com' }).getAttribute('href')).toBe(
      'mailto:me.nayan.dev@gmail.com',
    );
  });

  it('Terms state the free credits and that payments are test-only', () => {
    render(<TermsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeTruthy();
    expect(screen.getByText(/100 free credits/)).toBeTruthy();
    expect(screen.getByText(/no real money is charged/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('link both pages and the home page from the header', () => {
    render(<TermsPage />);

    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(legal.querySelector('a[href="/terms"]')).toBeTruthy();
    expect(legal.querySelector('a[href="/privacy"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GilderAi home' }).getAttribute('href')).toBe('/');
  });
});
