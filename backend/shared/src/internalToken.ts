import type { RequestHandler } from 'express';
import {
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
 */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const ISSUER = 'gilder-gateway';
const ALGORITHM = 'EdDSA';

export type InternalKey = Awaited<ReturnType<typeof importPKCS8>>;

export interface InternalTokenClaims {
  userId: string;
  requestId?: string;
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

export function signInternalToken(
  privateKey: InternalKey,
  audience: string,
  claims: InternalTokenClaims,
  ttlSeconds = 60,
): Promise<string> {
  return new SignJWT(claims.requestId ? { rid: claims.requestId } : {})
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(privateKey);
}

/** Throws if the token is missing, forged, expired, or addressed to another service. */
export async function verifyInternalToken(
  token: string,
  publicKey: InternalKey,
  audience: string,
  currentDate?: Date,
): Promise<InternalTokenClaims> {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: ISSUER,
    audience,
    algorithms: [ALGORITHM],
    ...(currentDate ? { currentDate } : {}),
  });
  if (!payload.sub) {
    throw new Error('internal token has no subject');
  }
  return typeof payload.rid === 'string'
    ? { userId: payload.sub, requestId: payload.rid }
    : { userId: payload.sub };
}

/** Express middleware for services: rejects requests without a valid internal token (401). */
export function requireInternalToken(publicKey: InternalKey, audience: string): RequestHandler {
  return async (req, res, next) => {
    const token = req.get(INTERNAL_TOKEN_HEADER);
    if (!token) {
      throw new AppError('unauthorized', 'Missing internal token');
    }
    let claims: InternalTokenClaims;
    try {
      claims = await verifyInternalToken(token, publicKey, audience);
    } catch (error) {
      throw new AppError('unauthorized', 'Invalid internal token', { cause: error });
    }
    res.locals.userId = claims.userId;
    setContextUserId(claims.userId);
    next();
  };
}
