/**
 * Student results screen + exam sidebar polish.
 *
 * Covers:
 *  - "Back to Exams" at the top of the results page (above the score card);
 *  - the answer review as one collapsed <details> per section, with a
 *    questions / correct / incorrect summary in each header;
 *  - equal vertical spacing between the result cards;
 *  - question-number hover keeping readable contrast and the state colours in
 *    both light and dark mode.
 *
 * Run: npx playwright test tests/exam-results-review.spec.js
 */

import { test, expect } from '@playwright/test';
import { signInAsStudent, waitForFirebase } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };

// ─── Firestore REST encoding ────────────────────────────────────────────────

function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: toFields(value) } };
}

function toFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toValue(value)]));
}

const SECTIONS = [
  { id: 'sec-math', title: 'Math' },
  { id: 'sec-reading', title: 'Reading' }
];

function makeQuestion(id, text, sectionId, category, correctIndex) {
  return {
    id,
    text,
    sectionId,
    category,
    correctIndex,
    solution: `Worked solution for ${id}.`,
    choices: ['Option A', 'Option B', 'Option C', 'Option D']
  };
}

const QUESTIONS = [
  makeQuestion('q1', 'What is 2 + 2?', 'sec-math', 'Arithmetic', 1),
  makeQuestion('q2', 'What is 3 x 3?', 'sec-math', 'Arithmetic', 2),
  makeQuestion('q3', 'What is 10 / 2?', 'sec-math', 'Arithmetic', 3),
  makeQuestion('q4', 'What is the capital of France?', 'sec-reading', 'Reading', 2),
  makeQuestion('q5', 'Who wrote Romeo and Juliet?', 'sec-reading', 'Reading', 1)
];

async function createExam(request, examId) {
  const response = await request.patch(`${DOCS_URL}/exams/${examId}`, {
    headers: OWNER_AUTH,
    data: {
      fields: toFields({
        title: 'Results review exam',
        description: 'Sections, categories and solutions',
        status: 'published',
        createdBy: 'test-admin-uid',
        timeLimitMinutes: 60,
        passingPercent: 70,
        showResultsToStudent: true,
        randomizeQuestions: false,
        sections: SECTIONS,
        questions: QUESTIONS
      })
    }
  });
  expect(response.ok()).toBeTruthy();
}

async function cleanup(request, examId) {
  const submissions = await request.get(`${DOCS_URL}/submissions?pageSize=300`, { headers: OWNER_AUTH });
  const body = await submissions.json();
  for (const doc of body.documents || []) {
    if (doc.fields?.examId?.stringValue === examId) {
      await request.delete(`${DOCS_URL}/${doc.name.split('/documents/')[1]}`, { headers: OWNER_AUTH });
    }
  }
  await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
}

/** Sign in, open the exam and press Start. Leaves the page on the exam screen. */
async function startExam(page, examId, email) {
  await signInAsStudent(page);
  await page.goto(`/exam.html?examId=${examId}&manualStart=true`);
  await waitForFirebase(page);
  await page.waitForSelector('#start-screen:not([hidden])', { timeout: 20000 });
  await page.fill('#student-name', 'Results Student');
  await page.fill('#student-email', email);
  await page.click('#start-exam-btn');
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 20000 });
}

/** Hover the element and return the WCAG contrast ratio of its text vs its
 *  own background (the numbers sit on solid state-coloured chips). */
