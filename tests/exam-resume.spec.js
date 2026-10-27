/**
 * Attempt-resilience regression test (Phase 0.4).
 *
 * A direct-link (anonymous) student who reloads mid-exam must get their
 * in-progress attempt back — same answers, same submission, remaining time
 * derived from the saved start time — and must still be able to submit.
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };

const TIME_LIMIT_MINUTES = 30;

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

async function listSubmissionsForExam(request, examId) {
  const response = await request.get(`${DOCS_URL}/submissions?pageSize=300`, {
    headers: OWNER_AUTH
  });
  const body = await response.json();
  return (body.documents || []).filter(doc => doc.fields?.examId?.stringValue === examId);
}

async function seedResumeExam(request, examId, title) {
  const response = await request.patch(`${DOCS_URL}/exams/${examId}`, {
    headers: OWNER_AUTH,
    data: {
      fields: {
        title: { stringValue: title },
        status: { stringValue: 'published' },
        createdBy: { stringValue: 'test-admin-uid' },
        timeLimitMinutes: { integerValue: String(TIME_LIMIT_MINUTES) },
        passingPercent: { integerValue: '50' },
        showResultsToStudent: { booleanValue: true },
        startDate: { timestampValue: '2020-01-01T00:00:00Z' },
        endDate: { timestampValue: '2999-01-01T00:00:00Z' },
        questions: {
          arrayValue: {
            values: [
              question('q1', 'Pick A', ['A', 'B', 'C'], 0, 'Alpha'),
              question('q2', 'Pick B', ['A', 'B', 'C'], 1, 'Beta'),
              question('q3', 'Pick C', ['A', 'B', 'C'], 2, 'Gamma')
            ]
          }
        }
      }
    }
  });
  expect(response.ok()).toBeTruthy();
}

test.describe('Exam attempt resilience', () => {
  test('reload resumes the in-progress attempt with answers and remaining time', async ({ page, request }) => {
    const examId = `test-resume-${Date.now()}`;
    const studentEmail = `resume-${Date.now()}@test.com`;

    const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
      headers: OWNER_AUTH,
      data: {
        fields: {
          title: { stringValue: 'Resume regression exam' },
          status: { stringValue: 'published' },
          createdBy: { stringValue: 'test-admin-uid' },
          timeLimitMinutes: { integerValue: String(TIME_LIMIT_MINUTES) },
          passingPercent: { integerValue: '50' },
          showResultsToStudent: { booleanValue: true },
          startDate: { timestampValue: '2020-01-01T00:00:00Z' },
          endDate: { timestampValue: '2999-01-01T00:00:00Z' },
          questions: {
            arrayValue: {
              values: [
                question('q1', 'Pick A', ['A', 'B', 'C'], 0, 'Alpha'),
                question('q2', 'Pick B', ['A', 'B', 'C'], 1, 'Beta'),
                question('q3', 'Pick C', ['A', 'B', 'C'], 2, 'Gamma')
              ]
            }
          }
        }
      }
    });
    expect(created.ok()).toBeTruthy();

    try {
      // Graded attempts require a real identity now.
      await signInAsStudent(page);
      await page.goto(`/exam.html?examId=${examId}&manualStart=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Resume Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const submissionId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find(k => k.endsWith('_submissionId'));
        return key ? localStorage.getItem(key) : null;
      });
      expect(submissionId).toBeTruthy();

      // Answer question 1 and wait for the debounced autosave to reach Firestore.
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await expect(page.locator('#choices-grid .choice-btn[data-choice-index="1"]'))
        .toHaveClass(/selected/);

      await expect.poll(async () => {
        const response = await request.get(`${DOCS_URL}/submissions/${submissionId}`, {
          headers: OWNER_AUTH
        });
        if (!response.ok()) return null;
        const body = await response.json();
        const answers = body.fields?.answers?.arrayValue?.values || [];
        return answers[0]?.mapValue?.fields?.selectedIndex?.integerValue ?? null;
      }, { timeout: 15000 }).toBe('1');

      // Let a little time elapse so the resumed timer must be below the limit.
      await page.waitForTimeout(1200);

      // ── Reload: the exam screen must come back with the same answer ──────
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
      await expect(page.locator('#start-screen')).toBeHidden();
      await expect(page.locator('#choices-grid .choice-btn[data-choice-index="1"]'))
        .toHaveClass(/selected/);
      await expect(page.locator('#choices-grid .choice-btn[data-choice-index="0"]'))
        .not.toHaveClass(/selected/);

      // Timer is derived from the saved start time, not restarted at full.
      const timerText = (await page.textContent('#timer-display')).trim();
      expect(timerText).toMatch(/^\d{2}:\d{2}$/);
      const [minutes, seconds] = timerText.split(':').map(Number);
      const remainingSeconds = minutes * 60 + seconds;
      expect(remainingSeconds).toBeLessThan(TIME_LIMIT_MINUTES * 60);
      expect(remainingSeconds).toBeGreaterThan(0);

      // The resumed attempt reuses the same document (no duplicate draft).
      expect(await listSubmissionsForExam(request, examId)).toHaveLength(1);

      // ── Submitting still works ──────────────────────────────────────────
      await page.click('#submit-exam-btn');
      await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });

      const submissions = await listSubmissionsForExam(request, examId);
      expect(submissions).toHaveLength(1);
      expect(submissions[0].fields?.submittedAt?.timestampValue).toBeTruthy();
      const savedAnswers = submissions[0].fields?.answers?.arrayValue?.values || [];
      expect(savedAnswers[0]?.mapValue?.fields?.selectedIndex?.integerValue).toBe('1');

      // ── Review still works after the exam window closes ─────────────────
      const closed = await request.patch(`${DOCS_URL}/exams/${examId}?updateMask.fieldPaths=endDate`, {
        headers: OWNER_AUTH,
        data: { fields: { endDate: { timestampValue: '2020-02-01T00:00:00Z' } } }
      });
      expect(closed.ok()).toBeTruthy();

      await page.goto(`/exam.html?examId=${examId}&review=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });
      await expect(page.locator('#score-percent')).toBeVisible();
    } finally {
      const docs = await listSubmissionsForExam(request, examId);
      for (const doc of docs) {
        await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, {
          headers: OWNER_AUTH
        });
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
    }
  });

  test('?retake=true discards the draft and starts a fresh attempt', async ({ page, request }) => {
    const examId = `test-retake-draft-${Date.now()}`;
    const studentEmail = `retake-draft-${Date.now()}@test.com`;

    await seedResumeExam(request, examId, 'Retake-with-draft regression exam');

    const readSubmissionId = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('_submissionId'));
      return key ? localStorage.getItem(key) : null;
    });

    try {
      // Start an attempt and answer the first question.
      await signInAsStudent(page);
      await page.goto(`/exam.html?examId=${examId}&manualStart=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Retake Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await expect(page.locator('#choices-grid .choice-btn[data-choice-index="1"]'))
        .toHaveClass(/selected/);

      const firstId = await readSubmissionId();
      expect(firstId).toBeTruthy();

      // Plain reload resumes the same attempt.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
      expect(await readSubmissionId()).toBe(firstId);

      // An explicit retake must NOT resume the old draft.
      await page.goto(`/exam.html?examId=${examId}&retake=true&manualStart=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
      await page.fill('#student-name', 'Retake Tester');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const secondId = await readSubmissionId();
      expect(secondId).toBeTruthy();
      expect(secondId).not.toBe(firstId);

      // Fresh attempt: no answer carried over, and only the new draft exists.
      await expect(page.locator('#choices-grid .choice-btn.selected')).toHaveCount(0);
      const drafts = await listSubmissionsForExam(request, examId);
      expect(drafts).toHaveLength(1);
      expect(drafts[0].name.split('/').pop()).toBe(secondId);
      expect(drafts[0].fields?.submittedAt?.timestampValue).toBeUndefined();
    } finally {
      const docs = await listSubmissionsForExam(request, examId);
      for (const doc of docs) {
        await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, {
          headers: OWNER_AUTH
        });
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
    }
  });
});
