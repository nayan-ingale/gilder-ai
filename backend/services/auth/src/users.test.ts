import { mongoose } from '@gilder/shared';
import { startTestMongo, type TestMongo } from '@gilder/shared/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { toProfile, UserModel } from './users.ts';

let mongo: TestMongo;

beforeAll(async () => {
  mongo = await startTestMongo();
  // Waits until the unique indexes exist, so the duplicate tests are meaningful.
  await UserModel.init();
}, 120_000);

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
});

const nayan = { firebaseUid: 'firebase-uid-1', email: 'nayan@example.com' };

describe('UserModel', () => {
  it('stores a user with the defaults filled in and the email in lowercase', async () => {
    const user = await UserModel.create({ ...nayan, email: '  Nayan@Example.COM ' });

    expect(user.email).toBe('nayan@example.com');
    expect(user.themePreference).toBe('system');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('needs a Firebase ID and an email', async () => {
    const error = await UserModel.create({}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(Object.keys((error as mongoose.Error.ValidationError).errors).sort()).toEqual([
      'email',
      'firebaseUid',
    ]);
  });

  it('accepts only the known themes', async () => {
    // The type already rejects it; this checks the rule that guards untrusted input at runtime.
    // @ts-expect-error -- 'neon' is not a ThemePreference
    await expect(UserModel.create({ ...nayan, themePreference: 'neon' })).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
    await expect(UserModel.create({ ...nayan, themePreference: 'dark' })).resolves.toMatchObject({
      themePreference: 'dark',
    });
  });

  it('allows one account per Firebase ID and per email, whatever its case', async () => {
    await UserModel.create(nayan);

    for (const duplicate of [
      { firebaseUid: 'firebase-uid-1', email: 'someone@example.com' },
      { firebaseUid: 'firebase-uid-2', email: 'NAYAN@example.com' },
    ]) {
      await expect(UserModel.create(duplicate)).rejects.toMatchObject({ code: 11000 });
    }
    expect(await UserModel.countDocuments()).toBe(1);
  });
});

describe('toProfile', () => {
  it('shows the public fields only, with null for what is not set', async () => {
    const user = await UserModel.create(nayan);

    expect(toProfile(user)).toEqual({
      id: user.id,
      email: 'nayan@example.com',
      name: null,
      avatarUrl: null,
      themePreference: 'system',
    });
  });

  it('includes the name and avatar when they are set', async () => {
    const user = await UserModel.create({
      ...nayan,
      name: 'Nayan',
      avatarUrl: 'https://example.com/a.png',
    });

    expect(toProfile(user)).toMatchObject({
      name: 'Nayan',
      avatarUrl: 'https://example.com/a.png',
    });
  });
});
