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

export function toProfile(user: UserDocument): Profile {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
    themePreference: user.themePreference,
  };
}
