#!/usr/bin/env node
/**
 * CI test runner.
 *
 * Two specs flip a global Firestore switch, so neither may overlap the rest of
 * the suite: the server-grading spec toggles `config/features.serverGrading`,
 * and the free-tier spec toggles `config/freeTier` (which locks every exam
 * outside its list). Run the main suite with both excluded, then each one
 * alone with a single worker.
 *
 * Invoked by `npm run test:ci` inside `firebase emulators:exec`.
 */

const { execSync } = require('node:child_process');

const run = (command) => {
  console.log(`\n$ ${command}\n`);
  execSync(command, { stdio: 'inherit' });
};

run('npx playwright test');
run('npx playwright test --config=playwright.server-grading.config.cjs');
run('npx playwright test --config=playwright.free-tier.config.cjs');
