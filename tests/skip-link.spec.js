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
import { signInAsAdmin, signInAsStudent } from './utils.js';

/**
 * Shared assertions for any page that ships a skip link: it must point at a
 * real target, reserve no space while idle, and slide into the viewport when
 * focused (the reveal is a transform transition, so measure once it lands).
 */
async function expectSkipLinkShape(page) {
  const skip = page.locator('.skip-link');
  await expect(skip).toHaveAttribute('href', '#main-content');
  expect(await skip.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');

  // Idle means fully off-screen. The reveal/hide is a transform transition, so
  // wait until it has actually left the viewport before measuring.
  await expect(skip).not.toBeInViewport();
  const hiddenBox = await skip.boundingBox();
  expect(hiddenBox.y + hiddenBox.height).toBeLessThanOrEqual(0);

  await expect(page.locator('main#main-content')).toHaveCount(1);
  await expect(page.locator('main#main-content')).toHaveAttribute('tabindex', '-1');

  await skip.focus();
  await expect(skip).toBeInViewport({ ratio: 1 });
  return skip;
}

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

  test('admin sign-in page has an off-layout skip link', async ({ page }) => {
    await page.goto('/admin-login.html', { waitUntil: 'domcontentloaded' });
    await expectSkipLinkShape(page);
  });

  test('admin pages have an off-layout skip link and a real target', async ({ page }) => {
    await signInAsAdmin(page);

    for (const path of ['/admin-dashboard.html', '/create-exam.html', '/exam-results.html']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Nothing on the page sits above the link, so the first Tab reveals it
      // and Enter hands focus to the main region. Keyboard checks come first:
      // they need focus to start at the document, before anything is focused.
      const skip = page.locator('.skip-link');
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('main-content');

      // Then the shape: off the layout while idle, real target, focus reveal.
      await expectSkipLinkShape(page);
    }
  });
});
