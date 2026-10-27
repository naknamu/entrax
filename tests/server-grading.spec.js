/**
 * Phase 0.3 end-to-end: server-side grading.
 *
 * Requires the Functions emulator on :5001 (npm run emulators). Run this file
 * on its own with `--workers=1`: it toggles the global
 * `config/features.serverGrading` switch, so it must not overlap other specs.
 *
 *   npx playwright test tests/server-grading.spec.js --workers=1
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || 'localhost:5001';

let functionsAvailable = false;

function question(id, text, choices) {
  // Deliberately NO correctIndex: the answer key lives in examKeys.
  return {
    mapValue: {
      fields: {
        id: { stringValue: id },
        text: { stringValue: text },
        category: { stringValue: 'ServerGrading' },
        choices: { arrayValue: { values: choices.map((choice) => ({ stringValue: choice })) } }
      }
    }
  };
}

async function listSubmissionsForExam(request, examId) {
  const response = await request.get(`${DOCS_URL}/submissions?pageSize=300`, {
    headers: OWNER_AUTH
  });
  const body = await response.json();
  return (body.documents || []).filter((doc) => doc.fields?.examId?.stringValue === examId);
}

async function seedServerGradedExam(request, examId) {
  const created = await request.patch(`${DOCS_URL}/exams/${examId}`, {
    headers: OWNER_AUTH,
    data: {
      fields: {
        title: { stringValue: 'Server grading regression exam' },
        status: { stringValue: 'published' },
        createdBy: { stringValue: 'test-admin-uid' },
        timeLimitMinutes: { integerValue: '30' },
        passingPercent: { integerValue: '50' },
        showResultsToStudent: { booleanValue: true },
        startDate: { timestampValue: '2020-01-01T00:00:00Z' },
        endDate: { timestampValue: '2999-01-01T00:00:00Z' },
        questions: {
          arrayValue: {
            values: [
              question('q1', 'Pick B', ['A', 'B', 'C']),
              question('q2', 'Pick C', ['A', 'B', 'C'])
            ]
          }
        }
      }
    }
  });
  expect(created.ok()).toBeTruthy();

  const keys = await request.patch(`${DOCS_URL}/examKeys/${examId}`, {
    headers: OWNER_AUTH,
    data: {
      fields: {
        answers: {
          mapValue: {
            fields: {
              q1: { integerValue: '1' },
              q2: { integerValue: '2' }
            }
          }
        }
      }
    }
  });
  expect(keys.ok()).toBeTruthy();
}

async function setServerGrading(request, enabled) {
  const response = await request.patch(`${DOCS_URL}/config/features`, {
    headers: OWNER_AUTH,
    data: {
      fields: {
        serverGrading: { booleanValue: enabled }
      }
    }
  });
  expect(response.ok()).toBeTruthy();
}

async function clearServerGrading(request) {
  await request.delete(`${DOCS_URL}/config/features`, { headers: OWNER_AUTH });
}

test.describe('Phase 0.3 server-side grading', () => {
  test.beforeAll(async ({ request }) => {
    try {
      // Any HTTP response means the Functions emulator is listening.
      await request.get(`http://${FUNCTIONS_HOST}/`, { timeout: 5000 });
      functionsAvailable = true;
    } catch {
      functionsAvailable = false;
    }
  });

  test('grades on the server, hides the key, and blocks score tampering', async ({ page, request }) => {
    test.skip(!functionsAvailable, `Functions emulator not reachable at ${FUNCTIONS_HOST}`);
    test.setTimeout(120000);

    const examId = `server-grading-${Date.now()}`;
    const studentEmail = `server-grading-${Date.now()}@test.com`;

    await seedServerGradedExam(request, examId);
    await setServerGrading(request, true);

    try {
      await signInAsStudent(page);
      await page.goto(`/exam.html?examId=${examId}&manualStart=true`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });

      // The exam doc must not carry correctIndex any more.
      const examResponse = await request.get(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
      const examBody = await examResponse.json();
      const questions = examBody.fields?.questions?.arrayValue?.values || [];
      for (const entry of questions) {
        expect(entry.mapValue.fields.correctIndex).toBeUndefined();
      }

      // The answer key must be unreadable to a student.
      const keyAccess = await page.evaluate(async ({ examId }) => {
        const firestoreUrl = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((name) => /firebase_firestore\.js/.test(name));
        const { doc, getDoc } = await import(firestoreUrl);
        try {
          await getDoc(doc(window.__FIREBASE_DB__, 'examKeys', examId));
          return 'allowed';
        } catch (error) {
          return error.code || String(error);
        }
      }, { examId });
      expect(keyAccess).toBe('permission-denied');

      await page.fill('#student-name', 'Server Grading Student');
      await page.fill('#student-email', studentEmail);
      await page.click('#start-exam-btn');
      await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });

      const submissionId = await page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.endsWith('_submissionId'));
        return key ? localStorage.getItem(key) : null;
      });
      expect(submissionId).toBeTruthy();

      // A client write to a grading field must be rejected while the switch is on.
      const tamper = await page.evaluate(async ({ submissionId }) => {
        const firestoreUrl = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((name) => /firebase_firestore\.js/.test(name));
        const { doc, updateDoc } = await import(firestoreUrl);
        try {
          await updateDoc(doc(window.__FIREBASE_DB__, 'submissions', submissionId), { score: 99, passed: true });
          return 'allowed';
        } catch (error) {
          return error.code || String(error);
        }
      }, { submissionId });
      expect(tamper).toBe('permission-denied');

      // Answer both questions correctly.
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await page.click('#next-btn');
      await page.waitForTimeout(300);
      await page.click('#choices-grid .choice-btn[data-choice-index="2"]');
      await page.click('#submit-exam-btn');
      await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 30000 });

      await expect(page.locator('#score-percent')).toHaveText('100.0%');
      await expect(page.locator('#results-review')).toBeVisible();
      await expect(page.locator('#answer-breakdown .answer-item')).toHaveCount(2);

      // The stored attempt is server-graded and carries the key for review.
      const submissions = await listSubmissionsForExam(request, examId);
      expect(submissions).toHaveLength(1);
      const fields = submissions[0].fields;
      expect(fields.gradedBy?.stringValue).toBe('server');
      expect(fields.score?.integerValue).toBe('2');
      const percentage = fields.percentage?.doubleValue ?? Number(fields.percentage?.integerValue);
      expect(percentage).toBe(100);
      expect(fields.submittedAt?.timestampValue).toBeTruthy();
      const storedAnswers = fields.answers?.arrayValue?.values || [];
      expect(storedAnswers[0]?.mapValue?.fields?.correctIndex?.integerValue).toBe('1');
      expect(storedAnswers[1]?.mapValue?.fields?.correctIndex?.integerValue).toBe('2');
    } finally {
      await clearServerGrading(request);
      const docs = await listSubmissionsForExam(request, examId);
      for (const doc of docs) {
        await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, { headers: OWNER_AUTH });
      }
      await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
      await request.delete(`${DOCS_URL}/examKeys/${examId}`, { headers: OWNER_AUTH });
    }
  });
});
