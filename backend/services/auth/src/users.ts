import { type HydratedDocument, type InferSchemaType, mongoose } from '@gilder/shared';

/** The theme a user picked. 'system' follows the device's light or dark setting. */
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * The `users` collection, in the auth service's own database. Other services never read it;
 * they get a user from auth over HTTP.
 */
const userSchema = new mongoose.Schema(
  {
    /** The user's ID from Firebase, which says whose Google account this is. */
    firebaseUid: { type: String, required: true, unique: true },
    /** Stored in lowercase, so the same address can't sign up twice with different case. */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    name: { type: String, trim: true, maxlength: 100 },
    avatarUrl: { type: String, trim: true, maxlength: 2048 },
    themePreference: { type: String, enum: THEME_PREFERENCES, default: 'system', required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = mongoose.model('User', userSchema);

/** What the API shows of a user. The Firebase ID stays inside auth. */
export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  themePreference: ThemePreference;
}

/** A user found or made at sign-in. `created` is true for a first sign-in. */
export interface SignedInUser {
  user: UserDocument;
  created: boolean;
}

/** Fields Google gives, as the users model stores them. */
export interface GoogleProfileFields {
  firebaseUid: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

// Dev sign-in users get this prefix instead of a Firebase ID. Firebase IDs never contain ':'.
const DEV_UID_PREFIX = 'dev:';

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

/**
 * Finds the user for a Google sign-in, or makes one. The same Firebase ID is the same user, and
 * its name, avatar and email are refreshed. A verified email already on file under another ID
 * (the Firebase account was recreated, or a local dev sign-in used it) is the same person too, so
 * that account gets the new ID. Two first sign-ins at once can't make two users: the unique
 * index stops the second, which then finds the first.
 */
export async function upsertGoogleUser(fields: GoogleProfileFields): Promise<SignedInUser> {
  const { firebaseUid, email, name, avatarUrl } = fields;
  const refresh = { email, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) };

  const byUid = await UserModel.findOneAndUpdate(
    { firebaseUid },
    { $set: refresh },
    { new: true, runValidators: true },
  );
  if (byUid) {
    return { user: byUid, created: false };
  }
  const byEmail = await UserModel.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { firebaseUid, ...refresh } },
    { new: true, runValidators: true },
  );
  if (byEmail) {
    return { user: byEmail, created: false };
  }
  try {
    return { user: await UserModel.create({ firebaseUid, ...refresh }), created: true };
  } catch (error) {
    const raced = isDuplicateKey(error) ? await UserModel.findOne({ firebaseUid }) : null;
    if (raced) {
      return { user: raced, created: false };
    }
    throw error;
  }
}

/** Finds the user with this email for dev sign-in, or makes one. */
export async function findOrCreateDevUser(email: string, name?: string): Promise<SignedInUser> {
  const normalized = email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: normalized });
  if (existing) {
    return { user: existing, created: false };
  }
  try {
    const user = await UserModel.create({
      firebaseUid: `${DEV_UID_PREFIX}${normalized}`,
      email: normalized,
      ...(name ? { name } : {}),
    });
    return { user, created: true };
  } catch (error) {
    const raced = isDuplicateKey(error) ? await UserModel.findOne({ email: normalized }) : null;
    if (raced) {
      return { user: raced, created: false };
    }
    throw error;
  }
}

export function toProfile(user: UserDocument): Profile {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
    themePreference: user.themePreference,
  };
}
