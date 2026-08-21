/**
 * Playwright tests for Exam Sections + Math Solutions
 * Run: npx playwright test tests/sections-solutions.spec.js
 *
 * Covers:
 *  - Creating an exam with named sections (Kaplan-style) and solutions
 *  - Start screen section list
 *  - Section badge shown with each question during the exam
 *  - Solutions are NOT visible during the exam
 *  - Results page groups by section and shows collapsible solutions
 *  - Admin detail view shows sections and solutions
 */

import { test, expect } from '@playwright/test';
import { waitForFirebase, signInAsAdmin } from './utils.js';

async function createSectionedExam(page) {
  await page.goto('/create-exam.html?test=true');
  await waitForFirebase(page);

  // Exam info
  await page.fill('#title', 'Sections & Solutions Exam ' + Date.now());
  await page.fill('#description', 'Multi-section exam with solutions');
  await page.fill('#timeLimitMinutes', '30');
  await page.fill('#passingPercent', '70');

  // Add two sections: Math and Reading
  await page.click('#add-section-btn');
  await page.fill('.section-title-input >> nth=0', 'Math');
  await page.click('#add-section-btn');
  await page.fill('.section-title-input >> nth=1', 'Reading');

  const questions = [
    {
      text: 'What is 2 + 2?',
      category: 'Math',
      choices: ['3', '4', '5', '6'],
      correctIndex: 1,
      section: 'Math',
      solution: '2 + 2 = 4.'
    },
    {
      text: 'What is 3 × 3?',
      category: 'Math',
      choices: ['6', '8', '9', '12'],
      correctIndex: 2,
      section: 'Math',
      solution: '3 × 3 = 9.'
    },
    {
      text: 'What is the capital of France?',
      category: 'Reading',
      choices: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctIndex: 2,
      section: 'Reading',
      solution: 'Paris is the capital of France.'
    },
    {
      text: 'Who wrote "Romeo and Juliet"?',
      category: 'Reading',
      choices: ['Dickens', 'Shakespeare', 'Austen', 'Twain'],
      correctIndex: 1,
      section: 'Reading',
      solution: 'William Shakespeare wrote Romeo and Juliet.'
    }
  ];

  for (let i = 0; i < questions.length; i++) {
    if (i > 0) {
      await page.click('#add-question-btn');
      await page.waitForTimeout(300);
    }
    const q = questions[i];
    const block = page.locator('.question-block').nth(i);

    await block.locator('textarea[name$="[text]"]').fill(q.text);
    await block.locator('input[name$="[category]"]').fill(q.category);
    await block.locator('textarea[name$="[solution]"]').fill(q.solution);
    await block.locator('select[name$="[sectionId]"]').selectOption({ label: q.section });
    for (let j = 0; j < 4; j++) {
      await block.locator(`input[name$="[choices][${j}]"]`).fill(q.choices[j]);
    }
    await block.locator(`input[type="radio"][value="${q.correctIndex}"]`).click();
  }

  await page.click('#submit-btn');
  await page.waitForSelector('.alert-success', { timeout: 10000 });

  const url = page.url();
  return new URL(url).searchParams.get('examId');
}

async function takeExamAndSubmit(page, examId) {
  await page.goto(`/exam.html?examId=${examId}&test=true`);
  await waitForFirebase(page);

  await page.fill('#student-name', 'Sections Student');
  await page.fill('#student-email', 'sections@test.com');
  await page.click('#start-exam-btn');
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });

  // Answer all 4 questions
  for (let i = 0; i < 4; i++) {
    const choiceIndex = [1, 2, 2, 1][i];
    await page.click(`#choices-grid .choice-btn[data-choice-index="${choiceIndex}"]`);
    if (i < 3) {
      await page.click('#next-btn');
      await page.waitForTimeout(250);
    }
  }

  await page.click('#submit-exam-btn');
  await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
  await page.check('#confirm-submit');
  await page.click('#confirm-submit-btn');
  await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 10000 });
}

