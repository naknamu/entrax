/**
 * Regression test for exam submission robustness.
 *
 * A submission document is created when the exam starts and updated when the
 * student submits. If that document disappears mid-exam (another tab treats
 * the attempt as an abandoned draft and deletes it, or the data is reset), the
 * update is rejected by Firestore and the student sees
 * "Failed to submit exam. Please try again." The submit flow must recreate the
 * document instead of losing the attempt.
 */

import { test, expect } from '@playwright/test';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };

test.describe('Exam submission', () => {
  test('saves the attempt when the submission document is deleted mid-exam', async ({ page, request }) => {
    const examId = `test-submit-${Date.now()}`;
    const studentEmail = `draft-${Date.now()}@test.com`;

    const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
      headers: OWNER_AUTH,
      data: {
        fields: {
          title: { stringValue: 'Submit regression exam' },
          status: { stringValue: 'published' },
          createdBy: { stringValue: 'test-admin-uid' },
          timeLimitMinutes: { integerValue: '60' },
          showResultsToStudent: { booleanValue: true },
          startDate: { timestampValue: '2020-01-01T00:00:00Z' },
          endDate: { timestampValue: '2999-01-01T00:00:00Z' },
          questions: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      id: { stringValue: 'q1' },
                      text: { stringValue: 'Pick A' },
                      choices: {
                        arrayValue: { values: [{ stringValue: 'A' }, { stringValue: 'B' }] }
                      },
                      correctIndex: { integerValue: '0' }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    });
    expect(created.ok()).toBeTruthy();

    try {
      await page.goto(`/exam.html?examId=${examId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Draft Delete Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const submissionId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.endsWith('_submissionId'));
        return key ? localStorage.getItem(key) : null;
      });
      expect(submissionId).toBeTruthy();

      const deleted = await request.delete(`${DOCS_URL}/submissions/${submissionId}`, {
        headers: OWNER_AUTH
      });
      expect(deleted.ok()).toBeTruthy();

      await page.click('#submit-exam-btn');
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');

      await expect(page.locator('#submission-screen')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#exam-alert-container')).not.toContainText('Failed to submit');

      // The recreate path must not leave an orphaned draft behind: exactly one
      // submission document should exist for this exam.
      const afterSubmit = await request.get(`${DOCS_URL}/submissions?pageSize=300`, {
        headers: OWNER_AUTH
      });
      const afterBody = await afterSubmit.json();
      const submissionsForExam = (afterBody.documents || [])
        .filter((doc) => doc.fields?.examId?.stringValue === examId);
      expect(submissionsForExam).toHaveLength(1);

      // Students must be able to get back to the portal after submitting.
      const backToDashboard = page.locator('#submission-screen a[href="student.html#dashboard"]');
      await expect(backToDashboard).toBeVisible();
      await expect(page.locator('#submission-screen a[href="student.html#exams"]')).toBeVisible();

      await backToDashboard.click();
      await expect(page).toHaveURL(/student\.html#dashboard/);
      await expect(page.locator('#signin-view:not([hidden]), #portal-view:not([hidden])')).toBeVisible({ timeout: 20000 });
    } finally {
      const submissions = await request.get(`${DOCS_URL}/submissions?pageSize=300`, {
        headers: OWNER_AUTH
      });
      const body = await submissions.json();
      for (const doc of body.documents || []) {
        if (doc.fields?.examId?.stringValue === examId) {
          await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, {
            headers: OWNER_AUTH
          });
        }
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
    }
  });
});
