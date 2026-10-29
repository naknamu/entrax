/**
 * Landing/study FAQ accordion (exclusive-open).
 *
 * Regression guard for the flicker reported when opening an answer: the
 * previous implementation closed the other answers from the queued `toggle`
 * event, so the page grew and then shrank again on every click.
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

  test('keeps the clicked question under the pointer', async ({ page }) => {
    await openFaq(page);

    // The first answer is open by default, so opening a lower one collapses
    // content above the click target. Without scroll compensation the whole
    // list jumps up by the height of the collapsed answer.
    const summary = page.locator('.mk-faq-item').nth(5).locator('summary');
    const before = await summary.evaluate((el) => el.getBoundingClientRect().top);
    await summary.click();
    const after = await summary.evaluate((el) => el.getBoundingClientRect().top);

    expect(Math.abs(after - before)).toBeLessThan(2);
  });
});
