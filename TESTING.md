# Testing Guide

This document explains how to run the Playwright end-to-end tests for the Online Exam Platform.

## Prerequisites

1. **Node.js 18+** - Required for Playwright
2. **Java 11+** - Required for Firebase emulators (Firestore & Auth)
3. **Firebase CLI** - For running emulators

## Quick Start

```bash
# 1. Install dependencies
npm ci

# 2. Install Playwright browsers
npx playwright install --with-deps chromium

# 3. Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# 4. Start Firebase emulators (in a separate terminal)
firebase emulators:start --only auth,firestore --project demo-test

# 5. Seed test data (in another terminal)
node tests/seed-test-data.js

# 6. Run tests
npx playwright test
```

## Detailed Setup

### 1. Install Java (Required for Firebase Emulators)

**Windows:**
```powershell
# Using winget
winget install --id Oracle.JDK.11 -e

# Or using Chocolatey
choco install openjdk11 -y
```

**macOS:**
```bash
brew install openjdk@11
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update && sudo apt-get install -y openjdk-11-jre-headless
```

Verify installation:
```bash
java -version
```

### 2. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 3. Configure Firebase Project for Testing

Create a Firebase project for testing (or use the demo project):

```bash
# Use demo project (no real Firebase project needed)
firebase use demo-test
```

Or create a real test project:
```bash
firebase projects:create test-exam-platform
firebase use test-exam-platform
```

### 4. Start Emulators

```bash
# Start emulators in background
firebase emulators:start --only auth,firestore --project demo-test
```

The emulators will be available at:
- **Auth Emulator**: http://localhost:9099
- **Firestore Emulator**: http://localhost:8080
- **Emulator UI**: http://localhost:4000

### 5. Seed Test Data

```bash
node tests/seed-test-data.js
```

This creates:
- Admin user: `admin@test.com` / `password123`
- Sample exam with 3 questions

### 6. Run Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/exam-platform.spec.js

# Run with UI mode
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test
npx playwright test -g "should create a new exam"

# Debug mode
npx playwright test --debug
```

## Test Structure

```
tests/
├── global-setup.js          # Global test setup (starts emulators)
├── global-teardown.js       # Global test teardown
├── seed-test-data.js        # Seeds test data
├── fixtures.js              # Test data fixtures
├── utils.js                 # Test utilities
└── exam-platform.spec.js    # Main test suite
```

## Running Tests in CI/CD

The GitHub Actions workflow (`.github/workflows/playwright.yml`) runs tests on every push/PR.

### Required Secrets

Add these to your GitHub repository secrets:

- `FIREBASE_TOKEN` - Firebase CI token (run `firebase login:ci` to generate)

### Workflow Features

- Runs on Ubuntu latest
- Installs Node.js, Playwright, Firebase CLI
- Starts Firebase emulators
- Seeds test data
- Runs Playwright tests
- Uploads HTML report and test results as artifacts
- Separate deploy job for GitHub Pages (doesn't interfere with tests)

## Viewing Test Results

### HTML Report

```bash
npx playwright show-report
```

This opens an interactive HTML report with:
- Test results summary
- Trace viewer for failed tests
- Screenshots and videos
- Timeline view

### Test Artifacts

After test runs, check:
- `playwright-report/` - HTML report
- `test-results/` - JSON results, screenshots, videos, traces

## Test Categories

### Admin Flows
- Login page rendering
- Valid/invalid login
- Dashboard rendering
- Create exam with questions
- Add/remove questions
- Form validation (0 questions, no correct answer, invalid time limit)
- Save as draft
- Generate shareable link

### Student Flows
- Exam start screen
- Single question display
- Next/Previous navigation
- Answer persistence
- Progress indicator
- Submit confirmation
- Retake prevention
- Timer expiration (auto-submit)
- Page refresh/resume
- Grading correctness

### Admin Results
- Results table
- Detailed submission view
- CSV export

### Student Results
- Score display (when enabled)
- Pass/fail badge

### Error Handling
- Invalid exam ID
- Console error detection
- Accessibility checks

## Mobile Testing

Tests run on mobile viewports:
- Pixel 5 (Chrome)
- iPhone 12 (Safari)

Run mobile tests only:
```bash
npx playwright test --project=mobile-chrome --project=mobile-safari
```

## Debugging Failed Tests

1. **View trace**: `npx playwright show-report` → click failed test → "Trace"
2. **Screenshots**: Check `test-results/` folder
3. **Videos**: Check `test-results/` folder
3. **Debug mode**: `npx playwright test --debug`
4. **Console logs**: Tests capture console errors automatically

## Common Issues

### "Firebase emulator not running"
```bash
# Check if emulators are running
curl http://localhost:9099/
curl http://localhost:8080/

# Restart emulators
firebase emulators:start --only auth,firestore
```

### "Permission denied" on Firestore
- Check emulator rules in `firestore.rules`
- Ensure test user has proper permissions

### "Element not found" / Timeout
- Increase timeout in test
- Check if element selector is correct
- Run in headed mode to see what's happening

### Java not found
```bash
# Verify Java installation
java -version

# If not found, install Java 11+
```

## Writing New Tests

1. Add test to `tests/exam-platform.spec.js`
2. Use utilities from `tests/utils.js`
3. Use fixtures from `tests/fixtures.js`
4. Follow existing patterns for page objects and helpers

## Test Configuration

Key settings in `playwright.config.js`:
- `baseURL`: http://localhost:8080
- `timeout`: 60s per test
- `retries`: 1 locally, 2 in CI
- `projects`: chromium, firefox, webkit, mobile-chrome, mobile-safari
- `webServer`: serves static files on port 8080

## Accessibility Testing

Tests include basic accessibility checks:
- Interactive elements have accessible names
- Proper heading structure
- Playwright's built-in accessibility snapshot

Run accessibility-focused tests:
```bash
npx playwright test -g "accessibility"
```

## Performance Testing

For performance testing, use Playwright's built-in metrics:
```javascript
const metrics = await page.evaluate(() => JSON.stringify(window.performance.timing));
```

## Continuous Integration

The GitHub Actions workflow:
1. Checks out code
2. Sets up Node.js
3. Installs dependencies
4. Installs Playwright browsers
5. Starts Firebase emulators
6. Seeds test data
7. Runs Playwright tests
8. Uploads report and results
9. Deploys to GitHub Pages (separate job, only on main branch)

The deploy job runs **after** tests pass and **does not interfere** with GitHub Pages deployment.

## Troubleshooting

### Tests hang on "waitForFirebase"
- Check Firebase emulator is running
- Check browser console for errors
- Verify firebase-config.js has correct config

### Tests fail on "already submitted"
- Clear browser storage between tests
- Use unique student emails per test

### CSV export test fails
- Check browser download permissions
- Verify download event is captured

### Mobile tests fail
- Check viewport settings
- Verify touch targets are large enough

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Update this documentation if needed
4. Run full test suite before committing

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)