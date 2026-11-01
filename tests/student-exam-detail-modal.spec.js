/**
 * Exam detail modal.
 *
 * Clicking an exam card used to navigate straight to the exam. It now opens a
 * details dialog first: title, description, the exam facts, and an explicit
 * Start Exam / Cancel choice (View Results + Retake once the exam is taken).
 *
 * Run: npx playwright test tests/student-exam-detail-modal.spec.js
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

test.describe('Exam detail modal', () => {
  test('a card opens the details with Start Exam and Cancel', async ({ page, request }) => {
    const email = `modal-${Date.now()}@test.com`;
    await signInAsStudent(page, email);

    const created = [];
    try {
      created.push(await createFirestoreDoc(request, 'exams', {
        title: 'Modal Science Exam',
        description: 'A short science check before the real thing.',
        status: 'published',
        passingPercent: 75,
        timeLimitMinutes: 40,
        createdAt: new Date(),
        questions: [question('Science'), question('Biology')],
      }));

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await page.fill('#exam-search', 'Modal Science Exam');

      const card = page.locator('.student-exam-card', { hasText: 'Modal Science Exam' });
      await expect(card).toBeVisible({ timeout: 20000 });
      await card.locator('.student-exam-card-title a').click();

      const modal = page.locator('#exam-detail-modal');
      await expect(modal).toBeVisible();
      await expect(page.locator('#exam-detail-title')).toHaveText('Modal Science Exam');
      await expect(page.locator('#exam-detail-desc')).toHaveText(
        'A short science check before the real thing.'
      );

      // The facts the card compresses, spelled out.
      const facts = page.locator('#exam-detail-facts');
      await expect(facts).toContainText('Questions');
      await expect(facts).toContainText('2');
      await expect(facts).toContainText('40 min');
      await expect(facts).toContainText('75%');

      // Fresh exam: Start Exam is the only action besides Cancel.
      const action = page.locator('#exam-detail-action');
      await expect(action).toHaveText('Start Exam');
      await expect(action).toHaveAttribute('href', /exam\.html\?examId=[^&]+$/);
      await expect(page.locator('#exam-detail-retake')).toBeHidden();
      await expect(page.locator('#exam-detail-score')).toBeHidden();

      // Cancel closes it and hands focus back to the card title.
      await page.click('#exam-detail-cancel');
      await expect(modal).toBeHidden();
      expect(
        await page.evaluate(() => document.activeElement?.classList.contains('student-exam-card-link'))
      ).toBe(true);

      // Escape closes it too.
      await card.locator('.student-exam-card-meta').click();
      await expect(modal).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();

      // As does a click on the backdrop.
      await card.locator('.student-exam-card-meta').click();
      await expect(modal).toBeVisible();
      await modal.click({ position: { x: 5, y: 5 } });
      await expect(modal).toBeHidden();

      // Start Exam is the real navigation.
      await card.locator('.student-exam-card-meta').click();
      await page.click('#exam-detail-action');
      await expect(page).toHaveURL(/exam\.html\?examId=[^&]+$/);
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });

  test('a completed exam shows the score, Retake and View Results', async ({ page, request }) => {
    const email = `modal-done-${Date.now()}@test.com`;
    await signInAsStudent(page, email);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);

    const created = [];
    try {
      created.push(await seedSubmission(request, { studentUid: uid, percentage: 82 }));

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
      await page.click('.student-nav-item[data-view="exams"]');
      await page.fill('#exam-search', 'Sample Exam for Testing');

      const card = page.locator('.student-exam-card', { hasText: 'Sample Exam for Testing' });
      await expect(card).toBeVisible({ timeout: 20000 });
      await card.locator('.student-exam-card-meta').click();

      await expect(page.locator('#exam-detail-modal')).toBeVisible();
      const score = page.locator('#exam-detail-score');
      await expect(score).toBeVisible();
      await expect(score).toContainText('82%');
      await expect(score.locator('.badge')).toHaveText('Passed');

      await expect(page.locator('#exam-detail-action')).toHaveText('View Results');
      await expect(page.locator('#exam-detail-action')).toHaveAttribute('href', /review=true/);
      await expect(page.locator('#exam-detail-retake')).toBeVisible();
      await expect(page.locator('#exam-detail-retake')).toHaveAttribute('href', /retake=true/);

      await page.click('#exam-detail-cancel');
      await expect(page.locator('#exam-detail-modal')).toBeHidden();
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });
});
