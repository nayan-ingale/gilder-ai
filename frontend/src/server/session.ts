import { cookies } from 'next/headers';
import { cache } from 'react';
import { gatewayUrlFromEnv } from './gateway-proxy';

/** What the app shows of the signed-in user (the gateway's GET /api/me). */
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  themePreference: 'system' | 'light' | 'dark';
}

const SESSION_COOKIE = 'gilder_sid';

/**
 * Looks up the signed-in user, or null. Server components call the gateway directly with the browser's
 * cookie; the browser's own requests go through /api. Reading cookies makes this per-request,
 * so it must run inside a <Suspense> boundary.
 */
async function fetchCurrentUser(): Promise<Profile | null> {
  const store = await cookies();
  if (!store.get(SESSION_COOKIE)) {
    return null;
  }
  const response = await fetch(`${gatewayUrlFromEnv().replace(/\/+$/, '')}/api/me`, {
    headers: { cookie: store.toString(), 'x-gilder-client': 'web' },
    cache: 'no-store',
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`the gateway answered ${response.status} for /api/me`);
  }
  const { user } = (await response.json()) as { user: Profile };
  return user;
}

/** The signed-in user, asked for at most once per request however many components need it. */
export const getCurrentUser = cache(fetchCurrentUser);
