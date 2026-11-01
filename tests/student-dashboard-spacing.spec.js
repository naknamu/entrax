/**
 * Student dashboard vertical rhythm.
 *
 * Every dashboard section (welcome, stats, streak, score trend, focus areas,
 * recent activity) is separated by the same 24px gutter. The Focus Areas card
 * used to have no bottom margin, so Recent Activity sat flush against it while
 * the sections above had a full gutter.
 *
 * Run: npx playwright test tests/student-dashboard-spacing.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, seedSubmission, deleteFirestoreDoc } from './utils.js';

test.describe('Student dashboard spacing', () => {
  test('Focus Areas and Recent Activity keep the same section gutter', async ({ page, request }) => {
    const email = `spacing-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    expect(uid).toBeTruthy();

    const created = [];
    try {
      // Focus Areas only renders when a submission carries category stats.
      created.push(await seedSubmission(request, {
        studentUid: uid,
        percentage: 60,
        categoryStats: {
          Science: { total: 10, correct: 4 },
          Reading: { total: 10, correct: 8 },
        },
      }));

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#focus-areas-card')).toBeVisible({ timeout: 20000 });

      const gaps = await page.evaluate(() => {
        const box = (selector) => document.querySelector(selector).getBoundingClientRect();
        const chart = box('.student-chart-card');
        const focus = box('#focus-areas-card');
        const activity = box('.student-activity-card');
        const padding = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).paddingTop);
        return {
          chartToFocus: focus.top - chart.bottom,
          focusToActivity: activity.top - focus.bottom,
          focusPadding: padding('#focus-areas-card'),
          activityPadding: padding('.student-activity-card'),
        };
      });

      // Both gutters are the same 24px token; neither card is flush.
      expect(gaps.chartToFocus).toBeGreaterThanOrEqual(23.5);
      expect(gaps.focusToActivity).toBeGreaterThanOrEqual(23.5);
      expect(Math.abs(gaps.chartToFocus - gaps.focusToActivity)).toBeLessThan(1);

      // Cards are padded identically, so the whitespace inside them matches too.
      expect(gaps.focusPadding).toBe(gaps.activityPadding);
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
