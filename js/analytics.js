/**
 * Optional product analytics (Google Analytics 4).
 *
 * This is a no-op until `VITE_GA_MEASUREMENT_ID` is set, so local, test, and
 * preview builds never load a third-party script or send events. When a
 * measurement ID exists, the standard gtag.js queue is created and the remote
 * script is appended asynchronously.
 *
 * Privacy:
 *  - IP anonymization is requested.
 *  - No PII is ever sent (never email, name, or answers). Callers pass IDs and
 *    aggregate numbers only.
 *  - Do Not Track is honoured; when the browser sends DNT nothing loads.
 *
 * Usage:
 *   import { initAnalytics, track } from '/js/analytics.js';
 *   initAnalytics();                       // safe to call on every page
 *   track('exam_completed', { passed: true });
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const STORAGE_PREFIX = 'nightingale_analytics_';

let initialized = false;
let disabled = false;

function doNotTrackEnabled() {
  const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/** True when a measurement ID is configured and DNT has not opted out. */
export function analyticsEnabled() {
  return Boolean(MEASUREMENT_ID) && !disabled;
}

/**
 * Load gtag.js once. Safe to call from every page; repeated calls are ignored.
 * Never throws and never blocks startup.
 */
export function initAnalytics() {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;

  if (doNotTrackEnabled()) {
    disabled = true;
    return;
  }

  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, {
      anonymize_ip: true,
      send_page_view: true,
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  } catch (error) {
    // Analytics is optional; never let it break the app.
    console.warn('[analytics] initialization failed:', error);
    disabled = true;
  }
}

/**
 * Record an event. No-op when analytics is disabled.
 *
 * @param {string} event
 * @param {Object} [params] flat, non-PII parameters
 */
export function track(event, params = {}) {
  if (!analyticsEnabled()) return;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  } catch (error) {
    // Ignore: analytics must never break a user flow.
  }
}

/**
 * Record an event only once per browser (localStorage-backed).
 *
 * Used for funnel milestones such as `signup_completed` and
 * `first_mock_completed`, which should not be counted on every page load.
 *
 * @param {string} key stable localStorage key
 * @param {string} event
 * @param {Object} [params]
 */
export function trackOnce(key, event, params = {}) {
  if (!analyticsEnabled()) return;
  try {
    const storageKey = STORAGE_PREFIX + key;
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, '1');
  } catch (error) {
    // Private mode / storage disabled: fall through and still track.
  }
  track(event, params);
}

/** Record a virtual page view (useful for hash-routed views). */
export function trackPageView(pagePath, params = {}) {
  track('page_view', { page_path: pagePath, ...params });
}
