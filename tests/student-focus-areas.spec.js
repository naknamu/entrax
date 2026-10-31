/**
 * Student dashboard "Focus Areas".
 *
 * The per-category Drill action used to be a ghost text button that blended
 * into the row. It is now a filled primary-tinted button, so this locks in
 * both the highlight (background, border, >= 4.5:1 label contrast) and the
 * behaviour (clicking drills into that category).
 *
 * Run: npx playwright test tests/student-focus-areas.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, seedSubmission, deleteFirestoreDoc } from './utils.js';

function luminance([r, g, b]) {
  const channel = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test.describe('Student dashboard focus areas', () => {
  test('Drill button is highlighted and starts a category drill', async ({ page, request }) => {
    const email = `focus-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    expect(uid).toBeTruthy();

    const created = [];
    try {
      created.push(await seedSubmission(request, {
        studentUid: uid,
        percentage: 50,
        categoryStats: {
          Science: { total: 10, correct: 3 },
          Reading: { total: 10, correct: 8 },
        },
      }));

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#focus-areas-card')).toBeVisible({ timeout: 20000 });

      // Weakest category first: Science at 30%.
      const drill = page.locator('.student-drill-btn').first();
      await expect(drill).toBeVisible();
      await expect(drill).toHaveText(/Drill/);
      await expect(drill).toHaveAttribute('aria-label', 'Drill Science');

      const styles = await drill.evaluate((el) => {
        const cs = getComputedStyle(el);
        const parts = cs.backgroundColor.match(/[\d.]+/g).map(Number);
        return {
          background: parts.slice(0, 3),
          alpha: parts.length > 3 ? parts[3] : 1,
          color: cs.color.match(/[\d.]+/g).slice(0, 3).map(Number),
          borderWidth: cs.borderTopWidth,
        };
      });

      // Filled (not the transparent ghost button) with a visible border.
      expect(styles.alpha).toBeGreaterThan(0.9);
      expect(styles.borderWidth).not.toBe('0px');

      // Readable label on the tint in both themes.
      expect(contrastRatio(styles.color, styles.background)).toBeGreaterThanOrEqual(4.5);

      // Clicking drills into the category and switches to the exam list.
      await drill.click();
      await expect(page.locator('#view-exams')).toBeVisible();
      await expect(page.locator('#drill-badge')).toBeVisible();
      await expect(page.locator('#drill-category-name')).toHaveText('Science');
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
