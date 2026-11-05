import { describe, expect, it } from 'vitest';
import { plural } from './plural.ts';

describe('plural', () => {
  it('uses the singular for exactly one', () => {
    expect(plural(1, 'step')).toBe('1 step');
  });

  it('adds an "s" for any other count', () => {
    expect(plural(0, 'step')).toBe('0 steps');
    expect(plural(8, 'connection')).toBe('8 connections');
  });

  it('takes an irregular plural', () => {
    expect(plural(2, 'library', 'libraries')).toBe('2 libraries');
  });
});
