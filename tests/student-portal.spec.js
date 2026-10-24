/**
 * Regression test for the student portal → exam flow.
 *
 * A signed-in student must stay signed in when opening an exam from the
 * Exam List. If Firebase auth restoration races the exam page's anonymous
 * sign-in, the student gets the sign-in/sign-up view (or an anonymous
 * session) instead of the exam.
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin } from './utils.js';

test.describe('Student portal exam list', () => {
  test('opens the exam without losing the signed-in session', async ({ page }) => {
    // The seeded admin account is a normal non-anonymous Firebase user, which
    // is enough to exercise the portal's magic-link/session code path.
    await signInAsAdmin(page);

    // Track whether the name/email start form ever becomes visible. Signed-in
    // students are auto-started, so it must never flash on screen.
    await page.addInitScript(() => {
      window.__startScreenShown = false;
      const mark = () => {
        const start = document.getElementById('start-screen');
        if (start && !start.hidden) window.__startScreenShown = true;
      };
      const observer = new MutationObserver(mark);
      observer.observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'class']
      });
      mark();
    });

    await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#portal-view')).toBeVisible();
    await expect(page.locator('#signin-view')).toBeHidden();

    await page.click('.student-nav-item[data-view="exams"]');
    const startLink = page.locator('.student-exam-card a', { hasText: 'Start Exam' }).first();
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(/exam\.html\?examId=/);
    await expect(page.locator('#exam-screen')).toBeVisible({ timeout: 20000 });

    // The start form must not have flashed before the exam auto-started.
    expect(await page.evaluate(() => window.__startScreenShown)).toBe(false);

    const isAnonymous = await page.evaluate(
      () => window.__FIREBASE_AUTH__?.currentUser?.isAnonymous
    );
    expect(isAnonymous).toBe(false);
  });
});
