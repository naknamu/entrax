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
 * Sign in as admin.
 *
 * Several tests take an exam as a student and then need the admin view in the
 * same browser context. A student session makes the admin login page redirect
 * to the portal, so the admin form never renders. Clear any session on
 * `student.html` first — it never redirects away — then use the login form.
 */
export async function signInAsAdmin(page) {
  await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__FIREBASE_AUTH__ !== undefined, null, {
    timeout: 20000,
  });
  await page
    .evaluate(async () => {
      const auth = window.__FIREBASE_AUTH__;
      if (!auth) return;
      // Restore the persisted session before deciding; signOut is a no-op when
      // there is none.
      await auth.authStateReady?.();
      await auth.signOut();
    })
    .catch(() => {});

  await page.goto('/admin-login.html?test=true', { waitUntil: 'domcontentloaded' });

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
 * Sign the current page's Firebase user out.
 *
 * Useful when a test acted as an admin (create an exam) and then needs the
 * direct-link student flow, where exam.html shows the name/email form. A
 * signed-in user is auto-started from the portal and would skip that form.
 */
export async function signOut(page) {
  const before = page.url();
  await page.evaluate(async () => {
    if (window.__FIREBASE_AUTH__) {
      await window.__FIREBASE_AUTH__.signOut();
    }
  });
  // Admin pages redirect to admin-login.html once signed out. Wait for that
  // navigation (bounded) so a following page.goto() isn't interrupted.
  await Promise.race([
    page.waitForURL(url => url.toString() !== before, { timeout: 2000 }).catch(() => {}),
    page.waitForTimeout(600)
  ]);
  await page.waitForLoadState('load').catch(() => {});
}

/**
 * Sign in as a real (magic-link) student through the Auth emulator.
 *
 * The app no longer allows anonymous graded attempts, so specs that used to
 * rely on a direct-link anonymous session must sign in first. The emulator
 * exposes the sign-in link in the portal's dev-mode panel; follow it and wait
 * for the portal view.
 */
export async function signInAsStudent(page, email = 'student@test.com') {
  await page.goto('/student.html', { waitUntil: 'domcontentloaded' });

  // Already signed in as a real user? Nothing to do.
  if (await page.locator('#portal-view').isVisible().catch(() => false)) return;

  await page.waitForSelector('#signin-form', { state: 'visible', timeout: 20000 });
  await page.fill('#signin-email', email);
  await page.click('#signin-btn');

  const devLink = page.locator('#signin-dev-link-anchor');
  await devLink.waitFor({ state: 'visible', timeout: 20000 });
  const href = await devLink.getAttribute('href');
  if (!href || href === '#') throw new Error('Auth emulator did not return a magic link');

  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#portal-view', { state: 'visible', timeout: 30000 });
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
 * Wait for the create-exam builder to finish its async init.
 *
 * The first empty question is added only after the admin auth check resolves,
 * so interacting before that point can skip UI that depends on existing
 * content — e.g. "Load Kaplan Template" shows its replace-content confirmation
 * only when a question or section already exists.
 */
export async function waitForExamBuilder(page) {
  await page.waitForSelector('.question-block', { timeout: 15000 });
}

/**
 * Expand a create-exam accordion section (by its data-accordion name) when it
 * is collapsed. Header action buttons stay visible either way; only the body
 * controls are hidden, so tests that interact with body elements need this.
 * Sections are exclusive-open: opening one collapses the rest.
 */
export async function expandAccordion(page, name) {
  const section = page.locator(`.accordion-section:has(.accordion-toggle[data-accordion="${name}"])`);
  const isOpen = await section.evaluate((el) => el.classList.contains('open'));
  if (!isOpen) {
    await page.locator(`.accordion-toggle[data-accordion="${name}"]`).click();
    await page.waitForTimeout(350); // allow the open transition to finish
  }
}
