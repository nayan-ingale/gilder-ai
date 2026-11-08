import { AppError } from '@gilder/shared';
import { cert, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, FirebaseAuthError, getAuth } from 'firebase-admin/auth';

/**
 * Google sign-in. The browser signs in with Firebase and sends auth the ID token it gets. Auth
 * checks that token with the Firebase Admin SDK before it trusts who the user is.
 */

/** Who signed in, as Google and Firebase vouch for it. */
export interface GoogleIdentity {
  firebaseUid: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/** Checks the ID token from the browser. Throws a 401 AppError when the token is no good. */
export type VerifyIdToken = (idToken: string) => Promise<GoogleIdentity>;

/** The one part of firebase-admin's Auth used here, so tests can pass a fake. */
export interface IdTokenChecker {
  verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}

export interface FirebaseSettings {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// The token itself is no good, so the user has to sign in again: 401. Every other failure (a
// wrong service account, Firebase unreachable) is the server's problem, so it stays a 500.
const REJECTED_TOKEN_CODES = new Set([
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/** Turns a token checker into the verifier the sign-in route calls. */
export function verifierFrom(checker: IdTokenChecker): VerifyIdToken {
  return async (idToken) => {
    let decoded: DecodedIdToken;
    try {
      // `true` also asks Firebase whether the token was revoked, for example after the account
      // was disabled, instead of trusting any unexpired token.
      decoded = await checker.verifyIdToken(idToken, true);
    } catch (error) {
      if (error instanceof FirebaseAuthError && REJECTED_TOKEN_CODES.has(error.code)) {
        throw new AppError('unauthorized', 'The Google sign-in is not valid. Sign in again.', {
          cause: error,
        });
      }
      throw error;
    }

    if (typeof decoded.email !== 'string' || decoded.email_verified !== true) {
      throw new AppError('unauthorized', 'The Google account has no verified email address');
    }
    const name: unknown = decoded.name;
    return {
      firebaseUid: decoded.uid,
      email: decoded.email,
      ...(typeof name === 'string' && name !== '' ? { name } : {}),
      ...(decoded.picture ? { avatarUrl: decoded.picture } : {}),
    };
  };
}

/** The real verifier, from a service account of the project's own Firebase project. */
export function createFirebaseVerifier(settings: FirebaseSettings): VerifyIdToken {
  const app = initializeApp(
    { credential: cert(settings), projectId: settings.projectId },
    'gilder-auth',
  );
  return verifierFrom(getAuth(app));
}

/**
 * Used when the Firebase settings are not set, which is allowed outside production. Google
 * sign-in then answers 503 with a clear message, and dev sign-in still works.
 */
export const googleSignInNotSetUp: VerifyIdToken = async () => {
  throw new AppError('service_unavailable', 'Google sign-in is not set up on this server');
};
