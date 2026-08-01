/**
 * Firebase Configuration & Initialization
 * Single shared instance for the entire app (multi-page).
 * Reads config from Vite env vars (import.meta.env.VITE_*).
 * In development with VITE_USE_EMULATOR=true, connects to local emulators.
 * Exposes window.__FIREBASE_APP__, window.__FIREBASE_AUTH__, window.__FIREBASE_DB__
 * for Playwright test synchronization (waitForFirebase).
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

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
export const db = getFirestore(app);

// Connect to emulators in development (controlled by VITE_USE_EMULATOR env var)
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  // Auth emulator
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  
  // Firestore emulator
  connectFirestoreEmulator(db, 'localhost', 8081);
}

// Expose globals for Playwright test synchronization (waitForFirebase helper)
if (typeof window !== 'undefined') {
  window.__FIREBASE_APP__ = app;
  window.__FIREBASE_AUTH__ = auth;
  window.__FIREBASE_DB__ = db;
}

export default app;