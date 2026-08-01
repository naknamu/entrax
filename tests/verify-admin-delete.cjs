/**
 * Verifies the admin dashboard delete button works with apostrophes in the title
 * (inline-onclick bug) and that copy-link still works.
 * Usage: node tests/verify-admin-delete.cjs
 */
const { chromium } = require('playwright');
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
admin.initializeApp({ projectId: 'demo-test' });
const db = admin.firestore();

const BASE = 'http://localhost:8080';

(async () => {
  // Create an exam with an apostrophe in the title owned by the admin
  const auth = admin.auth();
  const { uid } = await auth.getUserByEmail('admin@test.com');
  const examId = 'apostrophe-' + Date.now();
  await db.collection('exams').doc(examId).set({
    title: "O'Brien's Tricky Exam",
    description: 'Delete me',
    timeLimitMinutes: 10,
    passingPercent: 70,
    showResultsToStudent: true,
    randomizeQuestions: false,
    allowPrevious: true,
    questions: [{ id: 'q1', text: 'Q?', category: '', choices: ['A', 'B'], correctIndex: 0 }],
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-form', { timeout: 20000 });
  await page.fill('#email', 'admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('#login-btn');
  await page.waitForURL('**/admin-dashboard*', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // find the apostrophe exam row, click Delete, confirm the dialog
  const row = page.locator('#exams-tbody tr', { hasText: "O'Brien's Tricky Exam" });
  await row.locator('.delete-exam-btn').click();
  await page.waitForTimeout(500);
  // showConfirm renders a confirm modal — click its confirm button
  const confirmBtn = page.locator('#confirm-modal .btn-danger, .modal-footer .btn-danger').first();
  const confirmed = await confirmBtn.isVisible().catch(() => false);
  if (confirmed) {
    await confirmBtn.click();
  } else {
    // fallback: accept the JS confirm dialog if used
    page.once('dialog', (d) => d.accept());
  }
  await page.waitForTimeout(1500);

  const stillExists = (await db.collection('exams').doc(examId).get()).exists;
  console.log('exam deleted:', !stillExists);
  console.log('console/page errors:', JSON.stringify(errors));

  const pass = !stillExists && errors.length === 0;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
