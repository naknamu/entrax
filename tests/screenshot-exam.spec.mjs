import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('screenshot exam page before fix', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8080/exam.html?examId=sample-exam-1785219663501&token=test-token', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });
  
  await page.waitForTimeout(5000);
  
  // Check what's visible
  const startScreen = await page.locator('#start-screen').evaluate(el => ({
    hidden: el.hidden,
    className: el.className,
    style: el.style.cssText,
    display: window.getComputedStyle(el).display,
    visibility: window.getComputedStyle(el).visibility
  }));
  const examScreen = await page.locator('#exam-screen').evaluate(el => ({
    hidden: el.hidden,
    className: el.className,
    style: el.style.cssText,
    display: window.getComputedStyle(el).display,
    visibility: window.getComputedStyle(el).visibility
  }));
  console.log('start-screen:', startScreen);
  console.log('exam-screen:', examScreen);
  
  // Check all exam screens
  const screens = await page.locator('.exam-screen').evaluateAll(els => 
    els.map(el => ({
      id: el.id,
      hidden: el.hidden,
      className: el.className,
      display: window.getComputedStyle(el).display
    }))
  );
  console.log('All screens:', screens);
  
  // Save screenshot anyway
  const screenshotPath = path.join(process.cwd(), 'exam-before-fix.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);
  
  // Get HTML structure
  const bodyHtml = await page.locator('body').innerHTML();
  console.log('=== HTML STRUCTURE (top-level) ===');
  console.log(bodyHtml.substring(0, 8000));
});
