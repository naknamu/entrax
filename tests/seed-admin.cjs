/**
 * Seeds an admin user + an admin-owned exam into the emulators.
 * Run after `npm run emulators`. Usage: node tests/seed-admin.cjs
 */
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'demo-test' });
const auth = admin.auth();
const db = admin.firestore();

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'password123';

(async () => {
  let uid;
  try {
    const user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Test Admin',
      emailVerified: true
    });
    uid = user.uid;
    console.log('Admin user created:', ADMIN_EMAIL, uid);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(ADMIN_EMAIL);
      uid = u.uid;
      console.log('Admin user exists:', ADMIN_EMAIL, uid);
    } else {
      throw e;
    }
  }

  const examId = 'sample-exam-admin-owned';
  await db.collection('exams').doc(examId).set({
    title: 'Admin Owned Exam',
    description: 'Seeded for admin dashboard testing',
    timeLimitMinutes: 30,
    passingPercent: 70,
    showResultsToStudent: true,
    randomizeQuestions: false,
    allowPrevious: true,
    questions: [
      { id: 'q1', text: 'What is 2 + 2?', category: 'Math', choices: ['3', '4', '5', '6'], correctIndex: 1 },
      { id: 'q2', text: 'What is the capital of France?', category: 'Geography', choices: ['London', 'Berlin', 'Paris', 'Madrid'], correctIndex: 2 },
      { id: 'q3', text: 'Which planet is known as the Red Planet?', category: 'Science', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 }
    ],
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('Admin-owned exam created:', examId);

  process.exit(0);
})().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
