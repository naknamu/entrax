#!/usr/bin/env node
/**
 * CI test runner.
 *
 * The server-grading spec toggles the global `config/features.serverGrading`
 * switch, so it must not overlap the rest of the suite. Run the main suite
 * with that file excluded, then run it alone with one worker.
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
