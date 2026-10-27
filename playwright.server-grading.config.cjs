/**
 * Isolated Playwright config for the Phase 0.3 server-grading spec.
 *
 * That spec enables the global `config/features.serverGrading` switch, so it
 * must run alone with a single worker. Requires the Functions emulator on
 * :5001 (`npm run emulators`).
 *
 *   npm run test:server-grading
 */

import baseConfig from './playwright.config.cjs';

export default {
  ...baseConfig,
  testMatch: '**/server-grading.spec.js',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
};
