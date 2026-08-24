/**
 * Verify the saved exam document carries readingPassages (passage titles).
 * Creates one exam, generates reading questions, saves, checks the doc, deletes it.
 */
const { chromium } = require('playwright');
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';

const BASE = 'http://localhost:8080';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/index.html?test=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-form', { state: 'visible', timeout: 30000 });
  await page.fill('#email', 'admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL('**/admin-dashboard*', { timeout: 15000 });

  await page.goto(`${BASE}/create-exam.html?test=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exam-form', { state: 'visible', timeout: 30000 });
  await page.fill('#title', 'Passage Tracking Check');
  await page.fill('#timeLimitMinutes', '30');
  await page.fill('#passingPercent', '70');
  await page.click('#add-section-btn');
  await page.locator('.section-title-input').last().fill('READING');

  await page.click('.generate-tab[data-gen-tab="reading"]');
  await page.waitForTimeout(300);
  await page.click('#generate-add-btn');
  // Wait for generation to COMPLETE (status text set at the end of the handler)
  await page.waitForFunction(
    () => document.getElementById('generate-status')?.textContent.includes('Added 42'),
    null, { timeout: 20000 }
  );
  await page.click('#submit-btn');
  await page.waitForSelector('.alert-success', { timeout: 15000 });
  let examId = null;
  for (let i = 0; i < 10 && !examId; i++) {
    await page.waitForTimeout(500);
    examId = new URL(page.url()).searchParams.get('examId');
  }
  console.log('saved exam:', examId);

  const app = admin.initializeApp({ projectId: 'demo-test' }, 'persist-check');
  const doc = await app.firestore().collection('exams').doc(examId).get();
  const data = doc.data();
  const field = data.readingPassages || [];
  console.log('readingPassages field:', field.length, JSON.stringify(field));
  const withPassage = (data.questions || []).filter(q => q.passage).length;
  console.log('questions with passage:', withPassage);

  // Assert: field has 6 unique titles; each maps back to a question passage
  const path = require('path');
  const { pathToFileURL } = require('url');
  const { readingPassageTitleFromText, getReadingPassageTitles } = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'question-generator.js')).href);
  const allTitles = new Set(getReadingPassageTitles());
  const valid = field.every((t) => allTitles.has(t));
  const formTitles = new Set((data.questions || []).map(q => readingPassageTitleFromText(q.passage)).filter(Boolean));
  const match = formTitles.size === field.length && field.every((t) => formTitles.has(t));
  const pass = field.length === 6 && valid && match && withPassage === 42;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'} (field=${field.length}, valid=${valid}, match=${match}, withPassage=${withPassage})`);

  await app.firestore().collection('exams').doc(examId).delete().catch(() => {});
  console.log('cleaned up');
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
