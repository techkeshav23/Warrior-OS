// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Auth Utilities
// Firebase Authentication wrapper functions.
// Optional: only live when the NEXT_PUBLIC_FIREBASE_* web config is in
// the bundle (isFirebaseConfigured). The Firebase SDK is imported lazily
// inside each helper, so importing this module costs nothing and makes
// no network calls — without config nothing below ever runs.
// ═══════════════════════════════════════════════════════════

import type { User, Unsubscribe } from 'firebase/auth';

/**
 * True when the public Firebase web config needed for sign-in is present.
 * Each variable is read literally so Next.js inlines it at build time.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}

type AuthModules = { auth: typeof import('./firebase').auth; sdk: typeof import('firebase/auth') };
let authModules: Promise<AuthModules> | null = null;

/**
 * Firebase auth instance + SDK functions, loaded once on first use. AuthSync
 * loads them at desktop start, so by the time a Google button is clicked the
 * promise is settled and the pop-up still opens inside the click's activation.
 */
function loadAuth(): Promise<AuthModules> {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('Firebase is not configured for this deployment.'));
  authModules ??= Promise.all([import('./firebase'), import('firebase/auth')]).then(([{ auth }, sdk]) => ({ auth, sdk }));
  // A failed chunk load may be retried on the next call.
  authModules.catch(() => {
    authModules = null;
  });
  return authModules;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { auth, sdk } = await loadAuth();
  const result = await sdk.signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Create new account with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const { auth, sdk } = await loadAuth();
  const result = await sdk.createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await sdk.updateProfile(result.user, { displayName });
  return result.user;
}

/**
 * Sign in with Google popup
 */
export async function signInWithGoogle(): Promise<User> {
  const { auth, sdk } = await loadAuth();
  const result = await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
  return result.user;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const { auth, sdk } = await loadAuth();
  await sdk.signOut(auth);
}

/**
 * Listen for auth state changes. Returns an unsubscribe that is safe to
 * call before the SDK has finished loading. Without config (or if the SDK
 * fails to load) the callback fires once with null.
 */
export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  let unsubscribe: Unsubscribe | null = null;
  let cancelled = false;
  loadAuth().then(
    ({ auth, sdk }) => {
      if (!cancelled) unsubscribe = sdk.onAuthStateChanged(auth, callback);
    },
    () => {
      if (!cancelled) callback(null);
    }
  );
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** Readable message for a failed sign-in / sign-up (Firebase error codes). */
export function describeAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No connection to the sign-in service.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed.';
    case 'auth/popup-blocked':
      return 'The browser blocked the sign-in window. Allow pop-ups and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in in the Firebase project.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in the Firebase project.';
    default:
      return 'Sign-in failed. Try again.';
  }
}
