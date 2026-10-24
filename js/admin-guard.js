/**
 * Admin page guard (UX only — Firestore rules are the real enforcement).
 *
 * Admin pages call ensureAdmin() before loading any data. It waits for the
 * persisted auth session to be restored, force-refreshes the ID token (so a
 * freshly granted `role: admin` claim is visible), and redirects anyone who is
 * not an admin away from the page.
 */

import { auth, persistenceReady } from '/src/firebase.js';

const ADMIN_CLAIM = 'admin';

function hideDocument() {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.visibility = 'hidden';
  }
}

function redirectTo(target) {
  // replace() keeps the protected URL out of the back-button history.
  if (typeof window !== 'undefined') window.location.replace(target);
}

/**
 * Resolve the current user only if they hold the admin claim.
 *
 * @param {Object} [options]
 * @param {string} [options.redirectTo='student.html'] where non-admins go
 * @param {string} [options.signedOutRedirect='index.html'] where signed-out visitors go
 * @returns {Promise<import('firebase/auth').User|null>} the admin user, or null
 *   when the caller is being redirected.
 */
export async function ensureAdmin(options = {}) {
  const {
    redirectTo: nonAdminRedirect = 'student.html',
    signedOutRedirect = 'index.html',
  } = options;

  await persistenceReady;
  // Without this, the first auth callback can be null while the persisted
  // session is still being restored, and we would bounce a real admin.
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) {
    hideDocument();
    redirectTo(signedOutRedirect);
    return null;
  }

  try {
    // Force refresh so a claim granted after the session was created is seen.
    const tokenResult = await user.getIdTokenResult(true);
    if (tokenResult?.claims?.role !== ADMIN_CLAIM) {
      hideDocument();
      redirectTo(nonAdminRedirect);
      return null;
    }
  } catch (error) {
    console.error('Admin guard: could not verify admin claim:', error);
    hideDocument();
    redirectTo(nonAdminRedirect);
    return null;
  }

  return user;
}

/**
 * Last-resort handler for a rejected guard promise (e.g. persistence/auth
 * initialization failed): never leave protected content visible. Use as
 * `.catch(failClosed)`.
 */
export function failClosed(error, target = 'index.html') {
  console.error('Admin guard: unexpected failure:', error);
  hideDocument();
  redirectTo(target);
}

export default ensureAdmin;
