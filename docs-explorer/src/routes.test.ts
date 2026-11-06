import { describe, expect, it } from 'vitest';
import { NAV, paths } from './routes.ts';

describe('paths', () => {
  it('builds page addresses with the selection in the query string', () => {
    expect(paths.architecture('system')).toBe('/architecture/system');
    expect(paths.architecture('data', 'redis')).toBe('/architecture/data?node=redis');
    expect(paths.flow('readiness-check', 'checks')).toBe('/flows/readiness-check?step=checks');
    expect(paths.flow('health-check')).toBe('/flows/health-check');
    expect(paths.code()).toBe('/code');
    expect(paths.code({ file: 'backend/shared/src/health.ts' })).toBe(
      '/code?file=backend%2Fshared%2Fsrc%2Fhealth.ts',
    );
  });

  it('puts a walkthrough at its last visited step and keeps the whole trail', () => {
    const address = paths.walkthrough('health-check', ['caller', 'request-id']);
    const params = new URLSearchParams(address.split('?')[1]);
    expect(address.startsWith('/flows/health-check?')).toBe(true);
    expect(params.get('step')).toBe('request-id');
    expect(params.get('walk')).toBe('caller,request-id');
    expect(paths.walkthrough('health-check', [])).toBe('/flows/health-check');
  });

  it('opens a docs page, or one of its sections with ?section=', () => {
    expect(paths.doc('logging')).toBe('/docs/logging');
    expect(paths.doc('logging', 'levels')).toBe('/docs/logging?section=levels');
    expect(paths.doc('a b', 'x/y')).toBe('/docs/a%20b?section=x%2Fy');
  });

  it('opens Error Handling at one of its docs sections with the same key', () => {
    expect(paths.errors()).toBe('/errors');
    expect(paths.errors('shape')).toBe('/errors?section=shape');
  });

  it('gives every sidebar item its own id and address', () => {
    expect(new Set(NAV.map((item) => item.id)).size).toBe(NAV.length);
    expect(new Set(NAV.map((item) => item.to)).size).toBe(NAV.length);
  });
});
