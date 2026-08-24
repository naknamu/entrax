/**
 * E2E: reading passages must be unique across generated exams — the fixed
 * bank is used first, then procedural generation fills in with unique
 * passages (generation never blocks and no passage or story repeats).
 * Usage: node tests/verify-passage-uniqueness.cjs
 * Requires: emulators + dev server running, admin@test.com seeded.
 *
 * Exam A: generate reading (42q / 6 fixed passages) -> save
 * Exam B: generate reading (42q / 4 fixed + 2 procedural) -> save
 * Exam C: generate reading (42q / 6 procedural) -> save
 * Asserts: A ∩ B ∩ C = ∅ for passage texts AND titles; procedural passages
 * have 4 paragraphs; each saved exam carries its readingPassages titles.
 * CLEANS UP: deletes the verification exams so the pool is restored.
 */
const { chromium } = require('playwright');
const admin = require('firebase-admin');

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
    await expandAccordion('sections');
    await page.click('#add-section-btn');
    await page.locator('.section-title-input').last().fill('READING');
  }

  /** Open a create-exam accordion section by name if it is collapsed. */
  async function expandAccordion(name) {
    const open = await page.evaluate((n) => {
      const s = document.querySelector(`.accordion-section:has(.accordion-toggle[data-accordion="${n}"])`);
      return s ? s.classList.contains('open') : true;
    }, name);
    if (!open) {
      await page.locator(`.accordion-toggle[data-accordion="${name}"]`).click();
      await page.waitForTimeout(350);
    }
  }

  async function generateReading() {
    await expandAccordion('generate');
    await page.click('.generate-tab[data-gen-tab="reading"]');
    await page.waitForTimeout(300);
    await page.click('#generate-add-btn');
    // Wait until generation completes (status text is set at the end)
    await page.waitForFunction(
      () => document.getElementById('generate-status')?.textContent.includes('Added 42'),
      null, { timeout: 20000 }
    );
    const status = (await page.locator('#generate-status').textContent()).trim();
    const alertText = (await page.locator('#alert-container').textContent().catch(() => '')).trim();
    return { status, alertText };
  }

  async function saveAndGetId() {
    await page.click('#submit-btn');
    await page.waitForSelector('.alert-success', { timeout: 15000 });
    let id = null;
    for (let i = 0; i < 10 && !id; i++) {
      await page.waitForTimeout(500);
      id = new URL(page.url()).searchParams.get('examId');
    }
    if (id) createdExamIds.push(id);
    return id;
  }

  // ---- Exam A (6 fixed), Exam B (4 fixed + 2 procedural), Exam C (6 procedural) ----
  const results = [];
  for (const title of ['Uniqueness A', 'Uniqueness B', 'Uniqueness C']) {
    await createExam(title);
    const gen = await generateReading();
    const id = await saveAndGetId();
    console.log(`${title}: saved ${id} | status: ${gen.status} | alert: ${gen.alertText || '(none)'}`);
    results.push({ title, id, status: gen.status, alertText: gen.alertText });
  }

  await browser.close();

  // ---- Verify saved exams via admin SDK ----
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  const app = admin.initializeApp({ projectId: 'demo-test' }, 'uniq-check');
  const saved = [];
  for (const r of results) {
    const doc = await app.firestore().collection('exams').doc(r.id).get();
    const data = doc.data();
    const questions = data.questions || [];
    const passages = [...new Set(questions.map((q) => q.passage).filter(Boolean))];
    const titles = [...new Set(questions.map((q) => q.passageTitle).filter(Boolean))];
    const field = data.readingPassages || [];
    const fourParas = passages.every((p) => p.split('\n\n').length === 4);
    saved.push({ id: r.id, passages, titles, field, fourParas });
    console.log(`${r.title}: ${passages.length} passages | ${titles.length} titles | readingPassages field ${field.length} | all 4-para: ${fourParas}`);
  }

  // ---- Assertions ----
  const allTexts = saved.flatMap((s) => s.passages);
  const allTitles = saved.flatMap((s) => s.titles);
  const textUnique = new Set(allTexts).size === allTexts.length;
  const titleUnique = new Set(allTitles).size === allTitles.length;
  const allHaveSix = saved.every((s) => s.passages.length === 6 && s.titles.length === 6 && s.field.length === 6);
  const fieldMatchesTitles = saved.every((s) => s.field.every((t) => s.titles.includes(t)));
  const allFourParas = saved.every((s) => s.fourParas);
  const countsOk = results.every((r) => r.status.includes('Added 42'));

  console.log('\n=== ASSERTIONS ===');
  console.log('passage texts unique across A+B+C:', textUnique, `(${allTexts.length})`);
  console.log('passage titles unique across A+B+C:', titleUnique, `(${allTitles.length})`);
  console.log('each exam: 6 passages, 6 titles, 6 readingPassages:', allHaveSix);
  console.log('readingPassages field matches question titles:', fieldMatchesTitles);
  console.log('all procedural/fixed passages have 4 paragraphs:', allFourParas);
  console.log('each generation added 42 questions:', countsOk);

  const pass = textUnique && titleUnique && allHaveSix && fieldMatchesTitles && allFourParas && countsOk;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

  // ---- Clean up verification exams ----
  for (const id of createdExamIds) {
    await app.firestore().collection('exams').doc(id).delete().catch(() => {});
    console.log('cleaned up exam', id);
  }
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
