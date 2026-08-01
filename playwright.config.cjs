/**
 * Playwright configuration for Online Exam Platform
 * 
 * Run tests: npx playwright test
 * View report: npx playwright show-report
 * Debug: npx playwright test --debug
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Global setup/teardown
  globalSetup: require.resolve('./tests/global-setup.cjs'),
  globalTeardown: require.resolve('./tests/global-teardown.cjs'),
  
  // Timeout settings
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  
  // Run tests in parallel
  fullyParallel: false,
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 0,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }]
  ],
  
  // Projects (browsers)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
  ],
  
  // Local dev server - auto-started by Playwright (using Vite dev server)
  webServer: {
    command: 'npm run dev',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  
  // Test output directory
  outputDir: 'test-results/',
  
  // Metadata
  metadata: {
    project: 'Online Exam Platform',
    version: '1.0.0'
  }
});