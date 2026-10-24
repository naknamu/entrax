# AGENTS.md

> Keep this short. If it's not something an agent would miss, don't add it.

## Quick commands
- Install: `npm install`
- Dev server (Vite, port 8080): `npm run dev` (serves all HTML entries)
- Build: `npm run build` (output to `dist/`, base is `./` for Pages/subpaths)
- Preview prod build: `npm run preview`
- Firebase emulators (Auth 9099, Firestore 8081): `npm run emulators` (uses project `demo-test`)
- Create test admin (once): `npm run setup:admin` (connects to emulators)
- Seed mock data: `npm run seed:mock`
- E2E: `npm run test` (Playwright), `npm run test:ui`, `npm run test:headed`, `npm run test:debug`, `npm run test:report`
- All-in-one (starts emulators/dev and runs tests): `npm run test:all`

## Architecture (what to know)
- Multi-page Vite app. Entries in `vite.config.js`: `index`, `admin-dashboard`, `create-exam`, `exam`, `exam-results`, `student` (all HTML in root). `public/` is static dir; aliases `@` -> `src/`, `@js` -> `js/`.
- Firebase singleton: `src/firebase.js` initializes app/auth/db from `import.meta.env.VITE_*`. If `VITE_USE_EMULATOR==='true'` connects to `localhost:9099` (Auth) and `localhost:8081` (Firestore). Exports `auth`, `db`, `persistenceReady` (sets `browserLocalPersistence`). Exposes `window.__FIREBASE_APP__/__FIREBASE_AUTH__/__FIREBASE_DB__` for test sync.
- Shared helpers: `js/firestore-helpers.js` (CRUD/batch), `js/grading.js`, `js/admin.js`, `js/exam.js`. UI styles in `public/style.css` (CSS vars + PostCSS `postcss-nested`/`postcss-custom-properties` with `preserve: false`).
- Student auth is magic-link (`js/student-auth.js`). Any page that reacts to auth must `await persistenceReady` and `auth.authStateReady()` first — treating the initial `null` as signed-out (or calling `signInAnonymously`) replaces a signed-in student's session and bounces them to the portal sign-in view.
- Firestore rules/indexes: `firestore.rules`, `firestore.indexes.json` (deployed by CI when changed).

## Environment
- Copy `.env.example` -> `.env.development` for local; `.env.production` for builds. **Never commit secrets**.
- Required: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. `VITE_USE_EMULATOR` true only for local emulators.
- CI uses GitHub secrets for build; Pages deploys `dist/`. Firestore deploy uses `FIREBASE_TOKEN` (and only when rules/indexes change).

## Testing & emulators (gotchas)
- Playwright (`playwright.config.cjs`): test dir `./tests`, global setup/teardown, single Chromium project, `webServer` runs `npm run dev` on port 8080 (reuses if exists outside CI). Tests timeout 60s.
- `tests/global-setup.cjs` uses firebase-admin against emulators (sets `FIRESTORE_EMULATOR_HOST=localhost:8081`, `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, project `demo-test`). Creates admin `admin@test.com`/`password123` (uid `test-admin-uid`) if missing and a fixed sample exam `sample-exam-test-fixed-id` with 5 questions (sets `process.env.TEST_EXAM_ID`).
- `tests/utils.js` provides `injectEmulatorConfig`/`waitForFirebase` and helpers like `signInAsAdmin` (navigates to `index.html?test=true`, waits for redirect to admin dashboard). Many tests expect emulators + the global setup state.
- If running tests against running services, ensure emulators are up or use `npm run test:all`. Opening HTML files directly won't work (Vite modules/env).

## Build/deploy
- GitHub Actions (`.github/workflows/ci-cd.yml`): on push to `main` builds with Vite (injecting Vite env secrets), deploys Pages from artifact, and deploys Firestore rules/indexes in parallel if `firestore.rules` or `firestore.indexes.json` changed (uses `w9jds/firebase-action`, project `entrax-878a1`, needs `FIREBASE_TOKEN`).
- `base: './'` in Vite config is intentional for GitHub Pages subpaths/custom domains.
