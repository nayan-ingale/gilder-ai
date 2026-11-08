import { generateKeyPairSync } from 'node:crypto';
import { AppError } from '@gilder/shared';
import { type DecodedIdToken, FirebaseAuthError } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import {
  createFirebaseVerifier,
  googleSignInNotSetUp,
  type IdTokenChecker,
  verifierFrom,
} from './firebase.ts';

/** A decoded token with only the fields the verifier reads. */
function decodedToken(fields: Partial<DecodedIdToken>): DecodedIdToken {
  return { uid: 'firebase-uid-1', ...fields } as DecodedIdToken;
}

/** A checker that answers like Firebase would, and records how it was called. */
function fakeChecker(answer: () => Promise<DecodedIdToken>) {
  const verifyIdToken = vi.fn<IdTokenChecker['verifyIdToken']>(answer);
  return { checker: { verifyIdToken }, verifyIdToken };
}

describe('verifierFrom', () => {
  it('returns who signed in, and asks Firebase to check for revocation', async () => {
    const { checker, verifyIdToken } = fakeChecker(async () =>
      decodedToken({
        email: 'nayan@example.com',
        email_verified: true,
        name: 'Nayan',
        picture: 'https://example.com/a.png',
      }),
    );

    await expect(verifierFrom(checker)('id-token')).resolves.toEqual({
      firebaseUid: 'firebase-uid-1',
      email: 'nayan@example.com',
      name: 'Nayan',
      avatarUrl: 'https://example.com/a.png',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token', true);
  });

  it('leaves out a name and picture the account does not have', async () => {
    const { checker } = fakeChecker(async () =>
      decodedToken({ email: 'nayan@example.com', email_verified: true }),
    );

    await expect(verifierFrom(checker)('id-token')).resolves.toEqual({
      firebaseUid: 'firebase-uid-1',
      email: 'nayan@example.com',
    });
  });

  it('refuses an account without a verified email address', async () => {
    for (const fields of [
      { email: 'nayan@example.com', email_verified: false },
      { email: 'nayan@example.com' },
      { email_verified: true },
    ]) {
      const { checker } = fakeChecker(async () => decodedToken(fields));

      await expect(verifierFrom(checker)('id-token')).rejects.toMatchObject({
        code: 'unauthorized',
        message: 'The Google account has no verified email address',
      });
    }
  });

  it('answers 401 when Firebase rejects the token itself', async () => {
    for (const code of [
      'id-token-expired',
      'id-token-revoked',
      'argument-error',
      'user-disabled',
    ]) {
      const rejection = new FirebaseAuthError({ code, message: `token problem: ${code}` });
      const { checker } = fakeChecker(async () => {
        throw rejection;
      });

      const error = await verifierFrom(checker)('id-token').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ code: 'unauthorized', status: 401, cause: rejection });
    }
  });

  it('passes other failures on unchanged, so they become a 500', async () => {
    for (const failure of [
      new FirebaseAuthError({ code: 'invalid-credential', message: 'bad service account' }),
      new Error('getaddrinfo ENOTFOUND www.googleapis.com'),
    ]) {
      const { checker } = fakeChecker(async () => {
        throw failure;
      });

      await expect(verifierFrom(checker)('id-token')).rejects.toBe(failure);
    }
  });
});

describe('createFirebaseVerifier', () => {
  it('rejects a malformed token with a 401 through the real Firebase Admin SDK', async () => {
    // A throwaway key for a made-up project: the SDK rejects a malformed token before it
    // needs the key or the network.
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const verify = createFirebaseVerifier({
      projectId: 'demo-gilder',
      clientEmail: 'auth@demo-gilder.iam.gserviceaccount.com',
      privateKey,
    });

    await expect(verify('not-a-jwt')).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
  });
});

describe('googleSignInNotSetUp', () => {
  it('answers 503 so the caller knows Google sign-in is not available', async () => {
    await expect(googleSignInNotSetUp('id-token')).rejects.toMatchObject({
      code: 'service_unavailable',
      status: 503,
    });
  });
});
