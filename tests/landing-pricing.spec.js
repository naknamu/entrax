/**
 * Landing pricing.
 *
 * The grid sells two one-time plans (Exam Pass, Lifetime) next to the free
 * account. The $9 extension is a retention offer for a lapsed pass, so it lives
 * on the portal plan card instead — putting it on the landing page implied the
 * pass was a 90-day rental and undercut "Pay once. No subscription."
 *
 * Run: npx playwright test tests/landing-pricing.spec.js
 */

import { test, expect } from '@playwright/test';

test('pricing offers the two one-time plans and no extension', async ({ page }) => {
  await page.goto('/index.html#pricing');

  await expect(page.locator('.mk-price-card')).toHaveCount(3);
  await expect(page.locator('.mk-price-extension')).toHaveCount(0);
  await expect(page.getByText(/Need more time\?/)).toHaveCount(0);

  // The fine print must not advertise a product the page no longer shows.
  const footnote = page.locator('.mk-price-footnote');
  await expect(footnote).toContainText('Exam Pass ($19) and Lifetime ($49) are one-time purchases');
  await expect(footnote).not.toContainText('Extension');
});
