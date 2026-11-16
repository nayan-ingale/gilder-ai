import { describe, expect, it } from 'vitest';
import { bucketOrigin, contentSecurityPolicy, securityHeaders } from './security-headers';

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((part) => {
      const [name = '', ...values] = part.split(' ');
      return [name, values];
    }),
  );
}

describe('contentSecurityPolicy', () => {
  const production = directives(contentSecurityPolicy({ dev: false }));
  const development = directives(contentSecurityPolicy({ dev: true }));

  it('locks down plugins, framing, base URLs and form targets', () => {
    expect(production.get('object-src')).toEqual(["'none'"]);
    expect(production.get('frame-ancestors')).toEqual(["'none'"]);
    expect(production.get('base-uri')).toEqual(["'self'"]);
    expect(production.get('form-action')).toEqual(["'self'"]);
    expect(production.has('upgrade-insecure-requests')).toBe(true);
  });

  it('allows scripts only from the app, Google sign-in and Razorpay, with no eval in production', () => {
    expect(production.get('script-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
      'https://apis.google.com',
      'https://checkout.razorpay.com',
    ]);
  });

  it('never mixes a hash or nonce with unsafe-inline, which would switch unsafe-inline off', () => {
    expect(contentSecurityPolicy({ dev: false })).not.toMatch(/'(sha256|sha384|sha512|nonce)-/);
  });

  it('adds only what development tooling needs', () => {
    expect(development.get('script-src')).toContain("'unsafe-eval'");
    expect(development.get('connect-src')).toContain('ws:');
    expect(development.has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('uploads', () => {
  const bucket = 'https://gilder-ai-bucket.s3.ap-south-1.amazonaws.com';

  it('lets the browser reach only the configured bucket, never any AWS address', () => {
    const policy = directives(contentSecurityPolicy({ dev: false, uploadsOrigin: bucket }));

    expect(policy.get('connect-src')).toContain(bucket);
    expect(policy.get('connect-src')?.filter((source) => source.includes('amazonaws'))).toEqual([
      bucket,
    ]);
  });

  it('allows no S3 address at all when none is configured', () => {
    const policy = directives(contentSecurityPolicy({ dev: false }));

    expect(policy.get('connect-src')?.some((source) => source.includes('amazonaws'))).toBe(false);
  });
});

describe('bucketOrigin', () => {
  it('accepts one https origin, with or without a trailing slash', () => {
    const bucket = 'https://gilder-ai-bucket.s3.ap-south-1.amazonaws.com';

    expect(bucketOrigin(bucket)).toBe(bucket);
    expect(bucketOrigin(`${bucket}/`)).toBe(bucket);
    expect(bucketOrigin(undefined)).toBeUndefined();
    expect(bucketOrigin('')).toBeUndefined();
  });

  it.each([
    'http://gilder-ai-bucket.s3.ap-south-1.amazonaws.com',
    'https://*.amazonaws.com',
    'https://gilder-ai-bucket.s3.ap-south-1.amazonaws.com/users',
    'gilder-ai-bucket',
  ])('refuses %s, which would be wrong or wider than one bucket', (value) => {
    expect(() => bucketOrigin(value)).toThrow(/S3_BUCKET_ORIGIN/);
  });
});

describe('securityHeaders', () => {
  it('sends the CSP with the other hardening headers', () => {
    const names = securityHeaders({ dev: false }).map((header) => header.key);

    expect(names).toEqual([
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-Frame-Options',
    ]);
  });
});
