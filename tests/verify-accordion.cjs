/**
 * Verify create-exam accordion behavior: default states, toggle (click +
 * keyboard), badges, auto-expand after generation.
 * Usage: node tests/verify-accordion.cjs
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8080';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.goto(`${BASE}/index.html?test=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-form', { state: 'visible', timeout: 30000 });
  await page.fill('#email', 'admin@test.com');
  await page.fill('#password', 'password123');
  await page.click('#login-form button[type="submit"]');
  await page.waitForURL('**/admin-dashboard*', { timeout: 15000 });

  await page.goto(`${BASE}/create-exam.html?test=true`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#exam-form', { state: 'visible', timeout: 30000 });

  const state = async (name) => page.evaluate((n) => {
    const section = document.querySelector(`.accordion-section:has(.accordion-toggle[data-accordion="${n}"])`);
    const toggle = document.querySelector(`.accordion-toggle[data-accordion="${n}"]`);
    return { open: section.classList.contains('open'), expanded: toggle.getAttribute('aria-expanded') };
  }, name);

  // 1) Default states
  const defaults = {};
  for (const n of ['exam-info', 'sections', 'import', 'generate', 'questions']) defaults[n] = await state(n);
  console.log('defaults:', JSON.stringify(defaults));
  const defaultsOk =
    defaults['exam-info'].open === true &&
    defaults['questions'].open === true &&
    defaults['sections'].open === false &&
    defaults['import'].open === false &&
    defaults['generate'].open === false;

  // 2) Click toggle: sections opens then closes
  await page.click('.accordion-toggle[data-accordion="sections"]');
  await page.waitForTimeout(400);
  const opened = await state('sections');
  await page.click('.accordion-toggle[data-accordion="sections"]');
  await page.waitForTimeout(400);
  const closed = await state('sections');
  console.log('click toggle: opened =', JSON.stringify(opened), '| closed =', JSON.stringify(closed));
  const toggleOk = opened.open === true && opened.expanded === 'true' && closed.open === false && closed.expanded === 'false';

  // 3) Keyboard: focus sections toggle, Enter opens, Space closes
  await page.focus('.accordion-toggle[data-accordion="sections"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const kbOpen = await state('sections');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const kbClosed = await state('sections');
  console.log('keyboard: Enter open =', JSON.stringify(kbOpen), '| Space closed =', JSON.stringify(kbClosed));
  const kbOk = kbOpen.open === true && kbClosed.open === false;

  // 4) Badges: add a section + question
  await page.click('.accordion-toggle[data-accordion="sections"]');
  await page.waitForTimeout(400);
  await page.click('#add-section-btn');
  await page.locator('.section-title-input').last().fill('READING');
  const sectionsBadge = (await page.locator('#sections-count-badge').textContent()).trim();
  await page.click('.accordion-toggle[data-accordion="sections"]');
  await page.waitForTimeout(400);
  await page.click('#add-question-btn'); // questions already has 1 default block -> 2
  const questionsBadge = (await page.locator('#questions-count-badge').textContent()).trim();
  console.log('badges: sections =', JSON.stringify(sectionsBadge), '| questions =', JSON.stringify(questionsBadge));
  const badgesOk = sectionsBadge === '1 section' && questionsBadge === '2 questions';

  // 5) Auto-expand: collapse questions, then generate -> questions re-opens
  await page.click('.accordion-toggle[data-accordion="questions"]');
  await page.waitForTimeout(400);
  const questionsCollapsed = (await state('questions')).open === false;
  await page.click('.accordion-toggle[data-accordion="generate"]');
  await page.waitForTimeout(400);
  await page.click('.generate-tab[data-gen-tab="math"]');
  await page.click('#generate-add-btn');
  await page.waitForTimeout(800);
  const questionsAfterGenerate = await state('questions');
  console.log('auto-expand: collapsed before =', questionsCollapsed, '| open after generate =', questionsAfterGenerate.open);
  const autoOk = questionsCollapsed === true && questionsAfterGenerate.open === true;

  const pass = defaultsOk && toggleOk && kbOk && badgesOk && autoOk;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
