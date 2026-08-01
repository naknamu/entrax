/**
 * Multi-viewport layout verification for exam.html.
 * Usage: node tests/verify-exam-viewports.cjs
 * Checks at 1440, 1024, 900, 768, 480, 375:
 *  - .exam-main is grid/flex with the question area BESIDE or ABOVE the sidebar (never below-left)
 *  - choices grid is multi-column on wide screens, single column on small ones
 *  - no horizontal body overflow
 */
const { chromium } = require('playwright');

const EXAM_ID = 'sample-exam-layout-fix';
const BASE = 'http://localhost:8080';
const VIEWPORTS = [1440, 1024, 900, 768, 480, 375];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
    await page.fill('#student-name', 'VP Check');
    await page.fill('#student-email', `vp${width}@example.com`);
    await page.click('#start-exam-btn');
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const main = document.querySelector('.exam-main');
      const sidebar = document.querySelector('.exam-sidebar');
      const qarea = document.querySelector('.exam-question-area');
      const grid = document.getElementById('choices-grid');
      const s = sidebar.getBoundingClientRect();
      const q = qarea.getBoundingClientRect();
      const mRect = main.getBoundingClientRect();
      const g = grid ? getComputedStyle(grid) : null;
      const doc = document.documentElement;
      const w = window.innerWidth;

      const sideBySide = Math.abs(s.top - q.top) < 40 && q.left >= s.right - 10;
      // The sidebar is a fixed off-canvas drawer on ALL devices (opened by the
      // burger), so the question area must span the full container content box.
      const padLeft = parseFloat(getComputedStyle(main).paddingLeft) || 0;
      const padRight = parseFloat(getComputedStyle(main).paddingRight) || 0;
      const contentLeft = mRect.left + padLeft;
      const contentRight = mRect.right - padRight;
      const fullWidth = Math.abs(q.left - contentLeft) < 8 && Math.abs(q.right - contentRight) < 8;
      const sidebarOutOfFlow = getComputedStyle(sidebar).position === 'fixed';
      const horizontalOverflow = doc.scrollWidth > doc.clientWidth + 1;

      const choiceRects = [];
      grid.querySelectorAll('.choice-btn').forEach((c) => {
        const r = c.getBoundingClientRect();
        choiceRects.push(Math.round(r.top));
      });
      const choiceRows = new Set(choiceRects).size;

      return {
        w,
        mainDisplay: getComputedStyle(main).display,
        mainCols: getComputedStyle(main).gridTemplateColumns,
        mainAreas: getComputedStyle(main).gridTemplateAreas.replace(/\s+/g, ' ').trim(),
        sidebar: { top: Math.round(s.top), left: Math.round(s.left), right: Math.round(s.right), position: getComputedStyle(sidebar).position },
        question: { top: Math.round(q.top), left: Math.round(q.left), right: Math.round(q.right), w: Math.round(q.width) },
        mainRect: { left: Math.round(mRect.left), right: Math.round(mRect.right) },
        sideBySide,
        fullWidth,
        sidebarOutOfFlow,
        horizontalOverflow,
        choicesCols: g ? g.gridTemplateColumns : 'N/A',
        choiceRows,
        choiceCount: grid.querySelectorAll('.choice-btn').length,
        navDisplay: getComputedStyle(document.querySelector('.exam-navigation')).display,
        overlayDisplay: getComputedStyle(document.querySelector('.sidebar-overlay')).display,
        toggleDisplay: getComputedStyle(document.getElementById('sidebar-toggle')).display,
      };
    });

    results.push(m);
    console.log(`WIDTH ${width}:`, JSON.stringify({
      mainDisplay: m.mainDisplay,
      mainCols: m.mainCols,
      mainAreas: m.mainAreas,
      sideBySide: m.sideBySide,
      fullWidth: m.fullWidth,
      sidebarPosition: m.sidebar.position,
      horizontalOverflow: m.horizontalOverflow,
      choicesCols: m.choicesCols,
      choiceRows: `${m.choiceRows}/${m.choiceCount}`,
      navDisplay: m.navDisplay,
      overlayDisplay: m.overlayDisplay,
      toggleDisplay: m.toggleDisplay,
    }));
    await context.close();
  }

  await browser.close();

  const pass = results.every((r) =>
    !r.horizontalOverflow &&
    (r.w >= 1025 ? r.sideBySide : r.fullWidth) &&
    (r.w >= 1025 ? !r.sidebarOutOfFlow : r.sidebarOutOfFlow) &&
    (r.w >= 900 ? r.choiceRows < r.choiceCount : r.choiceRows === r.choiceCount) &&
    r.navDisplay !== 'none' &&
    (r.w >= 1025 ? r.toggleDisplay === 'none' : r.toggleDisplay !== 'none')
  );
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'} across ${VIEWPORTS.length} viewports`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
