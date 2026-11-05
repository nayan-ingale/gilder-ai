import { describe, expect, it } from 'vitest';
import { readFlag, writeFlag } from './view-settings.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const brokenStorage = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

describe('view settings', () => {
  it('remembers a choice', () => {
    const storage = memoryStorage();
    expect(readFlag('legend', storage)).toBeUndefined();
    writeFlag('legend', true, storage);
    expect(readFlag('legend', storage)).toBe(true);
    writeFlag('legend', false, storage);
    expect(readFlag('legend', storage)).toBe(false);
  });

  it('ignores values it did not write', () => {
    const storage = memoryStorage();
    storage.setItem('legend', 'yes');
    expect(readFlag('legend', storage)).toBeUndefined();
  });

  it('works without storage, or when storage throws', () => {
    expect(readFlag('legend', undefined)).toBeUndefined();
    expect(() => writeFlag('legend', true, undefined)).not.toThrow();
    expect(readFlag('legend', brokenStorage)).toBeUndefined();
    expect(() => writeFlag('legend', true, brokenStorage)).not.toThrow();
  });
});
