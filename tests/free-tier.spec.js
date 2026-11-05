/**
 * Free-tier boundary.
 *
 * The gate lives in `config/freeTier { enabled, examIds }`. A missing document,
 * `enabled: false`, or an empty `examIds` means "no gate" — the whole catalogue
 * stays open, so a config mistake cannot lock students out.
 *
 * Run: npx playwright test tests/free-tier.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, setFirestoreDoc, deleteFirestoreDoc } from './utils.js';

const SAMPLE = 'sample-exam-test-fixed-id';
const PAID = 'paid-exam-test-id';
const CONFIG_PATH = 'config/freeTier';

const paidExam = {
  title: 'Science Practice Set 99',
  description: 'A practice set behind the paywall',
  status: 'published',
  timeLimitMinutes: 20,
  passingPercent: 70,
  showResultsToStudent: true,
  randomizeQuestions: false,
  allowPrevious: true,
  questions: [
    {
      id: 'q1',
      text: 'What is 2 + 2?',
      category: 'Math',
      choices: ['3', '4', '5', '6'],
      correctIndex: 1,
      solution: 'Four.',
    },
  ],
};

async function openExams(page) {
  await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
  await page.click('.student-nav-item[data-view="exams"]');
  await expect(page.locator('#exam-list .student-exam-card').first()).toBeVisible({ timeout: 20000 });
  // The emulator accumulates exams from other specs, so the card under test can
  // otherwise land on a later page. Show the whole catalogue.
  await page.selectOption('#exam-page-size', '100');
}

function card(page, examId) {
  return page.locator(`#exam-list .student-exam-card[data-exam-id="${examId}"]`);
}

test.describe('Free tier', () => {
  test.beforeEach(async ({ request }) => {
    await setFirestoreDoc(request, `exams/${PAID}`, paidExam);
  });

  test.afterEach(async ({ request }) => {
    await deleteFirestoreDoc(request, CONFIG_PATH);
    await deleteFirestoreDoc(request, `exams/${PAID}`);
  });

  test('with no config the whole catalogue stays open', async ({ page }) => {
    await signInAsStudent(page, `tier-off-${Date.now()}@test.com`);
    await openExams(page);

    await expect(card(page, SAMPLE)).not.toHaveClass(/locked/);
    await expect(card(page, PAID)).not.toHaveClass(/locked/);
    await expect(card(page, PAID).getByRole('link', { name: 'Start Exam' })).toBeVisible();
  });

  test('an empty free list is treated as no gate', async ({ page, request }) => {
    await setFirestoreDoc(request, CONFIG_PATH, { enabled: true, examIds: [] });

    await signInAsStudent(page, `tier-empty-${Date.now()}@test.com`);
    await openExams(page);

    await expect(card(page, PAID)).not.toHaveClass(/locked/);
  });

  test('exams outside the free list are locked, the rest are not', async ({ page, request }) => {
    await setFirestoreDoc(request, CONFIG_PATH, { enabled: true, examIds: [SAMPLE] });

    await signInAsStudent(page, `tier-partial-${Date.now()}@test.com`);
    await openExams(page);

    await expect(card(page, SAMPLE)).not.toHaveClass(/locked/);
    await expect(card(page, SAMPLE).getByRole('link', { name: 'Start Exam' })).toBeVisible();

    const lockedCard = card(page, PAID);
    await expect(lockedCard).toHaveClass(/locked/);
    await expect(lockedCard.getByRole('link', { name: 'Unlock' })).toBeVisible();
  });

  test('the detail modal offers an upgrade instead of a start button', async ({ page, request }) => {
    await setFirestoreDoc(request, CONFIG_PATH, { enabled: true, examIds: [SAMPLE] });

    await signInAsStudent(page, `tier-modal-${Date.now()}@test.com`);
    await openExams(page);

    await card(page, PAID).getByRole('link', { name: /Science Practice Set 99/ }).click();

    const action = page.locator('#exam-detail-action');
    await expect(action).toBeVisible();
    await expect(action).toHaveText('Unlock full access');
    await expect(action).toHaveAttribute('href', '#settings');
  });

  test('a direct link to a locked exam shows the paywall', async ({ page, request }) => {
    await setFirestoreDoc(request, CONFIG_PATH, { enabled: true, examIds: [PAID] });

    await signInAsStudent(page, `tier-direct-${Date.now()}@test.com`);
    await page.goto(`/exam.html?examId=${SAMPLE}&manualStart=true`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#exam-closed-screen')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#closed-title')).toHaveText('This set needs an Exam Pass');
    await expect(page.locator('#exam-closed-action')).toBeVisible();
    await expect(page.locator('#exam-closed-action a[href="student.html#settings"]')).toBeVisible();
  });

  test('an active plan unlocks a locked exam', async ({ page, request }) => {
    await setFirestoreDoc(request, CONFIG_PATH, { enabled: true, examIds: [PAID] });

    await signInAsStudent(page, `tier-paid-${Date.now()}@test.com`);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    const path = `entitlements/${uid}`;

    try {
      await setFirestoreDoc(request, path, {
        plan: 'pass',
        source: 'paddle',
        accessUntil: new Date(Date.now() + 30 * 86400000),
        updatedAt: new Date(),
      });

      await openExams(page);

      await expect(card(page, SAMPLE)).not.toHaveClass(/locked/);
      await expect(card(page, SAMPLE).getByRole('link', { name: 'Start Exam' })).toBeVisible();
    } finally {
      await deleteFirestoreDoc(request, path);
    }
  });
});
