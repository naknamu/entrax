/**
 * Headless layout verification for exam.html.
 * Usage: node tests/verify-exam-layout.cjs [--screenshot out.png]
 *
 * Navigates to the seeded exam, starts it as a student, and reports:
 *  - .exam-main container display/flex-direction and child geometry
 *  - whether the sidebar and question area are side-by-side (not stacked)
 *  - .choices-grid column count + actual choice button geometry
 *  - .start-info-grid column count
 * Exits 0 if multi-column layout is verified, 1 otherwise.
 */
const { chromium } = require('playwright');

const EXAM_ID = 'sample-exam-layout-fix';
const BASE = 'http://localhost:8080';
const VIEWPORT = { width: 1440, height: 900 };

const screenshotArg = process.argv.find((a) => a.startsWith('--screenshot'));
const screenshotPath = screenshotArg ? screenshotArg.split('=')[1] : null;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });

  // Capture start screen grid info
  const startInfo = await page.evaluate(() => {
    const grid = document.querySelector('.start-info-grid');
    const cards = grid ? grid.children : [];
    return {
      display: grid ? getComputedStyle(grid).display : 'N/A',
      cols: grid ? getComputedStyle(grid).gridTemplateColumns : 'N/A',
      cardCount: cards.length,
      cardsSameRow: cards.length >= 2
        ? Math.round(cards[0].getBoundingClientRect().top) === Math.round(cards[1].getBoundingClientRect().top)
        : false,
    };
  });
  console.log('START_SCREEN:', JSON.stringify(startInfo));

  // Start exam
  await page.fill('#student-name', 'Layout Check Student');
  await page.fill('#student-email', 'layoutcheck@example.com');
  await page.click('#start-exam-btn');
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(800);

  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`SCREENSHOT: ${screenshotPath}`);
  }

  const layout = await page.evaluate(() => {
    const main = document.querySelector('.exam-main');
    const sidebar = document.querySelector('.exam-sidebar');
    const qarea = document.querySelector('.exam-question-area');
    const grid = document.getElementById('choices-grid');
    const choices = grid ? grid.querySelectorAll('.choice-btn') : [];
    const body = document.body;

    const mainStyle = main ? getComputedStyle(main) : null;
    const sRect = sidebar ? sidebar.getBoundingClientRect() : null;
    const qRect = qarea ? qarea.getBoundingClientRect() : null;
    const mRect = main ? main.getBoundingClientRect() : null;
    const padLeft = mainStyle ? parseFloat(mainStyle.paddingLeft) || 0 : 0;
    const padRight = mainStyle ? parseFloat(mainStyle.paddingRight) || 0 : 0;

    // Desktop: persistent Progress sidebar beside the question area.
    const sideBySide = sRect && qRect
      ? Math.abs(sRect.top - qRect.top) < 60 && qRect.left >= sRect.right - 10
      : false;
    const sidebarSticky = sidebar ? getComputedStyle(sidebar).position === 'sticky' : false;

    const choiceRects = [];
    choices.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      choiceRects.push({ i, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) });
    });

    // Count distinct choice rows
    const rows = new Set(choiceRects.map((c) => c.top)).size;

    return {
      windowWidth: window.innerWidth,
      bodyDisplay: getComputedStyle(body).display,
      bodyOverflowX: getComputedStyle(body).overflowX,
      mainDisplay: mainStyle ? mainStyle.display : 'N/A',
      mainFlexDirection: mainStyle ? mainStyle.flexDirection : 'N/A',
      mainGridCols: mainStyle ? mainStyle.gridTemplateColumns : 'N/A',
      mainWidth: main ? main.offsetWidth : 0,
      sidebar: sRect ? { top: Math.round(sRect.top), left: Math.round(sRect.left), right: Math.round(sRect.right), w: Math.round(sRect.width) } : null,
      questionArea: qRect ? { top: Math.round(qRect.top), left: Math.round(qRect.left), w: Math.round(qRect.width) } : null,
      fullWidth: mRect && qRect
        ? Math.abs(qRect.left - (mRect.left + padLeft)) < 8 &&
          Math.abs(qRect.right - (mRect.right - padRight)) < 8
        : false,
      sideBySide,
      sidebarSticky,
      choicesGridDisplay: grid ? getComputedStyle(grid).display : 'N/A',
      choicesGridCols: grid ? getComputedStyle(grid).gridTemplateColumns : 'N/A',
      choiceCount: choices.length,
      choiceRows: rows,
      choiceRects,
    };
  });
  console.log('EXAM_SCREEN:', JSON.stringify(layout, null, 2));
  if (errors.length) console.log('PAGE_ERRORS:', JSON.stringify(errors));

  await browser.close();

  const ok = layout.sideBySide === true && layout.sidebarSticky === true &&
    layout.choiceRows >= 2 && layout.choiceRows < layout.choiceCount;
  console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'} (sideBySide=${layout.sideBySide}, sidebarSticky=${layout.sidebarSticky}, choiceRows=${layout.choiceRows}/${layout.choiceCount})`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