async function hoverContrast(locator) {
  await locator.hover();
  // Let the background-color transition finish before reading it.
  await locator.page().waitForTimeout(250);
  return locator.evaluate((el) => {
    const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = (c) => c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const styles = getComputedStyle(el);
    const fg = lum(rgb(styles.color));
    const bg = lum(rgb(styles.backgroundColor));
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
}

test.describe('Student results screen', () => {
  test('top nav, collapsed section summaries and even card spacing', async ({ page, request }) => {
    const examId = `test-results-${Date.now()}`;
    const email = `results-${Date.now()}@test.com`;
    await createExam(request, examId);

    try {
      await startExam(page, examId, email);

      // q1 correct, q2 wrong, q3 unanswered, q4 correct, q5 wrong.
      const answers = [1, 0, null, 2, 0];
      for (let i = 0; i < answers.length; i++) {
        if (answers[i] !== null) {
          await page.click(`#choices-grid .choice-btn[data-choice-index="${answers[i]}"]`);
        }
        if (i < answers.length - 1) {
          await page.click('#next-btn');
          await page.waitForTimeout(150);
        }
      }

      await page.click('#submit-exam-btn');
      await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
      await page.check('#confirm-submit');
      await page.click('#confirm-submit-btn');
      await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 20000 });

      // --- "Back to Exams" at the top, above the results header ---
      const topbar = page.locator('#submission-screen .results-topbar');
      await expect(topbar).toBeVisible();
      const backLink = topbar.locator('a[href="student.html#exams"]');
      await expect(backLink).toBeVisible();
      await expect(backLink).toContainText('Back to Exams');

      const topbarBox = await topbar.boundingBox();
      const titleBox = await page.locator('#submission-title').boundingBox();
      expect(topbarBox.y).toBeLessThan(titleBox.y);

      // --- Answer review: one collapsed section per exam section ---
      const sections = page.locator('#submission-screen .review-section');
      await expect(sections).toHaveCount(2);
      await expect(page.locator('#submission-screen .review-section-name')).toHaveText(['Math', 'Reading']);

      await expect(sections.nth(0)).not.toHaveAttribute('open', '');
      await expect(sections.nth(1)).not.toHaveAttribute('open', '');
      // Collapsed sections keep their questions out of sight.
      await expect(page.locator('#answer-breakdown .answer-item').first()).toBeHidden();

      // Summary: questions, correct, incorrect, unanswered.
      const math = sections.nth(0);
      await expect(math.locator('.review-section-stat').nth(0)).toHaveText('3 questions');
      await expect(math.locator('.review-section-stat--correct')).toHaveText('1 correct');
      await expect(math.locator('.review-section-stat--incorrect')).toHaveText('1 incorrect');
      await expect(math.locator('.review-section-stat--unanswered')).toHaveText('1 unanswered');

      const reading = sections.nth(1);
      await expect(reading.locator('.review-section-stat').nth(0)).toHaveText('2 questions');
      await expect(reading.locator('.review-section-stat--correct')).toHaveText('1 correct');
      await expect(reading.locator('.review-section-stat--incorrect')).toHaveText('1 incorrect');
      await expect(reading.locator('.review-section-stat--unanswered')).toHaveCount(0);

      // --- Even vertical rhythm between the result cards ---
      const gapBetween = async (upper, lower) => {
        const a = await page.locator(upper).boundingBox();
        const b = await page.locator(lower).boundingBox();
        return b.y - (a.y + a.height);
      };
      const gapAbove = await gapBetween('#results-display', '#category-breakdown-card');
      const gapBelow = await gapBetween('#category-breakdown-card', '#results-review');
      expect(gapAbove).toBeGreaterThan(0);
      expect(Math.abs(gapBelow - gapAbove)).toBeLessThanOrEqual(1);

      // --- Expanding a section reveals its questions ---
      await math.locator('summary').click();
      await expect(math).toHaveAttribute('open', '');
      await expect(page.locator('#answer-breakdown .answer-item').first()).toBeVisible();
      await expect(page.locator('#answer-breakdown .answer-item')).toHaveCount(5);
    } finally {
      await cleanup(request, examId);
    }
  });

  test('question-number hover keeps its state colours and readable contrast', async ({ page, request }) => {
    const examId = `test-hover-${Date.now()}`;
    const email = `hover-${Date.now()}@test.com`;
    await createExam(request, examId);

    try {
      await startExam(page, examId, email);

      // Answer q1 and move on, so the sidebar has a green (answered) number
      // behind the blue (current) one.
      await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
      await page.click('#next-btn');
      await page.waitForTimeout(150);

      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme });
        // Theme tokens transition; read the resting colours, not mid-fade.
        await page.waitForTimeout(250);

        const current = page.locator('.nav-btn.current').first();
        const answered = page.locator('.nav-btn.answered:not(.current)').first();
        const idle = page.locator('.nav-btn:not(.answered):not(.current):not(.flagged)').first();

        // The state colour must survive hover: hovering a green number must not
        // repaint it with the generic hover surface.
        const answeredBefore = await answered.evaluate((el) => getComputedStyle(el).backgroundColor);
        const answeredContrast = await hoverContrast(answered);
        const answeredAfter = await answered.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(answeredAfter).toBe(answeredBefore);

        const currentContrast = await hoverContrast(current);
        const idleContrast = await hoverContrast(idle);

        expect(answeredContrast).toBeGreaterThanOrEqual(4.5);
        expect(currentContrast).toBeGreaterThanOrEqual(4.5);
        expect(idleContrast).toBeGreaterThanOrEqual(4.5);

        // Hovering shows a readable label, not just a bare digit.
        await expect(idle).toHaveAttribute('title', /^Question \d+/);
      }
    } finally {
      await cleanup(request, examId);
    }
  });
});
