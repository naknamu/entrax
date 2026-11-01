/**
 * Student portal exam cards.
 *
 * The cards are clickable, but a click has to land on the right screen: the
 * review screen for an exam the student already took, the start screen for a
 * new one. (They used to always start the exam, so clicking a completed card
 * silently began a retake.) The NEW badge and Retake button also need to read
 * as actions rather than as decoration.
 *
 * Run: npx playwright test tests/student-exam-cards.spec.js
 */

import { test, expect } from '@playwright/test';
import {
  signInAsStudent,
  seedSubmission,
  createFirestoreDoc,
  deleteFirestoreDoc,
} from './utils.js';

const question = (category) => ({
  category,
  text: `Question about ${category}`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
});

test.describe('Student portal exam cards', () => {
  test('cards open details and the NEW/Retake affordances are visible', async ({ page, request }) => {
    const email = `cards-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    expect(uid).toBeTruthy();

    const created = [];
    try {
      // One attempted exam (failed -> Retake) and one fresh exam (NEW).
      created.push(await seedSubmission(request, { studentUid: uid, percentage: 50 }));
      created.push(await createFirestoreDoc(request, 'exams', {
        title: 'Science Booster',
        description: 'Focused practice on the science categories.',
        status: 'published',
        passingPercent: 70,
        timeLimitMinutes: 30,
        createdAt: new Date(),
        questions: [question('Science'), question('Biology')],
      }));

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await expect(page.locator('.student-exam-card').first()).toBeVisible({ timeout: 20000 });

      // Narrow the list instead of relying on pagination: the shared emulator
      // accumulates published exams from other specs.
      await page.click('.student-filter-tab[data-filter="completed"]');
      const completed = page.locator('.student-exam-card.failed', {
        hasText: 'Sample Exam for Testing',
      });
      await expect(completed).toBeVisible({ timeout: 20000 });

      // Clicking a finished card opens its results, not a new attempt.
      await expect(completed).toHaveAttribute('data-href', /review=true/);
      // The title is a real link so the card is reachable by keyboard.
      await expect(completed.locator('.student-exam-card-link')).toHaveAttribute(
        'href',
        /review=true/
      );

      // Retake: filled pill with an icon, not a transparent outline.
      const retake = completed.locator('.student-retake-btn');
      await expect(retake).toHaveText(/Retake/);
      await expect(retake.locator('svg')).toHaveCount(1);
      const retakeStyle = await retake.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { background: cs.backgroundColor, weight: cs.fontWeight };
      });
      expect(retakeStyle.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(retakeStyle.weight).toBe('600');

      // A click on the card body opens the detail modal (not the exam).
      await completed.locator('.student-exam-card-meta').click();
      const modal = page.locator('#exam-detail-modal');
      await expect(modal).toBeVisible();
      await expect(page.locator('#exam-detail-action')).toHaveText('View Results');
      await expect(page.locator('#exam-detail-action')).toHaveAttribute('href', /review=true/);
      await page.click('#exam-detail-action');
      await expect(page).toHaveURL(/exam\.html\?examId=[^&]+&review=true/);

      // Back to the list: the fresh exam opens the start screen.
      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await page.fill('#exam-search', 'Science Booster');
      const fresh = page.locator('.student-exam-card.new', { hasText: 'Science Booster' });
      await expect(fresh).toBeVisible({ timeout: 20000 });
      await expect(fresh).toHaveAttribute('data-href', /exam\.html\?examId=[^&]+$/);
      await expect(fresh.locator('.student-exam-card-link')).toHaveAttribute(
        'href',
        /exam\.html\?examId=[^&]+$/
      );
      expect(await fresh.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');

      // NEW: filled, uppercase, readable.
      const badge = fresh.locator('.student-new-badge');
      await expect(badge).toHaveText(/new/i);
      const badgeStyle = await badge.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { background: cs.backgroundColor, color: cs.color, transform: cs.textTransform };
      });
      expect(badgeStyle.transform).toBe('uppercase');
      expect(badgeStyle.background).not.toBe('rgba(0, 0, 0, 0)');
      expect(badgeStyle.color).toBe('rgb(255, 255, 255)');

      await fresh.locator('.student-exam-card-meta').click();
      await expect(page.locator('#exam-detail-modal')).toBeVisible();
      await expect(page.locator('#exam-detail-action')).toHaveText('Start Exam');
      await expect(page.locator('#exam-detail-action')).toHaveAttribute(
        'href',
        /exam\.html\?examId=[^&]+$/
      );
      await page.click('#exam-detail-action');
      await expect(page).toHaveURL(/exam\.html\?examId=[^&]+$/);
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
