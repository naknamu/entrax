#!/usr/bin/env node
/**
 * Grant or revoke the admin custom claim for a Firebase Auth user.
 *
 * Usage:
 *   node scripts/set-admin-claim.cjs <email>                 # local emulator
 *   node scripts/set-admin-claim.cjs <email> --emulator      # explicit emulator
 *   node scripts/set-admin-claim.cjs <email> --prod          # production
 *   node scripts/set-admin-claim.cjs <email> --revoke        # combine with either
 *
 * Defaults to the local Auth emulator (project demo-test, localhost:9099) so a
 * forgotten flag can never touch production data. Production requires --prod
 * and Application Default Credentials:
 *   gcloud auth application-default login
 *   # or GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * After granting/revoking, the affected user must refresh their ID token
 * (the admin pages force-refresh on load, so a normal reload is enough).
 */

const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = argv.slice(2);
  const email = args.find((arg) => !arg.startsWith('--'));
  return {
    email,
    revoke: args.includes('--revoke'),
    emulator: args.includes('--emulator'),
    prod: args.includes('--prod'),
  };
}

async function main() {
  const { email, revoke, emulator, prod } = parseArgs(process.argv);

  if (!email) {
    console.error('Usage: node scripts/set-admin-claim.cjs <email> [--emulator|--prod] [--revoke]');
    process.exit(1);
  }
  if (emulator && prod) {
    console.error('Choose one of --emulator or --prod, not both.');
    process.exit(1);
  }

  let app;
  if (prod) {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    console.log('Using production credentials (Application Default Credentials)');
  } else {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    app = admin.initializeApp({ projectId: 'demo-test' });
    console.log('Using Auth emulator at localhost:9099 (project demo-test)');
  }

  const auth = app.auth();
  const user = await auth.getUserByEmail(email);

  let claims;
  if (revoke) {
    // Remove only the admin role; preserve any other custom claims.
    claims = { ...(user.customClaims || {}) };
    delete claims.role;
    if (Object.keys(claims).length === 0) claims = null;
  } else {
    claims = { role: 'admin' };
  }

  await auth.setCustomUserClaims(user.uid, claims);

  // Read back so the output reflects what was actually stored.
  const updated = await auth.getUser(user.uid);
  console.log(`User:   ${email}`);
  console.log(`UID:    ${updated.uid}`);
  console.log(`Claims: ${JSON.stringify(updated.customClaims || {})}`);
  console.log(revoke ? 'Admin role revoked.' : 'Admin role granted.');
  console.log('The user must refresh their session (reload) for the change to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to update admin claim:', error.message || error);
    process.exit(1);
  });
