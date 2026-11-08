import { cookies, headers } from 'next/headers';
import { gatewayUrlFromEnv } from './gateway-proxy';

export const SESSION_COOKIE = 'gilder_sid';

/**
 * A GET to the gateway from a server component, with the browser's cookies. Returns null when
 * there is no session cookie, without calling the gateway. Reading cookies makes the caller
 * per-request, so it must run inside a <Suspense> boundary.
 */
export async function gatewayGet(path: string): Promise<Response | null> {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)) {
    return null;
  }
  // The visitor's own address, as the /api proxy forwards it: without it every server render
  // would count against the Next.js server's single per-IP limit at the gateway.
  const forwardedFor = (await headers()).get('x-forwarded-for');
  return fetch(`${gatewayUrlFromEnv().replace(/\/+$/, '')}${path}`, {
    headers: {
      cookie: store.toString(),
      'x-gilder-client': 'web',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
    },
    cache: 'no-store',
  });
}
