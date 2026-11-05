/**
 * Isolated Playwright config for the free-tier spec.
 *
 * That spec turns the global `config/freeTier` gate on and off, which locks
 * every other exam in the database while it runs. It therefore cannot share a
 * worker (or a run) with the rest of the suite — same reason as
 * `playwright.server-grading.config.cjs`.
 *
 *   npm run test:free-tier
 */

import baseConfig from './playwright.config.cjs';

export default {
  ...baseConfig,
  testMatch: '**/free-tier.spec.js',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
};
