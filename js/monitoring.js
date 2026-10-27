/**
 * Optional Sentry error monitoring (Phase 0.6).
 *
 * This is a no-op until `VITE_SENTRY_DSN` is set. There is deliberately no
 * static `@sentry/browser` import: the SDK is only pulled in by a dynamic
 * import once a DSN exists, so it lands in its own lazily-loaded chunk and the
 * initial bundle is unchanged when monitoring is off.
 *
 * Note: `@sentry/browser` must still be a declared dependency for the build to
 * resolve the dynamic import, even when no environment sets a DSN.
 *
 * PII: `sendDefaultPii: false`, and the user is attached by uid only (no
 * email, no IP-derived identity). Never pass submission answers or student
 * PII in `context`.
 *
 * Usage:
 *   import { initMonitoring } from '/js/monitoring.js';
 *   initMonitoring().catch(() => {});   // never awaited on the critical path
 *   captureException(error, { tags: { area: 'exam' } });
 */

/** @type {any|null} Resolved @sentry/browser namespace once initialized. */
let sentry = null;

/**
 * Initialize Sentry when a DSN is configured. Safe to call on every page load;
 * repeated calls after a successful init are ignored.
 *
 * @returns {Promise<any|null>} The Sentry module, or null when disabled/failed.
 */
export async function initMonitoring() {
  if (sentry) return sentry;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Monitoring disabled (no DSN in this environment).
    return null;
  }

  try {
    const mod = await import('@sentry/browser');
    const Sentry = mod.default ?? mod;

    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });

    sentry = Sentry;
    return sentry;
  } catch (error) {
    // Monitoring is defense-in-depth; never let it break startup.
    console.warn('[monitoring] Sentry initialization failed:', error);
    return null;
  }
}

/**
 * Report an exception. No-op until initMonitoring() has succeeded.
 *
 * @param {unknown} error
 * @param {Object} [context] Sentry capture context (tags, extra, level, ...).
 * @returns {string|null} Sentry event id, or null when monitoring is off.
 */
export function captureException(error, context) {
  if (!sentry) return null;
  try {
    return sentry.captureException(error, context) ?? null;
  } catch (captureError) {
    console.warn('[monitoring] captureException failed:', captureError);
    return null;
  }
}

/**
 * Attach (or clear) the signed-in user. uid only — never email or name.
 *
 * @param {{ uid?: string }|null} user
 */
export function setMonitoringUser(user) {
  if (!sentry) return;
  try {
    sentry.setUser(user?.uid ? { id: user.uid } : null);
  } catch (error) {
    console.warn('[monitoring] setUser failed:', error);
  }
}
