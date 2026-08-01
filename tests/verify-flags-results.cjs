/**
 * Functional verification of the flag/results/lockout fixes.
 * Usage: node tests/verify-flags-results.cjs
 * Assumes emulators + dev server up and tests/seed-exam.cjs already run.
 */
const { chromium } = require('playwright');
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
admin.initializeApp({ projectId: 'demo-test' });
const db = admin.firestore();

const BASE = 'http://localhost:8080';
const EXAM_ID = 'sample-exam-layout-fix';
const email = `flagtest${Date.now()}@example.com`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));

  const results = {};

  // ---- Student flow: flag Q1 & Q4 (original indices 0 and 3), answer Q1 ----
  await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
  await page.fill('#student-name', 'Flag Test Student');
  await page.fill('#student-email', email);
  await page.click('#start-exam-btn');
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(500);

  // flag Q1 (current), answer Q1 correctly
  await page.click('#flag-question-btn');
  await page.waitForTimeout(200);
  results.flagBtnActiveQ1 = await page.evaluate(() => document.getElementById('flag-question-btn').getAttribute('aria-pressed'));
  await page.locator('#choices-grid .choice-btn[data-choice-index="1"]').first().click();
  await page.waitForTimeout(200);

  // go to Q4 (nav index 3), flag it
  await page.locator('#question-nav .nav-btn').nth(3).click();
  await page.waitForTimeout(300);
  results.flagBtnStateOnQ4Before = await page.evaluate(() => document.getElementById('flag-question-btn').getAttribute('aria-pressed'));
  await page.click('#flag-question-btn');
  await page.waitForTimeout(200);

  // single tab-switch (visibility hidden + blur) → should count exactly 1
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(400);
  await page.click('#tab-warning-ok').catch(() => {});
  await page.waitForTimeout(200);

  // submit
  await page.click('#submit-exam-btn');
  await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
  await page.check('#confirm-submit');
  await page.click('#confirm-submit-btn');
  await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(800);

  results.studentFlaggedCell = await page.textContent('#score-flagged');
  results.studentScreenVisible = await page.evaluate(() => !document.getElementById('submission-screen').hidden);

  // ---- Inspect the submission doc ----
  const subs = await db.collection('submissions').where('studentEmail', '==', email).get();
  const docs = [];
  subs.forEach((d) => docs.push({ id: d.id, ...d.data() }));
  results.submissionCount = docs.length;
  results.savedFlags = docs[0]?.flaggedQuestions ?? 'MISSING';
  results.tabSwitchCount = docs[0]?.tabSwitchCount;

  // ---- Re-attempt same email → must show already-submitted (no duplicate) ----
  await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
  await page.fill('#student-name', 'Flag Test Student');
  await page.fill('#student-email', email);
  await page.click('#start-exam-btn');
  await page.waitForTimeout(2000);
  results.reattempt = await page.evaluate(() => ({
    already: !document.getElementById('already-submitted-screen').hidden,
    exam: !document.getElementById('exam-screen').hidden,
  }));
  const subs2 = await db.collection('submissions').where('studentEmail', '==', email).get();
  results.submissionCountAfterReattempt = subs2.size;

  // ---- Draft cleanup: abandoned draft does NOT lock the student out ----
  const email2 = `draft${Date.now()}@example.com`;
  await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
  await page.fill('#student-name', 'Draft Student');
  await page.fill('#student-email', email2);
  await page.click('#start-exam-btn');
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(300);
  // abandon: reload, then re-attempt
  await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
  await page.fill('#student-name', 'Draft Student');
  await page.fill('#student-email', email2);
  await page.click('#start-exam-btn');
  await page.waitForTimeout(2000);
  results.draftReattempt = await page.evaluate(() => ({
    exam: !document.getElementById('exam-screen').hidden,
    already: !document.getElementById('already-submitted-screen').hidden,
  }));

  // ---- Admin: results page shows flags ----
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('#login-form', { timeout: 20000 });
  await adminPage.fill('#email', 'admin@test.com');
  await adminPage.fill('#password', 'password123');
  await adminPage.click('#login-btn');
  await adminPage.waitForURL('**/admin-dashboard*', { timeout: 15000 });
  await adminPage.waitForTimeout(1500);
  await adminPage.goto(`${BASE}/exam-results.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('#submissions-tbody tr', { timeout: 20000 });
  await adminPage.waitForTimeout(1000);
  // find the flagtest row and open its detail
  const row = adminPage.locator('#submissions-tbody tr', { hasText: email });
  await row.locator('button, a', { hasText: 'View' }).first().click().catch(async () => {
    await row.click();
  });
  await adminPage.waitForTimeout(800);
  results.adminDetail = await adminPage.evaluate(() => {
    const content = document.getElementById('detail-content');
    const text = content ? content.textContent : '';
    const flaggedBadges = content ? content.querySelectorAll('.answer-item.flagged').length : 0;
    const flagStat = /Flagged Questions\s+(\d+)/.exec(text);
    return {
      hasFlaggedStat: flagStat ? flagStat[1] : 'MISSING',
      flaggedAnswerItems: flaggedBadges,
      hasFlaggedBadgeText: text.includes('Flagged'),
    };
  });
  await adminPage.screenshot({ path: 'ui-exam-results-flags.png' });
  await adminCtx.close();

  results.consoleErrors = errors;
  console.log('RESULTS:', JSON.stringify(results, null, 2));

  const pass =
    results.studentScreenVisible &&
    results.studentFlaggedCell === '2' &&
    results.submissionCount === 1 &&
    Array.isArray(results.savedFlags) && results.savedFlags.includes(0) && results.savedFlags.includes(3) &&
    results.tabSwitchCount === 1 &&
    results.reattempt.already === true && results.reattempt.exam === false &&
    results.submissionCountAfterReattempt === 1 &&
    results.draftReattempt.exam === true && results.draftReattempt.already === false &&
    results.adminDetail.hasFlaggedStat === '2' &&
    results.adminDetail.flaggedAnswerItems === 2 &&
    results.adminDetail.hasFlaggedBadgeText &&
    errors.length === 0;

  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
