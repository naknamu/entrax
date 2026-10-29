/**
 * Landing/study FAQ accordion (exclusive-open).
 *
 * Regression guards for two reported issues:
 *  - the answer flickered because the other answers were closed from the
 *    queued `toggle` event, so the page grew and then shrank again;
 *  - compensating for that collapse scrolled the whole page down.
 *
 * Run: npx playwright test tests/landing-faq.spec.js
 */

import { test, expect } from '@playwright/test';

async function openFaq(page) {
  await page.goto('/index.html');
  await page.locator('#faq').scrollIntoViewIfNeeded();
  await expect(page.locator('.mk-faq-item').first()).toBeVisible();
}

/** Indexes of the currently open answers. */
const openIndexes = (page) =>
  page.locator('.mk-faq-item').evaluateAll((items) =>
    items.flatMap((item, index) => (item.open ? [index] : []))
  );

test.describe('FAQ accordion', () => {
  test('opens one answer and closes the previously open one', async ({ page }) => {
    await openFaq(page);

    const items = page.locator('.mk-faq-item');
    expect(await openIndexes(page)).toEqual([0]);

    await items.nth(3).locator('summary').click();

    expect(await openIndexes(page)).toEqual([3]);
    await expect(items.nth(3).locator('p')).toBeVisible();
  });

  test('closes an open answer without opening another', async ({ page }) => {
    await openFaq(page);

    await page.locator('.mk-faq-item').first().locator('summary').click();

    expect(await openIndexes(page)).toEqual([]);
  });

  test('does not scroll the page when an answer opens', async ({ page }) => {
    await openFaq(page);

    // Collapsing the answer above the click target must not change the scroll
    // position: compensating for it made the whole page slide down.
    const before = await page.evaluate(() => window.scrollY);
    await page.locator('.mk-faq-item').nth(5).locator('summary').click();
    const after = await page.evaluate(() => window.scrollY);

    expect(after).toBe(before);
  });
});
