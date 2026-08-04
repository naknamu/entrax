/**
 * Smoke tests - Critical happy-path flows only
 * Run: npx playwright test tests/smoke.spec.js --project=chromium --retries=0 --workers=4 --timeout=60000
 */

import { test, expect } from '@playwright/test';
import { injectEmulatorConfig, waitForFirebase, signInAsAdmin, createTestExam, viewResultsAsAdmin } from './utils.js';

const TEST_ADMIN_EMAIL = 'admin@test.com';
const TEST_ADMIN_PASSWORD = 'password123';
const TEST_STUDENT_NAME = 'Smoke Test Student';
const TEST_STUDENT_EMAIL = 'smoke@test.com';

test.describe.configure({ retries: 0 });

test.describe('Smoke Tests - Core Happy Paths', () => {
  let examId;

  test.beforeAll(async ({ browser }) => {
    // Create one exam for all tests
    const page = await browser.newPage();
    // Set test mode in localStorage before any navigation
    await page.goto('/index.html?test=true');
    await page.evaluate(() => localStorage.setItem('testMode', 'true'));
    await signInAsAdmin(page);
    const result = await createTestExam(page, {
      title: 'Smoke Test Exam',
      questions: [
        { text: 'Q1: 2+2?', category: 'Math', choices: ['3', '4', '5', '6'], correctIndex: 1 },
        { text: 'Q2: Capital of France?', category: 'Geo', choices: ['London', 'Paris', 'Berlin', 'Madrid'], correctIndex: 1 }
      ]
    });
    examId = result.examId;
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Set test mode before each navigation
    await page.goto('/index.html?test=true');
    await page.evaluate(() => localStorage.setItem('testMode', 'true'));
  });

  // 1. Admin can log in and land on dashboard
  test('Admin login → dashboard', async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page).toHaveURL(/\/admin-dashboard\.html/);
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
  });

  // 2. Admin can create a minimal exam and it appears in dashboard
  test('Admin creates exam → appears in dashboard', async ({ page }) => {
    await signInAsAdmin(page);
    const result = await createTestExam(page, {
      title: 'Smoke Create Exam',
      questions: [
        { text: 'Q1?', category: 'Test', choices: ['A', 'B', 'C', 'D'], correctIndex: 0 },
        { text: 'Q2?', category: 'Test', choices: ['A', 'B', 'C', 'D'], correctIndex: 1 }
      ]
    });
    expect(result.examId).toBeTruthy();
    await expect(page).toHaveURL(/create-exam\.html\?examId=/);
    
    // Verify it appears in dashboard
    await page.goto('/admin-dashboard.html?test=true');
    await waitForFirebase(page);
    const examRows = page.locator('#exams-tbody tr');
    await expect(examRows).toHaveCount(1);
  });

  // 3. Exam link opens correctly in fresh context
  test('Exam link opens start screen', async ({ page }) => {
    await page.goto(`/exam.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    await expect(page.locator('#start-screen')).toBeVisible();
    await expect(page.locator('#exam-title-start')).toContainText('Smoke Test Exam');
    await expect(page.locator('#info-questions')).toContainText('2');
  });

  // 4. Student takes exam and submits successfully
  test('Student takes exam → submits → confirmation', async ({ page }) => {
    // Add console listener before navigation
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
    
    await page.goto(`/exam.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    
    await page.fill('#student-name', 'Smoke Test Student');
    await page.fill('#student-email', 'smoke@test.com');
    await page.click('#start-exam-btn');
    
    // Wait for exam screen to load
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('#choices-grid .choice-btn', { timeout: 10000 });
    
    // Q1
    await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
    await page.click('#next-btn');
    await page.waitForTimeout(500);
    
    // Wait for next question
    await page.waitForSelector('#choices-grid .choice-btn', { timeout: 10000 });
    
    // Q2
    await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
    
    // Submit
    await page.click('#submit-exam-btn');
    await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
    await page.check('#confirm-submit');
    await page.click('#confirm-submit-btn');
    
    await expect(page.locator('#submission-screen')).toBeVisible();
    await expect(page.locator('#submission-screen h1')).toContainText('Exam Submitted');
  });

  // 5. Submission appears on admin dashboard with correct score
  test('Submission appears on dashboard with correct score', async ({ page }) => {
    // Create a new exam for this test
    await signInAsAdmin(page);
    const result = await createTestExam(page, {
      title: 'Smoke Test Exam for Results',
      questions: [
        { text: 'Q1: 2+2?', category: 'Math', choices: ['3', '4', '5', '6'], correctIndex: 1 },
        { text: 'Q2: Capital of France?', category: 'Geo', choices: ['London', 'Paris', 'Berlin', 'Madrid'], correctIndex: 1 }
      ]
    });
    const testExamId = result.examId;
    
    // Take exam as student
    await page.goto(`/exam.html?examId=${testExamId}&test=true`);
    await waitForFirebase(page);
    
    await page.fill('#student-name', 'Smoke Test Student');
    await page.fill('#student-email', 'smoke@test.com');
    await page.click('#start-exam-btn');
    
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('#choices-grid .choice-btn', { timeout: 10000 });
    
    // Q1
    await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
    await page.click('#next-btn');
    await page.waitForTimeout(500);
    
    await page.waitForSelector('#choices-grid .choice-btn', { timeout: 10000 });
    
    // Q2
    await page.click('#choices-grid .choice-btn[data-choice-index="1"]');
    
    // Submit
    await page.click('#submit-exam-btn');
    await page.waitForSelector('#submit-confirm-modal:not([hidden])', { timeout: 5000 });
    await page.check('#confirm-submit');
    await page.click('#confirm-submit-btn');
    
    await expect(page.locator('#submission-screen')).toBeVisible();
    
    // Now check results as admin
    await signInAsAdmin(page);
    await viewResultsAsAdmin(page, testExamId);
    
    // Should have at least 1 submission
    const submissionRows = page.locator('#submissions-tbody tr');
    await expect(submissionRows).toHaveCount(1);
    
    const row = page.locator('#submissions-tbody tr').first();
    await expect(row.locator('td').nth(0)).toContainText('Smoke Test Student');
    await expect(row.locator('td').nth(1)).toContainText('smoke@test.com'); // Email
    await expect(row.locator('td').nth(2)).toContainText('2 / 2'); // Score
    await expect(row.locator('td').nth(3)).toContainText('100.0%'); // Percentage
    await expect(row.locator('td').nth(6)).toContainText('Passed'); // Status
  });
});