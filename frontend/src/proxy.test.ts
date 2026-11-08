import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const visit = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : {}));

describe('the login gate', () => {
  it('sends a visitor without a session cookie to /login', () => {
    const response = visit('/c/abc?x=1');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('lets a visitor with a session cookie through', () => {
    const response = visit('/', 'theme=dark; gilder_sid=abc');

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('gates only the signed-in pages', () => {
    expect(config.matcher).toEqual(['/', '/c/:path*', '/settings/:path*']);
  });
});
