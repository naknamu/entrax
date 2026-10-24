#!/usr/bin/env node
/**
 * Backfill exam `status` for legacy documents.
 *
 * Exams created before the draft/published model have no `status` field. The
 * student portal now only lists exams with status == 'published' (enforced by
 * Firestore rules), so those legacy exams disappear until they are marked.
 *
 * This marks every exam that HAS questions and NO status as 'published'.
 * Exams without questions are left alone (they are effectively drafts).
 *
 * Usage:
 *   node scripts/backfill-exam-status.cjs             # local emulator (demo-test)
 *   node scripts/backfill-exam-status.cjs --prod      # production (ADC)
 *   node scripts/backfill-exam-status.cjs --emulator  # explicit emulator
 *
 * Production requires Application Default Credentials and
 * GOOGLE_CLOUD_PROJECT (or a service account's project).
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const useProd = args.includes('--prod');

if (useProd && args.includes('--emulator')) {
  console.error('Choose one of --prod or --emulator, not both.');
  process.exit(1);
}

async function main() {
  let app;
  if (useProd) {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    console.log('Backfilling production exams (Application Default Credentials)');
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
    app = admin.initializeApp({ projectId: 'demo-test' });
    console.log('Backfilling emulator exams (localhost:8081, project demo-test)');
  }

  const db = app.firestore();
  const snapshot = await db.collection('exams').get();

  let updated = 0;
  let skipped = 0;
  let noQuestions = 0;

  for (const doc of snapshot.docs) {
    const exam = doc.data() || {};
    if (exam.status) {
      skipped++;
      continue;
    }
    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
      noQuestions++;
      continue;
    }

    await doc.ref.update({
      status: 'published',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    updated++;
    console.log(`  ✓ published: ${doc.id} (${exam.title || 'untitled'})`);
  }

  console.log('');
  console.log(`Exams scanned:        ${snapshot.size}`);
  console.log(`Marked published:     ${updated}`);
  console.log(`Already had status:   ${skipped}`);
  console.log(`No questions (skipped): ${noQuestions}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error.message || error);
    process.exit(1);
  });
