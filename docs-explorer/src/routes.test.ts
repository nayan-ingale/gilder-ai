import { describe, expect, it } from 'vitest';
import { NAV, paths } from './routes.ts';

describe('paths', () => {
  it('builds page addresses with the selection in the query string', () => {
    expect(paths.architecture('system')).toBe('/architecture/system');
    expect(paths.architecture('data', 'redis')).toBe('/architecture/data?node=redis');
    expect(paths.flow('readiness-check', 'checks')).toBe('/flows/readiness-check?step=checks');
    expect(paths.flow('health-check')).toBe('/flows/health-check');
  });

  it('gives every sidebar item its own id and address', () => {
    expect(new Set(NAV.map((item) => item.id)).size).toBe(NAV.length);
    expect(new Set(NAV.map((item) => item.to)).size).toBe(NAV.length);
  });
});
