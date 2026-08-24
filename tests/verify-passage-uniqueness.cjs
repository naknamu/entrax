/**
 * E2E: reading passages must be unique across generated exams.
 * Usage: node tests/verify-passage-uniqueness.cjs
 * Requires: emulators + dev server running, admin@test.com seeded.
 *
 * Exam A: generate reading (42q / 6 passages) -> save
 * Exam B: generate reading (28q / 4 remaining + warning) -> generate again
 *         (error, pool exhausted by form) -> save
 * Exam C: generate reading -> error (pool empty), nothing added
 * Asserts: A ∩ B = ∅, A ∪ B = all 10 passages, saved docs carry readingPassages.
 * CLEANS UP: deletes the 3 verification exams so the pool is restored.
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8080';
const ADMIN = { email: 'admin@test.com', password: 'password123' };
const createdExamIds = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  // ---- Sign in as admin ----
  await page.goto(`${BASE}/index.html?test=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-form', { state: 'visible', timeout: 30000 });
  await page.fill('#email', ADMIN.email);
  await page.fill('#password', ADMIN.password);
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL('**/admin-dashboard*', { timeout: 15000 });
  console.log('signed in as admin');

  async function createExam(title) {
    await page.goto(`${BASE}/create-exam.html?test=true`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#exam-form', { state: 'visible', timeout: 30000 });
    await page.fill('#title', title);
    await page.fill('#timeLimitMinutes', '30');
    await page.fill('#passingPercent', '70');
    // Add a READING section so generated questions are assigned to it
    await page.click('#add-section-btn');
    const sectionTitle = page.locator('.section-title-input').last();
    await sectionTitle.fill('READING');
    return page;
  }

  async function generateReading() {
    await page.click('.generate-tab[data-gen-tab="reading"]');
    await page.waitForTimeout(300);
    await page.click('#generate-add-btn');
    await page.waitForTimeout(600);
    const status = (await page.locator('#generate-status').textContent().catch(() => '')).trim();
    const alertText = (await page.locator('#alert-container').textContent().catch(() => '')).trim();
    return { status, alertText };
  }

  async function passagesInForm() {
    return await page.evaluate(async () => {
      const { readingPassageTitleFromText } = await import('/js/question-generator.js');
      const titles = new Set();
      document.querySelectorAll('textarea[name$="[passage]"]').forEach((ta) => {
        const t = readingPassageTitleFromText((ta.value || '').trim());
        if (t) titles.add(t);
      });
      return [...titles];
    });
  }

  async function saveAndGetId() {
    await page.click('#submit-btn');
    await page.waitForSelector('.alert-success', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const url = page.url();
    const id = new URL(url).searchParams.get('examId');
    if (id) createdExamIds.push(id);
    return id;
  }

  // ---- Exam A: 6 passages, 42 questions ----
  await createExam('Uniqueness Check A');
  const genA = await generateReading();
  console.log('EXAM A generate:', genA.status, '| alert:', genA.alertText || '(none)');
  const titlesA = await passagesInForm();
  console.log('EXAM A passages:', titlesA.length, titlesA);
  const idA = await saveAndGetId();
  console.log('EXAM A saved:', idA);

  // ---- Exam B: 4 remaining, 28 questions + warning; 2nd click errors ----
  await createExam('Uniqueness Check B');
  const genB = await generateReading();
  console.log('EXAM B generate:', genB.status, '| alert:', genB.alertText || '(none)');
  const titlesB = await passagesInForm();
  console.log('EXAM B passages:', titlesB.length, titlesB);
  const countAfterB = await page.locator('.question-block').count();
  // Second generate click in the same form: pool exhausted by form passages
  await page.click('#generate-add-btn');
  await page.waitForTimeout(600);
  const errText = (await page.locator('#alert-container').textContent().catch(() => '')).trim();
  const countAfter2nd = await page.locator('.question-block').count();
  console.log('EXAM B 2nd click alert:', errText || '(none)', '| blocks:', countAfterB, '->', countAfter2nd);
  const idB = await saveAndGetId();
  console.log('EXAM B saved:', idB);

  // ---- Exam C: pool exhausted ----
  await createExam('Uniqueness Check C');
  const genC = await generateReading();
  console.log('EXAM C generate:', genC.status, '| alert:', genC.alertText || '(none)');
  const countC = await page.locator('.question-block').count();
  console.log('EXAM C blocks (default empty question only):', countC);

  // ---- Assertions ----
  const overlap = titlesA.filter((t) => titlesB.includes(t));
  const union = [...new Set([...titlesA, ...titlesB])];
  console.log('\n=== ASSERTIONS ===');
  console.log('A ∩ B overlap:', overlap.length, overlap);
  console.log('A ∪ B size:', union.length, '(10 expected)');
  console.log('A = 6 passages:', titlesA.length === 6);
  console.log('B = 4 passages:', titlesB.length === 4);
  console.log('A count 42:', genA.status.includes('Added 42'));
  console.log('B count 28:', genB.status.includes('Added 28'));
  console.log('B warning shown:', genB.alertText.includes('unused reading passage'));
  console.log('B 2nd click blocked:', errText.includes('already been used') && countAfter2nd === countAfterB);
  console.log('C blocked:', genC.alertText.includes('already been used') && countC === 1);

  const pass =
    overlap.length === 0 &&
    union.length === 10 &&
    titlesA.length === 6 &&
    titlesB.length === 4 &&
    genA.status.includes('Added 42') &&
    genB.status.includes('Added 28') &&
    genB.alertText.includes('unused reading passage') &&
    errText.includes('already been used') &&
    countAfter2nd === countAfterB &&
    genC.alertText.includes('already been used') &&
    countC === 1 &&
    idA && idB;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // Clean up: delete verification exams so the passage pool is restored
  await browser.close();
  const admin = require('firebase-admin');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  const app = admin.initializeApp({ projectId: 'demo-test' }, 'uniq-cleanup');
  for (const id of createdExamIds) {
    await app.firestore().collection('exams').doc(id).delete().catch(() => {});
    console.log('cleaned up exam', id);
  }
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
