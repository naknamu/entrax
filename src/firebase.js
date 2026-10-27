/**
 * Firebase Configuration & Initialization
 * Single shared instance for the entire app (multi-page).
 * Reads config from Vite env vars (import.meta.env.VITE_*).
 * In development with VITE_USE_EMULATOR=true, connects to local emulators.
 * Exposes window.__FIREBASE_APP__, window.__FIREBASE_AUTH__, window.__FIREBASE_DB__
 * for Playwright test synchronization (waitForFirebase).
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initMonitoring } from '@js/monitoring.js';

// Firebase config from Vite env vars (defined in .env.development / .env.production / .env.example)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase app (singleton)
const app = initializeApp(firebaseConfig);

// Auth & Firestore instances
export const auth = getAuth(app);

// Ensure auth sessions persist across browser sessions (survive page reloads and tab closes).
// Export the promise so pages can await it before relying on onAuthStateChanged.
export const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(console.error);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to emulators in development (controlled by VITE_USE_EMULATOR env var)
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  // Auth emulator
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  
  // Firestore emulator
  connectFirestoreEmulator(db, 'localhost', 8081);

  // Functions emulator (server-side grading, Phase 0.3)
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// Sentry is a no-op unless VITE_SENTRY_DSN is configured. Never block startup.
initMonitoring().catch((error) => console.warn('Monitoring init failed:', error));

// Optional App Check (reCAPTCHA v3). Off by default: it only runs when a site
// key is configured AND we are not using the emulators (App Check has no
// emulator support here, and enabling it locally would block every request).
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
if (appCheckSiteKey && import.meta.env.VITE_USE_EMULATOR !== 'true') {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    // App Check is defense-in-depth; never let it break app startup.
    console.error('App Check initialization failed:', error);
  }
}

// Expose globals for Playwright test synchronization (waitForFirebase helper)
if (typeof window !== 'undefined') {
  window.__FIREBASE_APP__ = app;
  window.__FIREBASE_AUTH__ = auth;
  window.__FIREBASE_DB__ = db;
  window.__FIREBASE_FUNCTIONS__ = functions;
}

export default app;