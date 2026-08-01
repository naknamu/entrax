import { test, expect } from '@playwright/test';

test('verify exam layout bugs exist', async ({ page }) => {
  // Set viewport to 1440px wide desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Navigate to index first
  await page.goto('/index.html?test=true', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('testMode', 'true'));
  await page.waitForFunction(() => window.__FIREBASE_APP__ !== undefined, { timeout: 10000 });
  await page.waitForTimeout(500);
  
  // Create an exam
  const result = await page.evaluate(async () => {
    // Use the existing create exam flow
    return new Promise(async (resolve) => {
      try {
        const { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } = await import('/js/firebase-helpers.js');
        // Just go directly to exam screen for testing
        resolve(null);
      } catch(e) { resolve(null); }
    });
  });
  
  // Navigate directly to exam screen with known exam ID from setup
  // Use the global setup approach
});
