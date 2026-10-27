#!/usr/bin/env node
'use strict';

/**
 * Toggle the server-side grading feature flag.
 *
 * Usage:
 *   node scripts/set-feature-flag.cjs serverGrading on
 *   node scripts/set-feature-flag.cjs serverGrading off
 *   node scripts/set-feature-flag.cjs serverGrading on --prod
 *   node scripts/set-feature-flag.cjs serverGrading on --emulator
 *
 * Defaults to the local Firestore emulator (localhost:8081, project demo-test)
 * so a forgotten flag can never touch production.
 *
 * Turning serverGrading ON requires the submitAttempt callable to be deployed
 * and the site to support it. Turning it OFF requires inline correctIndex on
 * every exam question: run `node scripts/migrate-exam-keys.cjs --restore`.
 */

const admin = require('firebase-admin');

const USAGE = `Set the server-side grading feature flag.

Usage:
  node scripts/set-feature-flag.cjs serverGrading on|off [--prod|--emulator]

Arguments:
  serverGrading   Feature name (written to config/features).
  on|off          Enable or disable the feature.

Options:
  --prod      Use production (Application Default Credentials).
  --emulator  Use the local Firestore emulator (default: localhost:8081,
              project demo-test).
  --help, -h  Show this help.

Warnings:
  on   Requires the submitAttempt Cloud Function to be deployed and the site
       to call it on submit. Older clients will fail to submit.
  off  Requires correctIndex on every exam question. Run
       node scripts/migrate-exam-keys.cjs --restore first.
`;

const KNOWN_FLAGS = new Set(['--help', '-h', '--prod', '--emulator']);

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith('--') && arg !== '-h');
  return {
    help: args.includes('--help') || args.includes('-h'),
    prod: args.includes('--prod'),
    emulator: args.includes('--emulator'),
    name: positional[0],
    value: positional[1],
    unknown: args.filter((arg) => arg.startsWith('--') && !KNOWN_FLAGS.has(arg)),
  };
}

function initDb(prod) {
  if (prod) {
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    return { db: app.firestore(), label: 'production (Application Default Credentials)' };
  }

  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  const app = admin.initializeApp({ projectId: 'demo-test' });
  return { db: app.firestore(), label: 'emulator (localhost:8081, project demo-test)' };
}

function formatValue(value) {
  if (value === undefined) return 'unset';
  return JSON.stringify(value);
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  if (options.unknown.length > 0) {
    console.error(`Unknown option(s): ${options.unknown.join(', ')}`);
    console.error('');
    console.error(USAGE);
    return 1;
  }

  if (options.prod && options.emulator) {
    console.error('Choose one of --prod or --emulator, not both.');
    return 1;
  }

  if (!options.name || !options.value) {
    console.error(USAGE);
    return 1;
  }

  if (options.name !== 'serverGrading') {
    console.error(`Unsupported feature: ${options.name}. Only serverGrading is supported.`);
    console.error('');
    console.error(USAGE);
    return 1;
  }

  if (options.value !== 'on' && options.value !== 'off') {
    console.error(`Expected "on" or "off", got "${options.value}".`);
    console.error('');
    console.error(USAGE);
    return 1;
  }

  const enabled = options.value === 'on';
  const { db, label } = initDb(options.prod);
  const ref = db.doc('config/features');

  const previousSnap = await ref.get();
  const previous = previousSnap.exists ? previousSnap.data()[options.name] : undefined;

  await ref.set(
    {
      [options.name]: enabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Target:   ${label}`);
  console.log(`Document: config/features`);
  console.log(`Previous: ${options.name} = ${formatValue(previous)}`);
  console.log(`New:      ${options.name} = ${formatValue(enabled)}`);

  if (enabled) {
    console.warn('');
    console.warn('WARNING: serverGrading is now ON.');
    console.warn('  - The submitAttempt Cloud Function must be deployed.');
    console.warn('  - The site must call submitAttempt on submit; older clients will fail.');
    console.warn('  - Correct answers must exist in examKeys (run migrate-exam-keys.cjs).');
  } else {
    console.warn('');
    console.warn('WARNING: serverGrading is now OFF.');
    console.warn('  - Client grading needs correctIndex on every exam question.');
    console.warn('  - Run: node scripts/migrate-exam-keys.cjs --restore' +
      (options.prod ? ' --prod' : ''));
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Failed to update feature flag:', error.message || error);
    process.exit(1);
  });
