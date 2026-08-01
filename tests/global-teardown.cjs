/**
 * Global teardown for Playwright tests
 * This runs once after all tests when using firebase emulators:exec
 * The emulators are automatically shut down by firebase emulators:exec
 */

async function globalTeardown() {
  console.log('🧹 Global teardown: Cleaning up...');
  // The emulators are automatically shut down by firebase emulators:exec
  // Any additional cleanup can go here
  console.log('✅ Global teardown complete');
}

module.exports = globalTeardown;