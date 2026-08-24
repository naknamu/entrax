/**
 * Test utilities for Playwright tests
 */
import { test, expect } from '@playwright/test';

// Test data
export const TEST_ADMIN_EMAIL = 'admin@test.com';
export const TEST_ADMIN_PASSWORD = 'password123';
export const TEST_STUDENT_NAME = 'John Doe';
export const TEST_STUDENT_EMAIL = 'student@test.com';

/**
 * Inject Firebase emulator configuration into the page
 * This must be called before the page loads any Firebase SDK
 */
export async function injectEmulatorConfig(page) {
  await page.addInitScript(() => {
    // Configure Firebase to use emulators
    window.__FIREBASE_EMULATOR_CONFIG__ = {
      auth: 'http://localhost:9099',
      firestore: 'http://localhost:8081'
    };
    
    // Override firebaseConfig to use demo values
    window.firebaseConfig = {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-test",
      storageBucket: "demo-test.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef123456"
    };
  });
}

/**
 * Wait for Firebase to be initialized in the page
 */
export async function waitForFirebase(page) {
  // Add console/error listeners for debugging
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
  
  await page.waitForFunction(() => {
    return window.__FIREBASE_APP__ !== undefined;
  }, { timeout: 30000 });
}

/**
 * Sign in as admin
 */
export async function signInAsAdmin(page) {
  await page.goto('/index.html?test=true', { waitUntil: 'networkidle' });
  
  // Wait for the login form to be visible
  await page.waitForSelector('#login-form', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
  await page.waitForSelector('#password', { state: 'visible', timeout: 30000 });
  
  await page.fill('#email', TEST_ADMIN_EMAIL);
  await page.fill('#password', TEST_ADMIN_PASSWORD);
  await page.click('#login-form button[type="submit"]');
  // Wait for redirect to dashboard (could be /admin-dashboard or /admin-dashboard.html)
  await page.waitForURL('**/admin-dashboard*', { timeout: 10000 });
  await waitForFirebase(page);
}

/**
 * Create a test exam
 */
export async function createTestExam(page, examData = {}) {
  const defaultExam = {
    title: 'Test Exam ' + Date.now(),
    description: 'A test exam for automated testing',
    timeLimitMinutes: 30,
    passingPercent: 70,
    showResultsToStudent: true,
    randomizeQuestions: false,
    allowPrevious: true,
    questions: [
      {
        text: 'What is 2 + 2?',
        category: 'Math',
        choices: ['3', '4', '5', '6'],
        correctIndex: 1
      },
      {
        text: 'What is the capital of France?',
        category: 'Geography',
        choices: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctIndex: 2
      },
      {
        text: 'Which planet is known as the Red Planet?',
        category: 'Science',
        choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
        correctIndex: 1
      }
    ]
  };

  const exam = { ...defaultExam, ...examData };

  await page.goto('/create-exam.html?test=true');
  await waitForFirebase(page);

  // Fill exam info
  await page.fill('#title', exam.title);
  await page.fill('#description', exam.description);
  await page.fill('#timeLimitMinutes', exam.timeLimitMinutes.toString());
  await page.fill('#passingPercent', exam.passingPercent.toString());
  if (exam.showResultsToStudent) await page.check('#showResultsToStudent');
  if (exam.randomizeQuestions) await page.check('#randomizeQuestions');
  if (exam.allowPrevious) await page.check('#allowPrevious');

  // Add questions
  for (let i = 0; i < exam.questions.length; i++) {
    if (i > 0) {
      await page.click('#add-question-btn');
      await page.waitForTimeout(500);
    }

    const q = exam.questions[i];
    const block = page.locator('.question-block').nth(i);

    await block.locator('textarea[name$="[text]"]').fill(q.text);
    await block.locator('input[name$="[category]"]').fill(q.category || '');

    for (let j = 0; j < 4; j++) {
      await block.locator(`input[name$="[choices][${j}]"]`).fill(q.choices[j]);
    }

    // Select correct answer
    await block.locator(`input[type="radio"][value="${q.correctIndex}"]`).click();
  }

  // Submit
  await page.click('#submit-btn');
  await page.waitForSelector('.alert-success', { timeout: 10000 });

  // Get exam ID from URL
  const url = page.url();
  const examId = new URL(url).searchParams.get('examId');
  
  return { examId, ...exam };
}

/**
 * Take exam as student
 */
export async function takeExamAsStudent(page, examId, studentData = {}) {
  const student = {
    name: studentData.name || TEST_STUDENT_NAME,
    email: studentData.email || TEST_STUDENT_EMAIL
  };

  await page.goto(`/exam.html?examId=${examId}&test=true`);
  await waitForFirebase(page);

  // Fill start screen
  await page.fill('#student-name', student.name);
  await page.fill('#student-email', student.email);
  await page.click('#start-exam-btn');

  // Wait for exam screen
  await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });

  return student;
}

/**
 * Answer all questions
 */
export async function answerAllQuestions(page, answers) {
  // answers is an array of choice indices (0-3)
  for (let i = 0; i < answers.length; i++) {
    const choiceIndex = answers[i];
    
    // Click the choice
    const choiceBtn = page.locator(`#choices-grid .choice-btn[data-choice-index="${choiceIndex}"]`).first();
    await choiceBtn.click();
    
    // Go to next question if not last
    if (i < answers.length - 1) {
      await page.click('#next-btn');
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Submit exam
 */
export async function submitExam(page) {
  await page.click('#submit-exam-btn');
  await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
  await page.check('#confirm-submit');
  await page.click('#confirm-submit-btn');
  await page.waitForSelector('#submission-screen:not([hidden])', { timeout: 10000 });
}

/**
 * Get exam results
 */
export async function getExamResults(page) {
  const percentText = await page.textContent('#score-percent');
  const correctText = await page.textContent('#score-correct');
  const incorrectText = await page.textContent('#score-incorrect');
  const unansweredText = await page.textContent('#score-unanswered');
  
  return {
    percent: percentText,
    correct: correctText,
    incorrect: incorrectText,
    unanswered: unansweredText
  };
}

/**
 * View results as admin
 */
export async function viewResultsAsAdmin(page, examId) {
  await page.goto(`/exam-results.html?examId=${examId}&test=true`);
  await waitForFirebase(page);
  await page.waitForSelector('#submissions-tbody tr', { timeout: 10000 });
}

/**
 * Export CSV
 */
export async function exportCSV(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.click('#export-csv-btn');
  const download = await downloadPromise;
  return download;
}

/**
 * Check if element is visible
 */
export async function isVisible(page, selector) {
  const element = page.locator(selector);
  return await element.isVisible();
}

/**
 * Wait for loading to complete
 */
export async function waitForLoading(page) {
  await page.waitForFunction(() => {
    const loading = document.querySelector('.spinner:not(.hidden)');
    return !loading;
  }, { timeout: 10000 }).catch(() => {}); // Ignore timeout
}
/**
 * Expand a create-exam accordion section (by its data-accordion name) when it
 * is collapsed. Header action buttons stay visible either way; only the body
 * controls are hidden, so tests that interact with body elements need this.
 */
export async function expandAccordion(page, name) {
  const section = page.locator(`.accordion-section:has(.accordion-toggle[data-accordion="${name}"])`);
  const isOpen = await section.evaluate((el) => el.classList.contains('open'));
  if (!isOpen) {
    await page.locator(`.accordion-toggle[data-accordion="${name}"]`).click();
    await page.waitForTimeout(350); // allow the open transition to finish
  }
}
