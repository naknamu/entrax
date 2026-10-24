/**
 * Local-dev helper: make one mock exam show "Start Exam" in the student portal
 * by removing the seeded student's submissions for that exam.
 *
 * Usage (emulators must be running): node scripts/dev-reset-exam.cjs [examId]
 */
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_ID = 'demo-test';
const EXAM_ID = process.argv[2] || 'mock-history-world';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('submissions').where('examId', '==', EXAM_ID).get();
  if (snap.empty) {
    console.log(`No submissions for ${EXAM_ID}`);
  } else {
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted ${snap.size} submission(s) for ${EXAM_ID}`);
  }
  console.log(`\n${EXAM_ID} now shows "Start Exam" in the portal exam list.`);
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
