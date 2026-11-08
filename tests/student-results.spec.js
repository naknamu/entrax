/**
 * The standalone printable results page (student-results.html) and the links
 * that reach it.
 *
 * The page existed but was malformed, was not a Vite entry, and had no inbound
 * links, so a student could never open it. It now ships with the build and is
 * linked from the exam results screen and the portal's exam detail modal.
 *
 * Run: npx playwright test tests/student-results.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, seedSubmission, deleteFirestoreDoc } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };

function question(id, text, choices, correctIndex, category) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: id },
        text: { stringValue: text },
        category: { stringValue: category },
        choices: { arrayValue: { values: choices.map(c => ({ stringValue: c })) } },
        correctIndex: { integerValue: String(correctIndex) }
      }
    }
  };
}

test.describe('Printable results page', () => {
  test('submission screen links to it and it renders the attempt', async ({ page, request }) => {
    const examId = `test-printable-${Date.now()}`;
    const studentEmail = `printable-${Date.now()}@test.com`;

    const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
      headers: OWNER_AUTH,
      data: {
        fields: {
          title: { stringValue: 'Printable results exam' },
          status: { stringValue: 'published' },
          createdBy: { stringValue: 'test-admin-uid' },
          timeLimitMinutes: { integerValue: '60' },
          passingPercent: { integerValue: '50' },
          showResultsToStudent: { booleanValue: true },
          startDate: { timestampValue: '2020-01-01T00:00:00Z' },
          endDate: { timestampValue: '2999-01-01T00:00:00Z' },
          questions: {
            arrayValue: {
              values: [
                question('q1', 'Pick A', ['A', 'B'], 0, 'Alpha'),
                question('q2', 'Pick B', ['A', 'B'], 1, 'Beta')
              ]
            }
          }
        }
      }
    });
    expect(created.ok()).toBeTruthy();

    try {
      await signInAsStudent(page);
      await page.goto(`/exam.html?examId=${examId}&manualStart=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Printable Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      await page.click('#choices-grid .choice-btn[data-choice-index="0"]');
      await page.click('#next-btn');
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await page.click('#submit-exam-btn');
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });

      // ── Entry point 1: the results screen itself ──────────────────────
      const printableLink = page.locator('#printable-results-link');
      await expect(printableLink).toBeVisible();
      const href = await printableLink.getAttribute('href');
      expect(href).toContain('student-results.html?submissionId=');
      const submissionId = new URL(href, 'http://localhost').searchParams.get('submissionId');
      expect(submissionId).toBeTruthy();

      await printableLink.click();
      await page.waitForURL(/student-results\.html/, { timeout: 20000 });

      // ── The page renders the same attempt ─────────────────────────────
      await expect(page.locator('#results-body')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#results-loading')).toBeHidden();
      await expect(page.locator('#score-percent')).toHaveText('100.0%');
      await expect(page.locator('#verdict-title')).toHaveText('You Passed!');
      await expect(page.locator('#score-correct')).toHaveText('2');
      // Review sections start collapsed, but the questions are all there.
      await expect(page.locator('#answer-breakdown .answer-item')).toHaveCount(2);
      await expect(page.locator('#print-results-btn')).toBeVisible();
      await expect(page.locator('.results-back-btn')).toHaveAttribute('href', /student\.html/);
      await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');

      // The page is the owner's own attempt: it is linked, not guessed at.
      expect(page.url()).toContain(`submissionId=${submissionId}`);
    } finally {
      await deleteFirestoreDoc(request, `exams/${examId}`).catch(() => {});
    }
  });

  test('portal exam modal links to the printable results page', async ({ page, request }) => {
    const email = `printable-modal-${Date.now()}@test.com`;
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
      const printLink = page.locator('#exam-detail-score .student-exam-modal-print');
      await expect(printLink).toBeVisible();
      await expect(printLink).toHaveAttribute('href', /student-results\.html\?submissionId=/);

      await printLink.click();
      await page.waitForURL(/student-results\.html/, { timeout: 20000 });
      await expect(page.locator('#results-body')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#score-percent')).toHaveText('82.0%');
    } finally {
      for (const path of created) await deleteFirestoreDoc(request, path);
    }
  });

  test('signed-out visitors are sent to the portal with a return link', async ({ page }) => {
    await page.goto('/student-results.html?submissionId=some-attempt', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/student\.html\?next=/, { timeout: 20000 });
    expect(decodeURIComponent(page.url())).toContain('student-results.html?submissionId=some-attempt');
  });
});
