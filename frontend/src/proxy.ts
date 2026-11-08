import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'gilder_sid';

/**
 * The login gate: a visitor with no session cookie who opens an app page goes to /login first.
 * Only the cookie's presence is checked here; the app layout confirms the session with the
 * gateway, and sends an expired one to /login too.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  return NextResponse.redirect(login);
}

// The signed-in pages. /login, /api and static files are never gated.
export const config = {
  matcher: ['/', '/c/:path*', '/settings/:path*'],
};
