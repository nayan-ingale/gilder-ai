import { cookies } from 'next/headers';
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
  return fetch(`${gatewayUrlFromEnv().replace(/\/+$/, '')}${path}`, {
    headers: { cookie: store.toString(), 'x-gilder-client': 'web' },
    cache: 'no-store',
  });
}
