/**
 * Google sign-in in the browser, through Firebase. These values are public by design: Firebase
 * web config is meant to ship to the browser. The SDK is loaded only when someone clicks the
 * Google button, so it costs nothing on other pages.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** False until all four NEXT_PUBLIC_FIREBASE_* settings are filled in. */
export const googleSignInConfigured = Object.values(config).every(
  (value) => typeof value === 'string' && value.length > 0,
);

/**
 * Opens Google's sign-in popup and returns the Firebase ID token for the server to check. The
 * browser's Firebase session is ended right away: the app's own session cookie is what counts.
 */
export async function signInWithGooglePopup(): Promise<string> {
  const [{ getApps, initializeApp }, { GoogleAuthProvider, getAuth, signInWithPopup, signOut }] =
    await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  const idToken = await result.user.getIdToken();
  await signOut(auth);
  return idToken;
}
