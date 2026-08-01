/**
 * Headless verification for the exam question-navigation layout.
 * Usage: node tests/verify-exam-drawer.cjs
 *
 * Desktop (≥1025px):
 *  - persistent Progress sidebar next to the question area (no burger)
 *  - the old question-navigator button + modal are gone from the DOM
 * Lower devices (≤1024px):
 *  - burger (.sidebar-toggle) visible in the question header (top, in-flow)
 *  - clicking the burger opens the sidebar drawer (.open) + backdrop
 *  - clicking the backdrop closes it; question-number click jumps + closes
 * All: question area beside (desktop) / full-width (lower); no overflow.
 */
const { chromium } = require('playwright');

const EXAM_ID = 'sample-exam-layout-fix';
const BASE = 'http://localhost:8080';
const VIEWPORTS = [1440, 1280, 1024, 768, 480, 375];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/exam.html?examId=${EXAM_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
    await page.fill('#student-name', 'Drawer Check');
    await page.fill('#student-email', `drawer${width}@example.com`);
    await page.click('#start-exam-btn');
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(500);

    const m = await page.evaluate(() => {
      const navBtn = document.getElementById('question-nav-btn');
      const navModal = document.getElementById('question-nav-modal');
      const toggle = document.getElementById('sidebar-toggle');
      const sidebar = document.getElementById('exam-sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      const qarea = document.querySelector('.exam-question-area');
      const main = document.querySelector('.exam-main');
      const doc = document.documentElement;
      const w = window.innerWidth;

      const tRect = toggle.getBoundingClientRect();
      const sRect = sidebar.getBoundingClientRect();
      const qRect = qarea.getBoundingClientRect();
      const mRect = main.getBoundingClientRect();
      const padLeft = parseFloat(getComputedStyle(main).paddingLeft) || 0;
      const padRight = parseFloat(getComputedStyle(main).paddingRight) || 0;
      const toggleStyle = getComputedStyle(toggle);
      const sidebarStyle = getComputedStyle(sidebar);
      const header = document.querySelector('.question-header');
      const hRect = header.getBoundingClientRect();

      const sideBySide = Math.abs(sRect.top - qRect.top) < 60 && qRect.left >= sRect.right - 10;
      const fullWidth = Math.abs(qRect.left - (mRect.left + padLeft)) < 8 && Math.abs(qRect.right - (mRect.right - padRight)) < 8;
      const progressVisible = !!document.querySelector('.progress-bar-container') &&
        getComputedStyle(document.querySelector('.progress-bar-container')).display !== 'none';

      return {
        w,
        navigatorRemoved: !navBtn && !navModal,
        toggle: {
          display: toggleStyle.display,
          position: toggleStyle.position,
          w: Math.round(tRect.width),
          inHeader: tRect.top >= hRect.top - 8 && tRect.bottom <= hRect.bottom + 8 && tRect.left >= hRect.left - 8,
        },
        sidebar: {
          position: sidebarStyle.position,
          offscreen: sRect.left >= w - 1,
        },
        sideBySide,
        fullWidth,
        progressVisible,
        horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      };
    });

    const isDesktop = m.w >= 1025;
    let open = null;
    let jump = null;
    let backdropClose = null;

    if (!isDesktop) {
      // Open the drawer via the burger
      await page.click('#sidebar-toggle');
      await page.waitForTimeout(400);
      open = await page.evaluate(() => {
        const sidebar = document.getElementById('exam-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const sRect = sidebar.getBoundingClientRect();
        return {
          hasOpen: sidebar.classList.contains('open'),
          overlayOpen: overlay.classList.contains('open'),
          overlayDisplay: getComputedStyle(overlay).display,
          onscreen: sRect.left < window.innerWidth && sRect.right > 0,
          navButtons: document.querySelectorAll('#question-nav .nav-btn').length,
        };
      });

      if (open.navButtons >= 2) {
        await page.locator('#question-nav .nav-btn').nth(1).click();
        await page.waitForTimeout(300);
        jump = await page.evaluate(() => ({
          drawerClosed: !document.getElementById('exam-sidebar').classList.contains('open'),
          questionText: document.getElementById('question-number').textContent,
        }));
      }

      await page.click('#sidebar-toggle');
      await page.waitForTimeout(300);
      backdropClose = await (async () => {
        const reopened = await page.evaluate(() => document.getElementById('exam-sidebar').classList.contains('open'));
        if (!reopened) return { reopened: false, closedAfterBackdrop: true };
        await page.click('#sidebar-overlay', { position: { x: 10, y: 10 } }).catch(() => {});
        await page.waitForTimeout(300);
        return await page.evaluate(() => ({
          reopened: true,
          closedAfterBackdrop: !document.getElementById('exam-sidebar').classList.contains('open'),
        }));
      })();
    }

    const summary = isDesktop
      ? {
          navigatorRemoved: m.navigatorRemoved,
          sideBySide: m.sideBySide,
          progressVisible: m.progressVisible,
          burgerHidden: m.toggle.display === 'none',
          sidebarPosition: m.sidebar.position,
          horizontalOverflow: m.horizontalOverflow,
        }
      : {
          navigatorRemoved: m.navigatorRemoved,
          fullWidth: m.fullWidth,
          progressInDrawer: m.progressVisible,
          burger: `${m.toggle.display}/${m.toggle.position} inHeader=${m.toggle.inHeader}`,
          sidebarClosedOffscreen: m.sidebar.offscreen,
          drawerOpens: open.hasOpen && open.onscreen && open.overlayOpen && open.overlayDisplay === 'block',
          navButtons: open.navButtons,
          jumpWorks: jump.drawerClosed && jump.questionText.includes('2'),
          backdropCloses: backdropClose.closedAfterBackdrop,
          horizontalOverflow: m.horizontalOverflow,
        };
    results.push({ m, open, jump, backdropClose, isDesktop, errors });
    console.log(`WIDTH ${width}:`, JSON.stringify(summary));

    await context.close();
  }

  await browser.close();

  const pass = results.every((r) => {
    if (!r.m.navigatorRemoved || r.m.horizontalOverflow || !r.m.progressVisible || r.errors.length) return false;
    if (r.isDesktop) {
      return r.m.sideBySide && r.m.toggle.display === 'none' && r.m.sidebar.position !== 'fixed';
    }
    return r.m.fullWidth &&
      r.m.toggle.display !== 'none' && r.m.toggle.position === 'static' && r.m.toggle.inHeader &&
      r.m.sidebar.offscreen &&
      r.open.hasOpen && r.open.onscreen && r.open.overlayOpen && r.open.overlayDisplay === 'block' &&
      r.open.navButtons >= 2 &&
      r.jump.drawerClosed && r.jump.questionText.includes('2') &&
      r.backdropClose.closedAfterBackdrop;
  });
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'} across ${VIEWPORTS.length} viewports`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
