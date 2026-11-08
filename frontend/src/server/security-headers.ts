/**
 * Security headers for every page, set in next.config.ts.
 *
 * The Content-Security-Policy allows inline scripts: Next.js inlines its own bootstrap scripts,
 * and a nonce would force every page to render per request, which rules out prerendered shells.
 * Everything else is locked down: scripts only from this app, Razorpay checkout and Google's
 * sign-in; no plugins; no framing of the app; network calls only to the services the app uses.
 */

export interface CspOptions {
  dev: boolean;
}

// Outside services the browser talks to directly.
const GOOGLE_SIGN_IN_SCRIPTS = ['https://apis.google.com'];
const RAZORPAY_SCRIPTS = ['https://checkout.razorpay.com'];
const CONNECT = [
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://www.googleapis.com',
  'https://apis.google.com',
  'https://api.razorpay.com',
  'https://lumberjack.razorpay.com',
  // Presigned uploads go straight from the browser to S3.
  'https://*.amazonaws.com',
];
const FRAMES = [
  'https://*.firebaseapp.com',
  'https://accounts.google.com',
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
];

export function contentSecurityPolicy({ dev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // React needs eval in development only, for its error overlay.
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      ...GOOGLE_SIGN_IN_SCRIPTS,
      ...RAZORPAY_SCRIPTS,
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Avatars, generated images and search thumbnails come from several https hosts.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'"],
    // Hot reload uses a websocket in development.
    'connect-src': ["'self'", ...CONNECT, ...(dev ? ['ws:'] : [])],
    'frame-src': ["'self'", ...FRAMES],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) {
    policy.push('upgrade-insecure-requests');
  }
  return policy.join('; ');
}

export function securityHeaders(options: CspOptions): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(options) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // The composer's mic needs the microphone, for this site only; nothing else is allowed.
    { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ];
}
