import type { RequestHandler } from 'express';
import {
  decodeJwt,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
} from 'jose';
import { setContextUserId } from './context.ts';
import { AppError } from './errors.ts';

/**
 * Service-to-service authentication. The gateway signs a short-lived token for every request it
 * forwards; services accept a request only with a valid token addressed to them. A plain user-ID
 * header would not be enough: anything that can reach a service could claim to be any user.
 *
 * The token says two separate things. That it is valid proves the request came through the
 * gateway. Its subject, when present, is the signed-in user. Requests with no session, such as a
 * sign-in, still get a token, just without a user, so no service route is open to direct calls.
 */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

/**
 * Who can sign internal tokens. The gateway signs for every request it forwards. Auth and the
 * agent also call other services (auth asks billing for the sign-up grant; the agent saves
 * messages and charges credits), each with its own key, so a service trusts exactly the callers
 * it needs, and a route can say which callers may use it.
 */
export const INTERNAL_CALLERS = ['gateway', 'auth', 'agent'] as const;
export type InternalCaller = (typeof INTERNAL_CALLERS)[number];
/** The callers other than the gateway: the services that call other services. */
export type ServiceCaller = Exclude<InternalCaller, 'gateway'>;

const issuerOf = (caller: InternalCaller) => `gilder-${caller}`;
const ALGORITHM = 'EdDSA';

export type InternalKey = Awaited<ReturnType<typeof importPKCS8>>;

/** The public keys a service accepts tokens from, by caller. The gateway's is always there. */
export type TrustedKeys = { gateway: InternalKey } & Partial<Record<ServiceCaller, InternalKey>>;

export interface InternalTokenClaims {
  /** The signed-in user. Left out for a request with no session, such as a sign-in. */
  userId?: string;
  requestId?: string;
}

export interface VerifiedInternalToken extends InternalTokenClaims {
  /** Who signed the token. */
  caller: InternalCaller;
}

export function importInternalPrivateKey(pem: string): Promise<InternalKey> {
  return importPKCS8(pem, ALGORITHM);
}

export function importInternalPublicKey(pem: string): Promise<InternalKey> {
  return importSPKI(pem, ALGORITHM);
}

/** Creates a new key pair as PEM text, for .env files and tests. */
export async function generateInternalKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair(ALGORITHM, { extractable: true });
  return { privateKey: await exportPKCS8(privateKey), publicKey: await exportSPKI(publicKey) };
}

/** Signs a token for `audience`. `caller` is who signs it: the gateway unless a service calls. */
export function signInternalToken(
  privateKey: InternalKey,
  audience: string,
  claims: InternalTokenClaims,
  ttlSeconds = 60,
  caller: InternalCaller = 'gateway',
): Promise<string> {
  const token = new SignJWT(claims.requestId ? { rid: claims.requestId } : {})
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(issuerOf(caller))
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`);
  if (claims.userId) {
    token.setSubject(claims.userId);
  }
  return token.sign(privateKey);
}

/**
 * Throws if the token is missing, forged, expired, addressed to another service, or signed by a
 * caller this service doesn't trust. The issuer is read first only to pick the key; the
 * signature check then confirms it.
 */
export async function verifyInternalToken(
  token: string,
  trusted: TrustedKeys,
  audience: string,
  currentDate?: Date,
): Promise<VerifiedInternalToken> {
  const issuer = decodeJwt(token).iss;
  const caller = INTERNAL_CALLERS.find((candidate) => issuerOf(candidate) === issuer);
  const key = caller ? trusted[caller] : undefined;
  if (!caller || !key) {
    throw new Error(`tokens from ${String(issuer)} are not trusted here`);
  }
  const { payload } = await jwtVerify(token, key, {
    issuer: issuerOf(caller),
    audience,
    algorithms: [ALGORITHM],
    ...(currentDate ? { currentDate } : {}),
  });
  const claims: VerifiedInternalToken = { caller };
  if (typeof payload.sub === 'string' && payload.sub !== '') {
    claims.userId = payload.sub;
  }
  if (typeof payload.rid === 'string') {
    claims.requestId = payload.rid;
  }
  return claims;
}

/**
 * Express middleware for services: rejects requests without a valid internal token (401), so
 * only the gateway, and the services this one trusts, can call them. The signer becomes
 * `res.locals.caller`, and a user named in the token becomes `res.locals.userId`. It does not
 * require a user: routes that act for one add requireUser() as well.
 */
export function requireInternalToken(trusted: TrustedKeys, audience: string): RequestHandler {
  return async (req, res, next) => {
    const token = req.get(INTERNAL_TOKEN_HEADER);
    if (!token) {
      throw new AppError('unauthorized', 'Missing internal token');
    }
    let claims: VerifiedInternalToken;
    try {
      claims = await verifyInternalToken(token, trusted, audience);
    } catch (error) {
      throw new AppError('unauthorized', 'Invalid internal token', { cause: error });
    }
    res.locals.caller = claims.caller;
    if (claims.userId) {
      res.locals.userId = claims.userId;
      setContextUserId(claims.userId);
    }
    next();
  };
}

/**
 * For routes that act for a user, after requireInternalToken: answers 401 unless the internal
 * token named a signed-in user.
 */
export function requireUser(): RequestHandler {
  return (_req, res, next) => {
    if (!res.locals.userId) {
      next(new AppError('unauthorized', 'This route needs a signed-in user'));
      return;
    }
    next();
  };
}

/**
 * For internal routes meant for one service, after requireInternalToken: answers 403 unless the
 * token was signed by one of `callers`. The gateway never forwards /internal routes; this keeps a
 * service's key from reaching routes meant for another.
 */
export function requireCaller(...callers: ServiceCaller[]): RequestHandler {
  return (_req, res, next) => {
    const caller = res.locals.caller as InternalCaller | undefined;
    if (!caller || !(callers as InternalCaller[]).includes(caller)) {
      next(new AppError('forbidden', 'This route is not open to this caller'));
      return;
    }
    next();
  };
}
