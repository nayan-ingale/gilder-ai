import { describe, expect, it } from 'vitest';
import {
  agentName,
  formatAmount,
  formatDuration,
  formatRupees,
  formatTokens,
  formatWhen,
} from './billing';

describe('money', () => {
  it('shows paise as rupees, with two decimals for payments', () => {
    expect(formatRupees(19_900)).toBe('₹199');
    expect(formatAmount(19_900)).toBe('₹199.00');
    expect(formatAmount(0)).toBe('₹0.00');
    expect(formatAmount(10_000_050)).toBe('₹1,00,000.50');
  });
});

describe('formatDuration', () => {
  it('shows seconds with one decimal, and very short times in milliseconds', () => {
    expect(formatDuration(900)).toBe('0.9 s');
    expect(formatDuration(18_240)).toBe('18.2 s');
    expect(formatDuration(40)).toBe('40 ms');
  });
});

describe('formatTokens', () => {
  it('shows thousands with one decimal, and small counts as they are', () => {
    expect(formatTokens(1_200)).toBe('1.2k');
    expect(formatTokens(900)).toBe('0.9k');
    expect(formatTokens(40)).toBe('40');
  });
});

describe('formatWhen', () => {
  it('says today or yesterday, or the date, with a 24-hour time', () => {
    const now = new Date(2026, 10, 17, 9, 0);

    expect(formatWhen(new Date(2026, 10, 17, 1, 12), now)).toBe('Today, 01:12');
    expect(formatWhen(new Date(2026, 10, 16, 22, 15), now)).toBe('Yesterday, 22:15');
    expect(formatWhen(new Date(2026, 10, 2, 14, 5), now)).toBe('Nov 2, 14:05');
  });
});

describe('agentName', () => {
  it('names each agent, and keeps an unknown one as it is', () => {
    expect(agentName('pdf_qa')).toBe('PDF Q&A');
    expect(agentName('image_qa')).toBe('Image Q&A');
    expect(agentName('video')).toBe('video');
  });
});
