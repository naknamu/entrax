/**
 * Student Authentication Module — Firebase Email-Link (Magic Link) Sign-In
 *
 * Flow:
 *  1. Student enters email → sendSignInLinkToEmail()
 *  2. Student clicks link in email → lands on student.html
 *  3. isSignInWithEmailLink() detects the link → signInWithEmailLink() completes sign-in
 *  4. Student profile is created/updated in Firestore
 */

import { auth, db, persistenceReady } from '@/firebase.js';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { createOrUpdateStudentProfile, getStudentProfile } from '@js/firestore-helpers.js';

// localStorage key for pending email
const PENDING_EMAIL_KEY = 'studentPendingEmail';

/**
 * Action-code settings for the magic link email.
 * The URL must be a valid redirect URL configured in the Firebase console
 * (Authentication → Settings → Authorized domains).
 */
function getActionCodeSettings() {
  // Use the current origin so it works in dev (localhost:8080) and production
  const origin = window.location.origin;
  const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
  return {
    url: `${origin}${basePath}student.html`,
    handleCodeInApp: true,
  };
}

/**
 * Send a magic-link sign-in email
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function sendMagicLink(email) {
  const normalized = email.trim().toLowerCase();
  localStorage.setItem(PENDING_EMAIL_KEY, normalized);
  await sendSignInLinkToEmail(auth, normalized, getActionCodeSettings());
}

/**
 * When using the Firebase Auth emulator, emails are not sent — the sign-in
 * link is available from the emulator's OOB code API. Fetch and return it
 * so the UI can display it directly.
 * @returns {Promise<string|null>} The sign-in link, or null if not in emulator mode
 */
export async function getEmulatorMagicLink() {
  if (import.meta.env.VITE_USE_EMULATOR !== 'true') return null;
  try {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-test';
    const resp = await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const codes = data.oobCodes || [];
    if (codes.length === 0) return null;
    // Get the most recent one
    const latest = codes[codes.length - 1];
    return latest.oobLink || latest.signInLink || null;
  } catch {
    return null;
  }
}

/**
 * Check if the current URL is a sign-in email link
 * @returns {boolean}
 */
export function isMagicLink() {
  return isSignInWithEmailLink(auth, window.location.href);
}

/**
 * Complete magic-link sign-in if the URL contains a sign-in link.
 * Returns the signed-in user or null.
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function completeMagicLinkSignIn() {
  if (!isMagicLink()) return null;

  let email = localStorage.getItem(PENDING_EMAIL_KEY);
  if (!email) {
    // Prompt user for email if not stored (e.g. different browser)
    email = window.prompt('Please confirm your email to complete sign-in:');
    if (!email) return null;
    email = email.trim().toLowerCase();
  }

  const credential = await signInWithEmailLink(auth, email, window.location.href);
  localStorage.removeItem(PENDING_EMAIL_KEY);

  // Clean the URL to remove the sign-in link params
  window.history.replaceState({}, document.title, window.location.pathname);

  // Create / update student profile
  const user = credential.user;
  await createOrUpdateStudentProfile(db, user.uid, {
    email: user.email,
    displayName: user.displayName || email.split('@')[0],
  });

  return user;
}

/**
 * Subscribe to auth state changes. Calls `callback(user)` immediately
 * and on every state change. Returns the unsubscribe function.
 * @param {Function} callback - (user | null) => void
 * @returns {Promise<Function>} unsubscribe (resolves after auth state is restored)
 */
export async function onStudentAuthStateChanged(callback) {
  // Wait until Firebase has finished restoring the persisted session before
  // subscribing. Otherwise the first callback can be `null` even though a
  // magic-link student is signed in, which makes the portal show the
  // sign-in/sign-up view and can overwrite the session with an anonymous one.
  await persistenceReady;
  await auth.authStateReady();
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign the student out
 * @returns {Promise<void>}
 */
export async function studentSignOut() {
  await signOut(auth);
}

/**
 * Update the student's display name (in Firebase Auth + Firestore profile)
 * @param {string} displayName
 * @returns {Promise<void>}
 */
export async function updateStudentDisplayName(displayName) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  await updateProfile(user, { displayName });
  await createOrUpdateStudentProfile(db, user.uid, { displayName });
}

/**
 * Get the current student's profile from Firestore
 * @returns {Promise<Object|null>}
 */
export async function getCurrentStudentProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  return getStudentProfile(db, user.uid);
}

/**
 * Get the current authenticated user (or null)
 * @returns {import('firebase/auth').User|null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}