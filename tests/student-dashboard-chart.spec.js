/**
 * Student dashboard "Score Trend" chart.
 *
 * Regression coverage for the chart layout:
 *  - bars render in one horizontal row (they used to stack vertically because
 *    the plot was not a flex container);
 *  - with a single submission the plot — and therefore the passing threshold
 *    line — stays a bounded, centred width instead of spanning the card;
 *  - date labels show the full year and never overlap each other.
 *
 * Run: npx playwright test tests/student-dashboard-chart.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, seedSubmission, deleteFirestoreDoc } from './utils.js';

async function openDashboard(page) {
  await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#score-trend-chart .student-chart-bar-col').first()).toBeVisible({
    timeout: 20000,
  });
}

test.describe('Student dashboard score trend', () => {
  test('single submission: one bar, bounded threshold line, full-year label', async ({ page, request }) => {
    const email = `chart-single-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    expect(uid).toBeTruthy();

    const created = [];
    try {
      created.push(await seedSubmission(request, { studentUid: uid, percentage: 55 }));
      await openDashboard(page);

      await expect(page.locator('#score-trend-chart .student-chart-bar-col')).toHaveCount(1);

      const metrics = await page.evaluate(() => {
        const area = document.getElementById('score-trend-chart');
        const inner = area.querySelector('.student-chart-inner');
        const plot = area.querySelector('.student-chart-plot');
        const line = area.querySelector('.student-chart-pass-line');
        const card = area.closest('.student-chart-card');
        const label = area.querySelector('.student-chart-bar-label');
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, width: r.width, height: r.height };
        };
        return {
          area: box(area),
          inner: box(inner),
          plot: box(plot),
          line: box(line),
          card: box(card),
          label: box(label),
          labelText: label.textContent.replace(/\s+/g, ' ').trim(),
          legend: area.querySelector('.student-chart-legend')?.textContent.trim(),
        };
      });

      // The threshold line spans the plot, and the plot is bounded — not the
      // full card width (the bug was a line stretched edge to edge).
      expect(metrics.line.width).toBeCloseTo(metrics.plot.width, 0);
      expect(metrics.plot.width).toBeLessThanOrEqual(564);
      expect(metrics.plot.width).toBeLessThan(metrics.card.width - 100);

      // The chart group is horizontally centred in the card.
      const gapLeft = metrics.inner.left - metrics.area.left;
      const gapRight = metrics.area.right - metrics.inner.right;
      expect(Math.abs(gapLeft - gapRight)).toBeLessThan(4);

      // Full date, including the year, inside the card.
      expect(metrics.labelText).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
      expect(metrics.label.left).toBeGreaterThan(metrics.card.left);
      expect(metrics.label.right).toBeLessThan(metrics.card.right);

      // The passing threshold is explained by a legend, not a chip over a bar.
      expect(metrics.legend).toMatch(/Passing \d+%/);
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });

  test('several submissions: bars sit in one row and labels do not collide', async ({ page, request }) => {
    const email = `chart-multi-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    expect(uid).toBeTruthy();

    const created = [];
    try {
      const scores = [55, 62, 78];
      for (let i = 0; i < scores.length; i++) {
        created.push(await seedSubmission(request, {
          studentUid: uid,
          percentage: scores[i],
          submittedAt: new Date(Date.now() - (scores.length - i) * 86400000),
        }));
      }
      await openDashboard(page);

      await expect(page.locator('#score-trend-chart .student-chart-bar-col')).toHaveCount(scores.length);

      const layout = await page.evaluate(() => {
        const cols = [...document.querySelectorAll('#score-trend-chart .student-chart-bar-col')];
        const rects = cols.map((c) => c.getBoundingClientRect());
        const labels = cols.map((c) => {
          const r = c.querySelector('.student-chart-bar-label').getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            text: c.querySelector('.student-chart-bar-label').textContent.replace(/\s+/g, ' ').trim(),
          };
        });
        return {
          tops: rects.map((r) => Math.round(r.top)),
          lefts: rects.map((r) => Math.round(r.left)),
          labels,
        };
      });

      // One horizontal row (stacked columns were the bug).
      expect(new Set(layout.tops).size).toBe(1);
      expect(layout.lefts).toEqual([...layout.lefts].sort((a, b) => a - b));

      // Every label shows the full year and none overlap a neighbour.
      for (const label of layout.labels) {
        expect(label.text).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
      }
      for (let i = 1; i < layout.labels.length; i++) {
        expect(layout.labels[i].left).toBeGreaterThanOrEqual(layout.labels[i - 1].right);
      }
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
