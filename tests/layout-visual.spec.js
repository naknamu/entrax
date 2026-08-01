import { test, expect } from '@playwright/test';
import { injectEmulatorConfig, waitForFirebase, signInAsAdmin } from './utils.js';

test.describe('Exam Layout Verification', () => {
  test('desktop viewport - verify layout constraints', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    
    // Navigate as admin first to ensure an exam exists
    await page.goto('/index.html?test=true');
    await page.evaluate(() => localStorage.setItem('testMode', 'true'));
    await signInAsAdmin(page);
    
    // Go to create exam to make one
    await page.goto('/create-exam.html?test=true');
    await waitForFirebase(page);
    await page.waitForTimeout(500);
    
    // Fill exam info (skip title validation for now, just create)
    await page.fill('#title', 'Layout Test Exam');
    await page.fill('#description', 'Testing layout');
    await page.fill('#timeLimitMinutes', '30');
    await page.fill('#passingPercent', '70');
    
    // Add first question
    await page.click('#add-question-btn');
    await page.waitForTimeout(300);
    
    // Fill first question  
    const blocks = page.locator('.question-block');
    const firstBlock = blocks.first();
    await firstBlock.locator('textarea[name$="[text]"]').fill('What is the capital of France?');
    await firstBlock.locator('input[name$="[choices][0]"]').fill('London');
    await firstBlock.locator('input[name$="[choices][1]"]').fill('Paris');
    await firstBlock.locator('input[name$="[choices][2]"]').fill('Berlin');
    await firstBlock.locator('input[name$="[choices][3]"]').fill('Madrid');
    await firstBlock.locator('input[type="radio"][value="1"]').check();
    
    // Add second question
    await page.click('#add-question-btn');
    await page.waitForTimeout(300);
    const secondBlock = blocks.nth(1);
    await secondBlock.locator('textarea[name$="[text]"]').fill('What is 2 + 2?');
    await secondBlock.locator('input[name$="[choices][0]"]').fill('3');
    await secondBlock.locator('input[name$="[choices][1]"]').fill('4');
    await secondBlock.locator('input[name$="[choices][2]"]').fill('5');
    await secondBlock.locator('input[name$="[choices][3]"]').fill('6');
    await secondBlock.locator('input[type="radio"][value="1"]').check();
    
    // Publish
    await page.click('#submit-btn');
    await page.waitForSelector('.alert-success', { timeout: 10000 });
    await page.waitForTimeout(500);
    
    // Extract exam ID from URL
    const examId = await page.evaluate(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('examId');
    });
    console.log('Created exam:', examId);
    
    // Navigate to the exam as a student
    await page.goto(`/exam.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    await page.waitForTimeout(1000);
    
    // Start the exam (student flow)
    await page.fill('#student-name', 'Layout Test Student');
    await page.fill('#student-email', 'layouttest@example.com');
    await page.click('#start-exam-btn');
    
    // Wait for exam screen
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Set viewport to 1440x900 (desktop)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    
    // Take screenshot
    await page.screenshot({ path: 'exam-after-fix.png', fullPage: false });
    console.log('Screenshot saved to exam-after-fix.png');
    
    // Capture layout metrics
    const layout = await page.evaluate(() => {
      const examMain = document.querySelector('.exam-main');
      const examQuestionArea = document.querySelector('.exam-question-area');
      const examSidebar = document.querySelector('.exam-sidebar');
      const questionHeader = document.querySelector('.question-header');
      const examScreen = document.getElementById('exam-screen');
      const timerBar = document.getElementById('timer-bar');
      const startScreen = document.getElementById('start-screen');
      return {
        examScreenHidden: examScreen?.hidden,
        startScreenHidden: startScreen?.hidden,
        mainMaxWidth: examMain ? getComputedStyle(examMain).maxWidth : 'N/A',
        mainPadding: examMain ? getComputedStyle(examMain).padding : 'N/A',
        areaMaxWidth: examQuestionArea ? getComputedStyle(examQuestionArea).maxWidth : 'N/A',
        areaFlex: examQuestionArea ? getComputedStyle(examQuestionArea).flex : 'N/A',
        areaWidth: examQuestionArea ? examQuestionArea.offsetWidth : 0,
        areaMargin: examQuestionArea ? getComputedStyle(examQuestionArea).marginLeft + ' ' + getComputedStyle(examQuestionArea).marginRight : 'N/A',
        sidebarWidth: examSidebar ? getComputedStyle(examSidebar).width : 'N/A',
        sidebarMaxHeight: examSidebar ? getComputedStyle(examSidebar).maxHeight : 'N/A',
        headerDisplay: questionHeader ? getComputedStyle(questionHeader).display : 'N/A',
        timerDisplay: timerBar ? getComputedStyle(timerBar).display : 'N/A',
        windowWidth: window.innerWidth,
      };
    });
    console.log('Layout info:', JSON.stringify(layout, null, 2));
  });
});
