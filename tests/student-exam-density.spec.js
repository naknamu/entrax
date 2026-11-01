/**
 * Exam list density.
 *
 * A page of exams used to be one column of tall cards (~185px each), so only
 * three or four were visible before scrolling. The list now defaults to
 * "compact" (one row per exam) with a remembered switch back to the full cards,
 * so a whole page of ten exams fits on a laptop screen.
 *
 * Run: npx playwright test tests/student-exam-density.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, createFirestoreDoc, deleteFirestoreDoc } from './utils.js';

test.use({ viewport: { width: 1280, height: 900 } });

const densityExam = (n) => ({
  title: `Density Exam ${String(n).padStart(2, '0')}`,
  description: 'A published exam used to check the list layout.',
  status: 'published',
  passingPercent: 70,
  timeLimitMinutes: 30,
  createdAt: new Date(),
  questions: [
    {
      category: 'Science',
      text: 'Density question',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
    },
  ],
});

test.describe('Student exam list density', () => {
  test('compact rows fit a full page of exams without scrolling', async ({ page, request }) => {
    const email = `density-${Date.now()}@test.com`;
    await signInAsStudent(page, email);

    const created = [];
    try {
      for (let i = 1; i <= 10; i++) {
        created.push(await createFirestoreDoc(request, 'exams', densityExam(i)));
      }

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');

      // Scope to the seeded exams: the shared emulator accumulates published
      // exams from other specs.
      await page.fill('#exam-search', 'Density Exam');
      await expect(page.locator('.student-exam-card')).toHaveCount(10, { timeout: 20000 });

      const list = page.locator('#exam-list');
      await expect(list).toHaveAttribute('data-density', 'compact');
      await expect(
        page.locator('.student-density-btn[data-density="compact"]')
      ).toHaveAttribute('aria-pressed', 'true');

      // The point of the change: the whole page of exams is on screen.
      const fit = await page.evaluate(() => {
        const last = document.querySelector('#exam-list .student-exam-card:last-child');
        return {
          viewportHeight: window.innerHeight,
          lastCardBottom: Math.round(last.getBoundingClientRect().bottom),
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
      expect(fit.lastCardBottom).toBeLessThanOrEqual(fit.viewportHeight);
      expect(fit.scrollHeight).toBeLessThanOrEqual(fit.viewportHeight + 1);

      // A compact row keeps the exam facts and actions, but drops the blurb.
      const first = page.locator('.student-exam-card').first();
      await expect(first.locator('.student-exam-card-desc')).toBeHidden();
      await expect(first.locator('.student-exam-card-meta')).toBeVisible();
      await expect(first.locator('.student-exam-card-title')).toBeVisible();
      await expect(first.locator('.btn')).toHaveCount(1);
      const compactHeight = (await first.boundingBox()).height;

      // The switch brings the full cards back, and the choice is remembered.
      await page.click('.student-density-btn[data-density="comfortable"]');
      await expect(list).toHaveAttribute('data-density', 'comfortable');
      await expect(
        page.locator('.student-density-btn[data-density="comfortable"]')
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(first.locator('.student-exam-card-desc')).toBeVisible();
      const comfortableHeight = (await first.boundingBox()).height;
      expect(comfortableHeight).toBeGreaterThan(compactHeight * 1.5);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await expect(list).toHaveAttribute('data-density', 'comfortable');

      // ...and switching back persists as well.
      await page.click('.student-density-btn[data-density="compact"]');
      await expect(list).toHaveAttribute('data-density', 'compact');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await expect(list).toHaveAttribute('data-density', 'compact');
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