test.describe('Exam sections & math solutions', () => {
  test('Create sectioned exam → sections shown → solutions on results', async ({ page }) => {
    await signInAsAdmin(page);
    // Tablet viewport so the question-nav sidebar (with section groups) is visible
    await page.setViewportSize({ width: 900, height: 800 });
    const examId = await createSectionedExam(page);
    expect(examId).toBeTruthy();

    // --- Start screen shows the section list (Kaplan-style) ---
    await page.goto(`/exam.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    await expect(page.locator('#start-sections')).toBeVisible();
    await expect(page.locator('.start-section-row')).toHaveCount(2);
    await expect(page.locator('.start-section-name')).toHaveText(['Math', 'Reading']);
    await expect(page.locator('.start-section-count').first()).toContainText('2 questions');
    await expect(page.locator('.start-section-count').nth(1)).toContainText('2 questions');

    // --- During the exam: section badge visible, NO solutions ---
    await page.fill('#student-name', 'Sections Student');
    await page.fill('#student-email', 'sections@test.com');
    await page.click('#start-exam-btn');
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });

    await expect(page.locator('#question-section')).toBeVisible();
    await expect(page.locator('#question-section')).toHaveText('Math');
    await expect(page.locator('#exam-screen .solution-block')).toHaveCount(0);

    // Sidebar groups question numbers under section headings (Kaplan-style)
    await expect(page.locator('.nav-section-header')).toHaveText(['Math', 'Reading']);

    // Navigate to the first Reading question via Next (sections stay contiguous)
    await page.click('#next-btn');
    await page.waitForTimeout(200);
    await page.click('#next-btn');
    await page.waitForTimeout(200);
    await expect(page.locator('#question-section')).toHaveText('Reading');

    // Back to the first question, then answer everything
    await page.click('#prev-btn');
    await page.waitForTimeout(150);
    await page.click('#prev-btn');
    await page.waitForTimeout(150);

    // Answer all 4 questions
    for (let i = 0; i < 4; i++) {
      const choiceIndex = [1, 2, 2, 1][i];
      await page.click(`#choices-grid .choice-btn[data-choice-index="${choiceIndex}"]`);
      if (i < 3) {
        await page.click('#next-btn');
        await page.waitForTimeout(250);
      }
    }
    await page.click('#submit-exam-btn');
    await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
    await page.check('#confirm-submit');
    await page.click('#confirm-submit-btn');
    await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 10000 });

    // --- Results page: grouped by section, solutions collapsible ---
    await expect(page.locator('.review-section-title')).toHaveText(['Math', 'Reading']);
    await expect(page.locator('.solution-toggle')).toHaveCount(4);
    await expect(page.locator('#solutions-controls')).toBeVisible();

    // Solutions are hidden until expanded
    await expect(page.locator('.solution-content >> nth=0')).toBeHidden();

    // Click one "Show Solution"
    await page.locator('.solution-toggle >> nth=0').click();
    await expect(page.locator('.solution-content >> nth=0')).toBeVisible();
    await expect(page.locator('.solution-content >> nth=0')).toContainText('2 + 2 = 4');

    // "Show All Solutions" expands every solution
    await page.click('#show-all-solutions-btn');
    await expect(page.locator('.solution-content')).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(page.locator('.solution-content >> nth=' + i)).toBeVisible();
    }
  });

  test('Admin detail view shows sections and solutions', async ({ page }) => {
    await signInAsAdmin(page);
    const examId = await createSectionedExam(page);

    // Student takes the exam
    await takeExamAndSubmit(page, examId);

    // Admin opens exam results
    await page.goto(`/exam-results.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    await page.waitForSelector('#submissions-tbody .view-detail-btn', { timeout: 10000 });
    await page.click('#submissions-tbody .view-detail-btn');
    await page.waitForSelector('#detail-view:not([hidden])', { timeout: 5000 });

    await expect(page.locator('#detail-content')).toContainText('Answer Breakdown');
    await expect(page.locator('#detail-content .review-section-title')).toHaveText(['Math', 'Reading']);
    await expect(page.locator('#detail-content .solution-toggle')).toHaveCount(4);

    // Expand a solution
    await page.locator('#detail-content .solution-toggle >> nth=0').click();
    await expect(page.locator('#detail-solution-content-0')).toBeVisible();
    await expect(page.locator('#detail-solution-content-0')).toContainText('2 + 2 = 4');
  });
});
