import { test, expect } from '@playwright/test';
import { injectEmulatorConfig, waitForFirebase, signInAsAdmin, createTestExam, takeExamAsStudent } from './utils.js';

test.describe('Visual Layout Check - Desktop 1440px', () => {
  test('exam screen content constrained, sidebar hidden', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await injectEmulatorConfig(page);
    
    // Log in as admin
    await page.goto('/index.html?test=true');
    await page.evaluate(() => localStorage.setItem('testMode', 'true'));
    await signInAsAdmin(page);
    
    // Create exam
    const result = await createTestExam(page, {
      title: 'Layout Verification Exam',
      questions: [
        { text: 'What is the capital of France?', category: 'Geo', choices: ['London', 'Paris', 'Berlin', 'Madrid'], correctIndex: 1 },
        { text: 'What is 2 + 2?', category: 'Math', choices: ['3', '4', '5', '6'], correctIndex: 1 },
        { text: 'Which planet is the Red Planet?', category: 'Science', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1 },
      ]
    });
    
    const examId = result.examId;
    console.log('Created exam:', examId);
    
    // Navigate to exam as student
    await page.goto(`/exam.html?examId=${examId}&test=true`);
    await waitForFirebase(page);
    await page.waitForTimeout(500);
    
    // Start exam (student flow)
    await page.fill('#student-name', 'Visual Student');
    await page.fill('#student-email', 'visual@test.com');
    await page.click('#start-exam-btn');
    
    // Wait for exam screen fully rendered
    await page.waitForSelector('#exam-screen:not([hidden])', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Ensure desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);
    
    // TAKE SCREENSHOT: verify after fix
    await page.screenshot({ path: 'step-exam-desktop.png', fullPage: false });
    console.log('Screenshot saved to step-exam-desktop.png');
    
    // Detailed layout measurements
    const layout = await page.evaluate(() => {
      const examMain = document.querySelector('.exam-main');
      const examQuestionArea = document.querySelector('.exam-question-area');
      const examSidebar = document.querySelector('.exam-sidebar');
      const questionHeader = document.querySelector('.question-header');
      const timerBar = document.getElementById('timer-bar');
      const nextBtn = document.getElementById('next-btn');
      const prevBtn = document.getElementById('prev-btn');
      const submitBtn = document.getElementById('submit-exam-btn');
      
      const qaRect = examQuestionArea ? examQuestionArea.getBoundingClientRect() : null;
      
      return {
        windowWidth: window.innerWidth,
        timerBarHidden: timerBar?.hidden,
        questionHeaderDisplay: questionHeader ? getComputedStyle(questionHeader).display : 'N/A',
        questionHeaderText: questionHeader?.textContent?.substring(0, 60) || 'N/A',
        sidebarWidth: examSidebar ? getComputedStyle(examSidebar).width : 'N/A',
        sidebarMaxHeight: examSidebar ? getComputedStyle(examSidebar).maxHeight : 'N/A',
        sidebarOverflow: examSidebar ? getComputedStyle(examSidebar).overflow : 'N/A',
        areaMaxWidth: examQuestionArea ? getComputedStyle(examQuestionArea).maxWidth : 'N/A',
        areaWidth: qaRect ? Math.round(qaRect.width) : 0,
        areaFlex: examQuestionArea ? getComputedStyle(examQuestionArea).flex : 'N/A',
        areaMarginLeft: examQuestionArea ? getComputedStyle(examQuestionArea).marginLeft : 'N/A',
        areaMarginRight: examQuestionArea ? getComputedStyle(examQuestionArea).marginRight : 'N/A',
        areaLeft: qaRect ? Math.round(qaRect.left) : 0,
        areaRight: qaRect ? Math.round(qaRect.right) : 0,
        areaCenter: qaRect ? Math.round(qaRect.left + qaRect.width / 2) : 0,
        mainMaxWidth: examMain ? getComputedStyle(examMain).maxWidth : 'N/A',
        mainWidth: examMain ? examMain.offsetWidth : 0,
        nextBtnText: nextBtn?.textContent?.trim() || 'N/A',
        prevBtnHidden: prevBtn?.hidden,
        submitBtnText: submitBtn?.textContent?.trim() || 'N/A',
      };
    });
    console.log('DETAILED LAYOUT:', JSON.stringify(layout, null, 2));
  });
});
