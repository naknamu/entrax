const { test, expect } = require('@playwright/test');

test('screenshot exam page before fix', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:8080/exam.html?examId=test-exam&token=test-token', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/tmp/exam-before-fix.png', fullPage: true });
  
  // Get HTML structure
  const bodyHtml = await page.locator('body').innerHTML();
  console.log('=== HTML STRUCTURE (top-level) ===');
  console.log(bodyHtml.substring(0, 5000));
});
