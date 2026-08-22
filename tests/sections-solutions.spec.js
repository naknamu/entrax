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
      solution: 'Paris is the capital of France.',
      passage: 'The honeybee is a small insect that lives in large colonies. Bees collect nectar from flowers and carry pollen from one bloom to another. This pollination helps many crops grow.'
    },
    {
      text: 'Who wrote "Romeo and Juliet"?',
      category: 'Reading',
      choices: ['Dickens', 'Shakespeare', 'Austen', 'Twain'],
      correctIndex: 1,
      section: 'Reading',
      solution: 'William Shakespeare wrote Romeo and Juliet.',
      passage: 'The honeybee is a small insect that lives in large colonies. Bees collect nectar from flowers and carry pollen from one bloom to another. This pollination helps many crops grow.'
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
    if (q.passage) {
      await block.locator('textarea[name$="[passage]"]').fill(q.passage);
    }
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
  test('Generate questions for Reading and Science sections (fill empty slots)', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/create-exam.html?test=true');
    await waitForFirebase(page);

    // Load the Kaplan template first (4 sections, 91 empty slots)
    await page.click('#kaplan-template-btn');
    await page.waitForSelector('.confirm-ok', { timeout: 5000 });
    await page.click('.confirm-ok');
    await page.waitForTimeout(500);
    await expect(page.locator('.question-block')).toHaveCount(91);

    // --- Reading tab ---
    await page.click('.generate-tab[data-gen-tab="reading"]');
    await expect(page.locator('.generate-tab.active')).toHaveText('Reading');
    // 7 reading topics checked (Week 1 skills) + recommended per-topic count 6 (7 x 6 = 42)
    await expect(page.locator('#generate-topics input[type="checkbox"]:checked')).toHaveCount(7);
    await expect(page.locator('#generate-count')).toHaveValue('6');
    // Auto-selects the matching exam section (READING)
    await expect(page.locator('#generate-section option:checked')).toHaveText('READING');

    await page.click('#generate-add-btn');
    await expect(page.locator('#generate-status')).toContainText('Added 42 generated Reading questions');
    await expect(page.locator('#generate-status')).toContainText('filled 22 empty slots in READING');

    // 42 of 91 slots filled + 20 appended => 111 blocks; READING badge = 42 questions
    await expect(page.locator('.question-block')).toHaveCount(111);
    await expect(page.locator('.section-row:has(.section-title-input[value="READING"]) .section-count-badge')).toHaveText('42 questions');

    // Generated reading blocks: question stem + SEPARATE passage field
    const readingState = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.question-block')].filter((b) => {
        const sel = b.querySelector('select[name$="[sectionId]"]');
        return sel && sel.options[sel.selectedIndex].textContent.trim() === 'READING';
      });
      const first = blocks[0];
      return {
        count: blocks.length,
        firstTextLen: first.querySelector('textarea[name$="[text]"]').value.trim().length,
        firstPassageLen: first.querySelector('textarea[name$="[passage]"]')?.value.trim().length || 0,
        category: first.querySelector('input[name$="[category]"]').value,
        hasSolution: first.querySelector('textarea[name$="[solution]"]').value.trim().length > 0,
        emptyLeft: blocks.filter((b) => !b.querySelector('textarea[name$="[text]"]').value.trim()).length
      };
    });
    expect(readingState.count).toBe(42);
    expect(readingState.firstTextLen).toBeGreaterThan(10); // question stem, not the passage
    expect(readingState.firstPassageLen).toBeGreaterThan(40); // passage lives in its own field
    expect(readingState.category).toBe('Reading');
    expect(readingState.hasSolution).toBe(true);
    expect(readingState.emptyLeft).toBe(0);

    // --- Science tab ---
    await page.click('.generate-tab[data-gen-tab="science"]');
    await expect(page.locator('#generate-topics input[type="checkbox"]:checked')).toHaveCount(10);
    await expect(page.locator('#generate-count')).toHaveValue('2');
    await expect(page.locator('#generate-section option:checked')).toHaveText('SCIENCE');

    await page.click('#generate-add-btn');
    await expect(page.locator('#generate-status')).toContainText('Added 20 generated Science questions');
    await expect(page.locator('#generate-status')).toContainText('filled 20 empty slots in SCIENCE');
    await expect(page.locator('.section-row:has(.section-title-input[value="SCIENCE"]) .section-count-badge')).toHaveText('20 questions');

    const scienceState = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.question-block')].filter((b) => {
        const sel = b.querySelector('select[name$="[sectionId]"]');
        return sel && sel.options[sel.selectedIndex].textContent.trim() === 'SCIENCE';
      });
      const allFilled = blocks.every((b) => b.querySelector('textarea[name$="[text]"]').value.trim());
      const allSolved = blocks.every((b) => b.querySelector('textarea[name$="[solution]"]').value.trim());
      return { count: blocks.length, allFilled, allSolved };
    });
    expect(scienceState).toEqual({ count: 20, allFilled: true, allSolved: true });
  });

  test('Load Kaplan template scaffolds 4 sections, 91 questions, 165 minutes', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/create-exam.html?test=true');
    await waitForFirebase(page);

    await page.click('#kaplan-template-btn');
    // Confirm the replace-current-content modal
    await page.waitForSelector('.confirm-ok', { timeout: 5000 });
    await page.click('.confirm-ok');
    await page.waitForTimeout(500);

    // Official 165-minute time limit
    await expect(page.locator('#timeLimitMinutes')).toHaveValue('165');

    // 4 official sections in order
    await expect(page.locator('.section-row')).toHaveCount(4);
    const titles = await page.locator('.section-title-input').evaluateAll(els => els.map(e => e.value));
    expect(titles).toEqual(['READING', 'MATH', 'WRITING', 'SCIENCE']);

    // Question counts per section: 22/28/21/20
    await expect(page.locator('.section-count-badge')).toHaveText(['22 questions', '28 questions', '21 questions', '20 questions']);

    // 91 question slots total
    await expect(page.locator('.question-block')).toHaveCount(91);

    // Every slot is assigned to its section (official distribution)
    const dist = await page.evaluate(() => {
      const counts = { READING: 0, MATH: 0, WRITING: 0, SCIENCE: 0 };
      document.querySelectorAll('.question-block').forEach(block => {
        const sel = block.querySelector('select[name$="[sectionId]"]');
        const label = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent.trim() : '';
        if (counts[label] !== undefined) counts[label]++;
      });
      return counts;
    });
    expect(dist).toEqual({ READING: 22, MATH: 28, WRITING: 21, SCIENCE: 20 });

    // Slots carry the section's category
    const mathCategories = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.question-block')];
      const math = blocks.filter(b => {
        const sel = b.querySelector('select[name$="[sectionId]"]');
        return sel && sel.options[sel.selectedIndex].textContent.trim() === 'MATH';
      });
      return math.map(b => b.querySelector('input[name$="[category]"]').value);
    });
    expect(mathCategories.every(c => c === 'MATH')).toBe(true);
  });

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
    // No passage on the Math question — panel stays hidden
    await expect(page.locator('#question-passage')).toBeHidden();

    // Sidebar groups question numbers under section headings (Kaplan-style)
    await expect(page.locator('.nav-section-header')).toHaveText(['Math', 'Reading']);

    // Navigate to the first Reading question via Next (sections stay contiguous)
    await page.click('#next-btn');
    await page.waitForTimeout(200);
    await page.click('#next-btn');
    await page.waitForTimeout(200);
    await expect(page.locator('#question-section')).toHaveText('Reading');
    // Passage panel shown once above the reading questions (not embedded)
    await expect(page.locator('#question-passage')).toBeVisible();
    await expect(page.locator('#question-passage-text')).toContainText('The honeybee is a small insect');

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

    // Shared reading passage appears ONCE in the review, followed by its questions
    await expect(page.locator('#submission-screen .review-passage')).toHaveCount(1);
    await expect(page.locator('#submission-screen .review-passage')).toContainText('The honeybee is a small insect');

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

    // Shared reading passage shown once in the admin detail view too
    await expect(page.locator('#detail-content .review-passage')).toHaveCount(1);
    await expect(page.locator('#detail-content .review-passage')).toContainText('The honeybee is a small insect');

    // Expand a solution
    await page.locator('#detail-content .solution-toggle >> nth=0').click();
    await expect(page.locator('#detail-solution-content-0')).toBeVisible();
    await expect(page.locator('#detail-solution-content-0')).toContainText('2 + 2 = 4');
  });
});
