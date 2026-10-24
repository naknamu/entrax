/**
 * Regression test for the portal's "Retake" and "View Results" actions.
 *
 * - "Retake" used to open exam.html without any flag, so the already-submitted
 *   check blocked the student instead of starting a new attempt.
 * - "View Results" passes &review=true, but exam.html ignored it and fell back
 *   to the start/already-submitted flow.
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin } from './utils.js';

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

async function countSubmissions(request, examId) {
  const response = await request.get(`${DOCS_URL}/submissions?pageSize=300`, {
    headers: OWNER_AUTH
  });
  const body = await response.json();
  return (body.documents || []).filter(doc => doc.fields?.examId?.stringValue === examId);
}

test.describe('Exam retake and review', () => {
  test('retakes an exam and reviews a submitted attempt', async ({ page, request }) => {
    const examId = `test-retake-${Date.now()}`;
    const studentEmail = `retake-${Date.now()}@test.com`;

    const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
      headers: OWNER_AUTH,
      data: {
        fields: {
          title: { stringValue: 'Retake regression exam' },
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
      // ── First attempt ───────────────────────────────────────────────────
      await page.goto(`/exam.html?examId=${examId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Retake Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const firstSubmissionId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => k.endsWith('_submissionId'));
        return key ? localStorage.getItem(key) : null;
      });
      expect(firstSubmissionId).toBeTruthy();

      await page.click('#choices-grid .choice-btn[data-choice-index="0"]');
      await page.click('#next-btn');
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await page.click('#submit-exam-btn');
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });

      // ── A plain visit still blocks a second attempt ─────────────────────
      await page.goto(`/exam.html?examId=${examId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Retake Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#already-submitted-screen:not([hidden])', { timeout: 20000 });

      // ── Retake starts a brand-new attempt ───────────────────────────────
      const retakeLink = page.locator('#already-submitted-screen .retake-exam-link');
      await expect(retakeLink).toBeVisible();
      await expect(retakeLink).toHaveAttribute('href', /retake=true/);
      await retakeLink.click();

      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Retake Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const secondSubmissionId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => k.endsWith('_submissionId'));
        return key ? localStorage.getItem(key) : null;
      });
      expect(secondSubmissionId).toBeTruthy();
      expect(secondSubmissionId).not.toBe(firstSubmissionId);

      // One submitted attempt + the new draft.
      const afterRetake = await countSubmissions(request, examId);
      expect(afterRetake.length).toBe(2);

      // ── Review shows the previous results, not the start form ───────────
      await page.goto(`/exam.html?examId=${examId}&review=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });

      await expect(page.locator('#submission-title')).toHaveText('Exam Results');
      await expect(page.locator('#results-display')).toBeVisible();
      await expect(page.locator('#results-review')).toBeVisible();
      await expect(page.locator('#score-percent')).toHaveText('100.0%');
      await expect(page.locator('#answer-breakdown .answer-item')).toHaveCount(2);
      await expect(page.locator('#start-screen')).toBeHidden();

      // Reviewing must not create another submission.
      const afterReview = await countSubmissions(request, examId);
      expect(afterReview.length).toBe(2);
    } finally {
      const docs = await countSubmissions(request, examId);
      for (const doc of docs) {
        await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, {
          headers: OWNER_AUTH
        });
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
    }
  });

  test('portal Retake link starts a new attempt for a signed-in student', async ({ page, request }) => {
    const examId = `test-portal-retake-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
      headers: OWNER_AUTH,
      data: {
        fields: {
          title: { stringValue: 'Portal retake exam' },
          createdBy: { stringValue: 'test-admin-uid' },
          createdAt: { timestampValue: nowIso },
          timeLimitMinutes: { integerValue: '60' },
          passingPercent: { integerValue: '50' },
          showResultsToStudent: { booleanValue: true },
          startDate: { timestampValue: '2020-01-01T00:00:00Z' },
          endDate: { timestampValue: '2999-01-01T00:00:00Z' },
          questions: {
            arrayValue: {
              values: [question('q1', 'Pick A', ['A', 'B'], 0, 'Alpha')]
            }
          }
        }
      }
    });
    expect(created.ok()).toBeTruthy();

    try {
      // Sign in first so the submission is linked to the actual admin uid (the
      // emulator may already contain an admin account created with another uid).
      await signInAsAdmin(page);
      await page.waitForFunction(() => window.__FIREBASE_AUTH__?.currentUser?.uid, null, { timeout: 20000 });
      const adminUid = await page.evaluate(() => window.__FIREBASE_AUTH__.currentUser.uid);

      // A submitted attempt belonging to the signed-in admin test account.
      const submission = await request.post(`${DOCS_URL}/submissions?documentId=portal-retake-sub-${Date.now()}`, {
        headers: OWNER_AUTH,
        data: {
          fields: {
            examId: { stringValue: examId },
            studentName: { stringValue: 'Test Admin' },
            studentEmail: { stringValue: 'admin@test.com' },
            studentUid: { stringValue: adminUid },
            startedAt: { timestampValue: nowIso },
            submittedAt: { timestampValue: nowIso },
            answers: {
              arrayValue: {
                values: [
                  {
                    mapValue: {
                      fields: {
                        questionId: { stringValue: 'q1' },
                        selectedIndex: { integerValue: '0' }
                      }
                    }
                  }
                ]
              }
            },
            questionOrder: { arrayValue: { values: [{ integerValue: '0' }] } },
            flaggedQuestions: { arrayValue: { values: [] } },
            score: { integerValue: '1' },
            totalQuestions: { integerValue: '1' },
            percentage: { integerValue: '100' },
            passed: { booleanValue: true },
            autoSubmitted: { booleanValue: false }
          }
        }
      });
      expect(submission.ok()).toBeTruthy();

      await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });

      await page.click('.student-nav-item[data-view="exams"]');
      const card = page.locator(`.student-exam-card[data-exam-id="${examId}"]`);
      await expect(card).toBeVisible({ timeout: 20000 });

      const retakeLink = card.locator('a', { hasText: 'Retake' });
      await expect(retakeLink).toHaveAttribute('href', /retake=true/);
      await retakeLink.click();

      await expect(page).toHaveURL(new RegExp(`exam\\.html\\?examId=${examId}&retake=true`));
      await expect(page.locator('#exam-screen')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#already-submitted-screen')).toBeHidden();
      await expect(page.locator('#start-screen')).toBeHidden();
    } finally {
      const docs = await countSubmissions(request, examId);
      for (const doc of docs) {
        await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, {
          headers: OWNER_AUTH
        });
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
    }
  });
});
