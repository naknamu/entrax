/**
 * Skip link on the app pages (student portal dashboard, exam page).
 *
 * The link existed but had no styles: it rendered as a normal inline anchor
 * above the header, reserving a line and pushing the dashboard down. It also
 * pointed at #main-content, which neither page defined. It should stay out of
 * the layout (and the viewport) until a keyboard user tabs to it, then hand
 * focus to the main region.
 *
 * Run: npx playwright test tests/skip-link.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent } from './utils.js';

test.describe('Skip to main content', () => {
  test('stays out of the dashboard layout until keyboard focus', async ({ page }) => {
    await signInAsStudent(page);
    await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });

    const skip = page.locator('.skip-link');
    await expect(skip).toHaveAttribute('href', '#main-content');

    // Fixed and parked above the viewport: it reserves no line at the top.
    expect(await skip.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    const hiddenBox = await skip.boundingBox();
    expect(hiddenBox.y + hiddenBox.height).toBeLessThanOrEqual(0);

    // The dashboard starts at the top of the viewport, not below a stray link.
    const mainTop = await page
      .locator('main#main-content')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(mainTop).toBeLessThanOrEqual(1);

    // The first Tab reveals the link above the page content. The reveal is a
    // 100ms transform transition, so wait for it to land before measuring.
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport({ ratio: 1 });
    const visibleBox = await skip.boundingBox();
    expect(visibleBox.y).toBeGreaterThan(-1);
    expect(visibleBox.y).toBeLessThan(120);

    // Enter moves focus to the main region.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('main-content');
  });

  test('exam page defines the skip target on its main region', async ({ page }) => {
    await signInAsStudent(page);
    await page.goto('/exam.html?examId=missing-exam-for-skip-link', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('main#main-content')).toHaveAttribute('tabindex', '-1');
  });
});
