/**
 * Verify the improved Generate Kaplan Questions UI: pills + hint, chips,
 * live preview, select-all/clear, and the double-click guard.
 * Usage: node tests/verify-generate-ui.cjs
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
  await page.locator('.accordion-toggle[data-accordion="generate"]').click();
  await page.waitForTimeout(400);

  const preview = () => page.locator('#generate-preview').textContent().then((t) => (t || '').trim());
  const chips = () => page.locator('#generate-topics input[type="checkbox"]').count();
  const checked = () => page.locator('#generate-topics input[type="checkbox"]:checked').count();
  const hint = () => page.locator('#generate-hint').textContent().then((t) => (t || '').trim());

  // 1) Default Math tab: pills render, hint + preview present
  const math = {
    activeTab: (await page.locator('.generate-tab.active').textContent()).trim(),
    chips: await chips(),
    checked: await checked(),
    preview: await preview(),
    hintLen: (await hint()).length,
  };
  console.log('math default:', JSON.stringify(math));
  const mathOk = math.activeTab === 'Math' && math.chips > 0 && math.checked === math.chips && math.hintLen > 0 && /\d+ topics? × \d+ per topic = \d+ questions?/.test(math.preview);

  // 2) Switch to Reading: 7 chips, preview "7 × 6 = 42"
  await page.click('.generate-tab[data-gen-tab="reading"]');
  await page.waitForTimeout(200);
  const reading = {
    activeTab: (await page.locator('.generate-tab.active').textContent()).trim(),
    checked: await checked(),
    countVal: await page.locator('#generate-count').inputValue(),
    preview: await preview(),
  };
  console.log('reading tab:', JSON.stringify(reading));
  const readingOk = reading.activeTab === 'Reading' && reading.checked === 7 && reading.countVal === '6' && reading.preview.includes('= 42 questions');

  // 3) Toggle a chip (label click) -> preview drops to 36; Clear -> 0; Select all -> 42
  await page.locator('#generate-topics .topic-chip').first().click();
  await page.waitForTimeout(100);
  const afterUncheck = await preview();
  await page.click('#generate-clear-all');
  await page.waitForTimeout(100);
  const afterClear = await preview();
  await page.click('#generate-check-all');
  await page.waitForTimeout(100);
  const afterSelectAll = await preview();
  console.log('preview transitions:', JSON.stringify({ afterUncheck, afterClear, afterSelectAll }));
  const previewOk = afterUncheck.includes('= 36 questions') && afterClear.includes('No topics selected') && afterSelectAll.includes('= 42 questions');

  // 4) Per-topic count change updates preview
  await page.locator('#generate-count').fill('2');
  await page.waitForTimeout(100);
  const afterCount = await preview();
  console.log('count=2 preview:', afterCount);
  const countOk = afterCount.includes('= 14 questions');

  // 5) Generate: guard disables the button + shows spinner, status appears
  await page.locator('#generate-count').fill('6');
  await page.click('#generate-add-btn');
  await page.waitForFunction(() => document.getElementById('generate-status')?.textContent.includes('Added 42'), null, { timeout: 20000 });
  const postGen = {
    disabled: await page.locator('#generate-add-btn').isDisabled(),
    spinnerHidden: await page.locator('#generate-spinner').evaluate((el) => el.classList.contains('hidden')),
    status: (await page.locator('#generate-status').textContent()).trim(),
  };
  console.log('post-generate:', JSON.stringify(postGen));
  const genOk = postGen.disabled === false && postGen.spinnerHidden === true && postGen.status.includes('Added 42 generated Reading questions');

  const pass = mathOk && readingOk && previewOk && countOk && genOk;
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
