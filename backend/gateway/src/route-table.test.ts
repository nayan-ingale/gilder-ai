import { describe, expect, it } from 'vitest';
import { matchRoute, PUBLIC_ROUTES, type PublicRoute } from './route-table.ts';

describe('matchRoute', () => {
  it('maps each public auth route to its service path', () => {
    expect(matchRoute('POST', '/api/auth/session')).toMatchObject({
      route: { service: 'auth', session: 'none' },
      targetPath: '/sessions',
    });
    expect(matchRoute('DELETE', '/api/auth/session')).toMatchObject({
      route: { session: 'required' },
      targetPath: '/sessions/current',
    });
    expect(matchRoute('GET', '/api/me')?.targetPath).toBe('/me');
    expect(matchRoute('PATCH', '/api/me')?.targetPath).toBe('/me');
  });

  it('maps each chat route to the chat service, always behind a session', () => {
    const id = '65f0c0ffee1234567890abcd';
    const cases = [
      ['GET', '/api/chats', '/chats'],
      ['POST', '/api/chats', '/chats'],
      ['GET', `/api/chats/${id}`, `/chats/${id}`],
      ['PATCH', `/api/chats/${id}`, `/chats/${id}`],
      ['DELETE', `/api/chats/${id}`, `/chats/${id}`],
      ['GET', `/api/chats/${id}/messages`, `/chats/${id}/messages`],
    ] as const;

    for (const [method, path, target] of cases) {
      expect(matchRoute(method, path), `${method} ${path}`).toMatchObject({
        route: { service: 'chat', session: 'required' },
        targetPath: target,
      });
    }
    expect(matchRoute('PUT', `/api/chats/${id}`)).toBeUndefined();
    expect(matchRoute('DELETE', '/api/chats')).toBeUndefined();
  });

  it('finds nothing for an unknown path or a method the route does not have', () => {
    expect(matchRoute('GET', '/api/nothing-here')).toBeUndefined();
    expect(matchRoute('DELETE', '/api/me')).toBeUndefined();
    expect(matchRoute('GET', '/api/auth/session')).toBeUndefined();
  });

  it('never reaches an internal route (SEC-01)', () => {
    for (const path of [
      '/internal/users/1',
      '/api/internal/users/1',
      '/api/me/../internal/users/1',
      '/internal/chats/1',
      '/api/internal/messages',
      '/api/chats/1/../../internal/messages',
      '/sessions',
      '/me',
    ]) {
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        expect(matchRoute(method, path)).toBeUndefined();
      }
    }
  });

  it('fills in params, and refuses values that could change the service path', () => {
    const routes: PublicRoute[] = [
      {
        method: 'GET',
        path: '/api/chats/:id',
        service: 'chat',
        target: '/chats/:id',
        session: 'required',
      },
    ];

    expect(matchRoute('GET', '/api/chats/65f0c0ffee1234567890abcd', routes)?.targetPath).toBe(
      '/chats/65f0c0ffee1234567890abcd',
    );
    for (const value of ['..', '.', '..%2Finternal', 'a%2Fb', 'a b', 'x'.repeat(65)]) {
      expect(matchRoute('GET', `/api/chats/${value}`, routes)).toBeUndefined();
    }
  });

  it('only lists routes whose target params all come from the public path', () => {
    for (const route of PUBLIC_ROUTES) {
      const publicParams: string[] = route.path.match(/:[A-Za-z]+/g) ?? [];
      const targetParams: string[] = route.target.match(/:[A-Za-z]+/g) ?? [];
      expect(targetParams.every((param) => publicParams.includes(param))).toBe(true);
      expect(route.path.startsWith('/api/')).toBe(true);
    }
  });
});
