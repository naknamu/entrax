# AGENTS.md

> Keep this short. If it's not something an agent would miss, don't add it.

## Quick commands
- Install: `npm install`
- Dev server (Vite, port 8080): `npm run dev` (serves all HTML entries)
- Build: `npm run build` (output to `dist/`, base is `./` for Pages/subpaths)
- Preview prod build: `npm run preview`
- Firebase emulators (Auth 9099, Firestore 8081, Functions 5001): `npm run emulators` (uses project `demo-test`)
- Create test admin (once): `npm run setup:admin` (connects to emulators)
- Seed mock data: `npm run seed:mock`
- E2E: `npm run test` (Playwright), `npm run test:ui`, `npm run test:headed`, `npm run test:debug`, `npm run test:report`
- Server-grading spec (own config, single worker): `npm run test:server-grading`
- Grading unit tests: `node --test functions/test/grading.test.cjs`
- All-in-one (starts emulators/dev and runs tests): `npm run test:all`

## Architecture (what to know)
- Multi-page Vite app. Entries in `vite.config.js`: `index`, `admin-dashboard`, `create-exam`, `exam`, `exam-results`, `student` (all HTML in root). `public/` is static dir; aliases `@` -> `src/`, `@js` -> `js/`.
- Firebase singleton: `src/firebase.js` initializes app/auth/db/functions from `import.meta.env.VITE_*`. If `VITE_USE_EMULATOR==='true'` connects to `localhost:9099` (Auth), `localhost:8081` (Firestore), and `localhost:5001` (Functions). Exports `auth`, `db`, `functions`, `persistenceReady` (sets `browserLocalPersistence`), and calls `initMonitoring()` (Sentry no-op without `VITE_SENTRY_DSN`). Exposes `window.__FIREBASE_APP__/__FIREBASE_AUTH__/__FIREBASE_DB__/__FIREBASE_FUNCTIONS__` for test sync.
- Shared helpers: `js/firestore-helpers.js` (CRUD/batch + `getExamKeys`/`mergeExamKeys`/`saveExamKeys`), `js/grading.js`, `js/admin.js`, `js/exam.js`, `js/audit-log.js` (never throws), `js/monitoring.js`. UI styles in `public/style.css` (CSS vars + PostCSS `postcss-nested`/`postcss-custom-properties` with `preserve: false`).
- Student auth is magic-link (`js/student-auth.js`). **Every graded attempt requires a real identity**: `exam.html` signs out anonymous sessions and redirects to `student.html?next=<exam URL>`; `getNextPath()` validates same-origin and the portal redirects back after sign-in. Any page that reacts to auth must `await persistenceReady` and `auth.authStateReady()` first — treating the initial `null` as signed-out (or calling `signInAnonymously`) replaces a signed-in student's session and bounces them to the portal sign-in view.
- Server grading (Phase 0.3) is behind `config/features.serverGrading` (Firestore). When on: answers live in admin-only `examKeys/{examId}`, the `submitAttempt` callable in `functions/` grades with the Admin SDK, clients may only create an ungraded draft and autosave `answers|flaggedQuestions|lastSavedAt|tabSwitchCount`, and `correctIndex` is stripped from exam docs. Admin pages merge keys back for edit/preview. Production is currently **off** (no Functions deployed).
- In `functions/`, import `FieldValue` from `firebase-admin/firestore`, not `admin.firestore.FieldValue`: the Functions emulator proxies the `firebase-admin` module and its `firestore` export becomes a bound function, which loses static properties (the call then dies with `INTERNAL`).
- Firestore rules/indexes: `firestore.rules`, `firestore.indexes.json` (deployed by CI when changed). Maintenance scripts (`scripts/*.cjs`) default to the emulator; `--prod` is required for production.

## Environment
- Copy `.env.example` -> `.env.development` for local; `.env.production` for builds; `.env.staging.example` -> `.env.staging` for staging. **Never commit secrets** (`.env.staging` is gitignored).
- Required: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. `VITE_USE_EMULATOR` true only for local emulators. Optional: `VITE_APPCHECK_SITE_KEY`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`.
- CI uses GitHub secrets for build; Pages deploys `dist/`. Firestore deploy uses `FIREBASE_TOKEN` (and only when rules/indexes change). The Functions job installs `functions/` deps first. `.github/workflows/firestore-backup.yml` is manual-only and needs `GCP_SA_KEY` + `FIRESTORE_BACKUP_BUCKET`.

## Testing & emulators (gotchas)
- Playwright (`playwright.config.cjs`): test dir `./tests`, global setup/teardown, single Chromium project, `webServer` runs `npm run dev` on port 8080 (reuses if exists outside CI). Tests timeout 60s.
- `tests/global-setup.cjs` uses firebase-admin against emulators (sets `FIRESTORE_EMULATOR_HOST=localhost:8081`, `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, project `demo-test`). Creates admin `admin@test.com`/`password123` (uid `test-admin-uid`) if missing and a fixed sample exam `sample-exam-test-fixed-id` with 5 questions (sets `process.env.TEST_EXAM_ID`).
- `tests/utils.js` provides `injectEmulatorConfig`/`waitForFirebase` and helpers like `signInAsAdmin` (navigates to `index.html?test=true`, waits for redirect to admin dashboard) and `signInAsStudent` (magic-link sign-in through the emulator's dev link). Many tests expect emulators + the global setup state.
- Exams now require a real student identity: specs call `signInAsStudent(page)` and open `exam.html?examId=…&manualStart=true` so the name/email form stays visible. `manualStart` is preserved on retake links.
- `tests/server-grading.spec.js` flips the global `config/features.serverGrading` switch, so it is excluded from `playwright.config.cjs` and runs alone via `playwright.server-grading.config.cjs` (`npm run test:server-grading`). `npm run test:ci` (`scripts/run-ci-tests.cjs`) runs the main suite, then that spec, and needs the Functions emulator.
- If running tests against running services, ensure emulators are up or use `npm run test:all`. Opening HTML files directly won't work (Vite modules/env).

## Build/deploy
- GitHub Actions (`.github/workflows/ci-cd.yml`): on push to `main` builds with Vite (injecting Vite env secrets), deploys Pages from artifact, and deploys Firestore rules/indexes in parallel if `firestore.rules` or `firestore.indexes.json` changed (uses `w9jds/firebase-action`, project `entrax-878a1`, needs `FIREBASE_TOKEN`).
- `base: './'` in Vite config is intentional for GitHub Pages subpaths/custom domains.
