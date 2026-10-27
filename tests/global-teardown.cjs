/**
 * Global teardown for Playwright tests
 * This runs once after all tests when using firebase emulators:exec
 * The emulators are automatically shut down by firebase emulators:exec
 */

async function globalTeardown() {
  console.log('🧹 Global teardown: Cleaning up...');
  // The emulators are automatically shut down by firebase emulators:exec
  // Any additional cleanup can go here
  try {
    const admin = require('firebase-admin');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: 'demo-test' });
    // Leave the emulator in the default (client-graded) mode.
    await app.firestore().doc('config/features').delete();
  } catch (error) {
    console.warn('Could not reset config/features:', error.message);
  }
  console.log('✅ Global teardown complete');
}

module.exports = globalTeardown;