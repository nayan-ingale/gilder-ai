/**
 * The only routes the gateway forwards. Each public route under /api names the service that
 * answers it, the service's own path and whether the caller must be signed in. Anything not
 * listed gets a 404 from the gateway itself and never reaches a service, so the services'
 * internal routes can't be called from outside.
 */

export type ServiceName = 'auth' | 'chat' | 'agent' | 'billing';
export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PublicRoute {
  method: RouteMethod;
  /** The public path, with :params, such as /api/chats/:id. */
  path: string;
  service: ServiceName;
  /** The service's own path. The :params from `path` are filled in. */
  target: string;
  /** 'required': the caller must be signed in. 'none': open, such as sign-in itself. */
  session: 'required' | 'none';
  /**
   * A server-to-server webhook, such as Razorpay's: it has no browser Origin, so the Origin check
   * is skipped (the service checks the sender's signature instead), and these extra headers are
   * passed on for that check.
   */
  webhook?: { headers: readonly string[] };
}

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  // Sign-in and the user's own account.
  {
    method: 'POST',
    path: '/api/auth/session',
    service: 'auth',
    target: '/sessions',
    session: 'none',
  },
  {
    method: 'POST',
    path: '/api/auth/dev-session',
    service: 'auth',
    target: '/sessions/dev',
    session: 'none',
  },
  {
    method: 'DELETE',
    path: '/api/auth/session',
    service: 'auth',
    target: '/sessions/current',
    session: 'required',
  },
  { method: 'GET', path: '/api/me', service: 'auth', target: '/me', session: 'required' },
  { method: 'PATCH', path: '/api/me', service: 'auth', target: '/me', session: 'required' },

  // Chats: list and search, create, rename, pin, delete, and read the history.
  { method: 'GET', path: '/api/chats', service: 'chat', target: '/chats', session: 'required' },
  { method: 'POST', path: '/api/chats', service: 'chat', target: '/chats', session: 'required' },
  {
    method: 'GET',
    path: '/api/chats/:id',
    service: 'chat',
    target: '/chats/:id',
    session: 'required',
  },
  {
    method: 'PATCH',
    path: '/api/chats/:id',
    service: 'chat',
    target: '/chats/:id',
    session: 'required',
  },
  {
    method: 'DELETE',
    path: '/api/chats/:id',
    service: 'chat',
    target: '/chats/:id',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/chats/:id/messages',
    service: 'chat',
    target: '/chats/:id/messages',
    session: 'required',
  },

  // Answers: send a message, regenerate or edit (each streams the answer back), and stop.
  {
    method: 'POST',
    path: '/api/chats/:id/messages',
    service: 'agent',
    target: '/chats/:id/turns',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/chats/:id/messages/:messageId/regenerate',
    service: 'agent',
    target: '/chats/:id/messages/:messageId/regenerate',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/chats/:id/messages/:messageId/edit',
    service: 'agent',
    target: '/chats/:id/messages/:messageId/edit',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/turns/:turnId/stop',
    service: 'agent',
    target: '/turns/:turnId/stop',
    session: 'required',
  },

  // Files: start and complete an upload, read a file's details, get a fresh download link.
  {
    method: 'POST',
    path: '/api/files/uploads',
    service: 'agent',
    target: '/files/uploads',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/files/:fileId/complete',
    service: 'agent',
    target: '/files/:fileId/complete',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/files/:fileId',
    service: 'agent',
    target: '/files/:fileId',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/files/:fileId/url',
    service: 'agent',
    target: '/files/:fileId/url',
    session: 'required',
  },

  // Buying credits and the usage page.
  {
    method: 'GET',
    path: '/api/billing/plans',
    service: 'billing',
    target: '/plans',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/billing/orders',
    service: 'billing',
    target: '/orders',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/billing/orders/:orderId/verify',
    service: 'billing',
    target: '/orders/:orderId/verify',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/billing/payments',
    service: 'billing',
    target: '/payments',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/billing/payments/:orderId',
    service: 'billing',
    target: '/payments/:orderId',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/usage/summary',
    service: 'billing',
    target: '/usage/summary',
    session: 'required',
  },
  {
    method: 'GET',
    path: '/api/usage/events',
    service: 'billing',
    target: '/usage/events',
    session: 'required',
  },
  {
    method: 'POST',
    path: '/api/webhooks/razorpay',
    service: 'billing',
    target: '/webhooks/razorpay',
    session: 'none',
    webhook: { headers: ['x-razorpay-signature', 'x-razorpay-event-id'] },
  },

  // Credits: the user's plan and balance.
  {
    method: 'GET',
    path: '/api/billing/account',
    service: 'billing',
    target: '/account',
    session: 'required',
  },
];

export interface MatchedRoute {
  route: PublicRoute;
  /** The path to call on the service, with the params filled in. */
  targetPath: string;
}

// Route params are IDs: letters, digits, '-' and '_' only. Anything else (a dot segment, an
// encoded slash) can't be smuggled into the service's path.
const SAFE_PARAM = /^[A-Za-z0-9_-]{1,64}$/;

function segments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/** The route for a request, or undefined when the gateway must answer 404. */
export function matchRoute(
  method: string,
  path: string,
  routes: readonly PublicRoute[] = PUBLIC_ROUTES,
): MatchedRoute | undefined {
  const actual = segments(path);
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const expected = segments(route.path);
    if (expected.length !== actual.length) {
      continue;
    }
    const params: Record<string, string> = {};
    const matches = expected.every((part, index) => {
      const value = actual[index] ?? '';
      if (part.startsWith(':')) {
        params[part.slice(1)] = value;
        return SAFE_PARAM.test(value);
      }
      return part === value;
    });
    if (matches) {
      const targetPath = route.target.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
        const value = params[name];
        if (value === undefined) {
          throw new Error(`route ${route.path} has no :${name} for its target ${route.target}`);
        }
        return value;
      });
      return { route, targetPath };
    }
  }
  return undefined;
}
