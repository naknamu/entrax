# Nightingale — Online Exam Platform

A modern, full-featured exam-prep platform built with **Vite**, **Firebase (Auth + Firestore)**, and vanilla JavaScript. It powers **Nightingale**, a B2C practice product for the Kaplan Nursing Entrance Exam, and keeps the original multi-page admin/student exam tooling underneath.

## ✨ Features

- **Marketing landing page** — Public front door at `/` with product copy, an interactive sample question, pricing, FAQ, and legal links (`admin-login.html` is the separate admin entrance)
- **Multi-page Architecture** — Separate pages for the landing page, admin sign-in, admin dashboard, exam creation, exam taking, results, and the student portal
- **Firebase Backend** — Authentication (admin email/password, student magic link) and Firestore for real-time data
- **Student Portal** — Sign in with a magic link, browse open exams, see past scores, retake an exam, or review a submitted attempt
- **Exam Creation** — Rich form with question builder, import from text/CSV/JSON/DOCX, categories, named sections, randomization, and a procedural question generator (reading/math/writing/science)
- **Exam Taking** — One-question-per-screen, live timer with auto-submit, progress tracking, flag questions, tab-switch detection, optional sections
- **Grading & Results** — Automatic grading, per-category weak-area breakdown, detailed answer review, CSV export, print-friendly views
- **Server-side grading (Phase 0.3)** — Behind a feature switch, a `submitAttempt` Cloud Function grades against an admin-only answer key so students never receive `correctIndex` and cannot write their own score
- **Audit log** — Admin create/update/publish/delete actions are appended to an admin-only, immutable `auditLogs` collection
- **Retake & Review** — Retake creates a fresh attempt; review replays the last submitted attempt (answers, flags, order) without creating a submission
- **Admin Dashboard** — Stats overview, exam management, submission review with filtering/sorting
- **Legal & trust surface** — Terms of Service, Privacy Policy, contact page, and a visible non-affiliation disclaimer
- **Optional analytics** — Env-gated GA4 (`VITE_GA_MEASUREMENT_ID`) with funnel events; no-op and no third-party script when unset
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Accessibility** — Semantic HTML, ARIA labels, keyboard navigation, focus management, reduced motion support
- **Firebase Emulators** — Local development with zero cloud costs
- **Vite Build** — Fast dev server, optimized production builds, multi-page output

## 🌐 Brand and launch surfaces

The product name used in the UI is **Nightingale**, with the proposed domain
**nightingaleexam.com** (verified unregistered via Verisign RDAP on 2026-10-27;
it still needs to be purchased and connected). The brand is intentionally
independent: Kaplan is referenced only descriptively, and every public surface
carries a non-affiliation disclaimer.

| Surface | Path | Indexed? |
|---------|------|----------|
| Marketing landing page | `/` (`index.html`) | Yes |
| Terms of Service | `/terms.html` | Yes |
| Privacy Policy | `/privacy.html` | Yes |
| Contact | `/contact.html` | Yes |
| Admin sign-in | `/admin-login.html` | No (`noindex` + `robots.txt`) |
| Student portal / exams | `/student.html`, `/exam.html` | No |

Support email placeholder: `support@nightingaleexam.com` — set up forwarding (or
change the address in `index.html`, `terms.html`, `privacy.html`, `contact.html`)
before launch.

Pricing is three one-time products (no subscription, no auto-renew): **$19 Exam
Pass for 90 days**, **$9 Extension for +90 days** (stacks on the later of
purchase or current expiry; sold as an expiry win-back), and **$49 Lifetime**
(access while the Service operates). Checkout is not wired up yet — every paid
CTA routes to the free account.

Analytics is **off by default**. When `VITE_GA_MEASUREMENT_ID` is set, these
events are sent (never email, name, or answers): `cta_click`, `pricing_viewed`,
`sample_question_answered`, `magic_link_requested`, `signup_completed`,
`login_completed`, `exam_started`, `exam_completed`, `first_mock_completed`.

If the brand or domain changes, update the wordmark and `nightingaleexam.com`
strings across the HTML pages, `public/robots.txt`, and `public/sitemap.xml`.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase project (for production) or Firebase CLI (for local emulators)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd online-exam-platform

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env.development
# Edit .env.development with your Firebase config (or use demo values for emulators)
```

### Development with Emulators (Recommended)

```bash
# Terminal 1: Start Firebase emulators
npm run emulators

# Terminal 2: Create test admin user (run once)
npm run setup:admin

# Optional: seed mock exams + submissions for the student portal
npm run seed:mock

# Terminal 3: Start Vite dev server
npm run dev
```

Open http://localhost:8080 — you'll see the marketing landing page. Admin sign-in
is at http://localhost:8080/admin-login.html. Sign in with:
- **Email:** `admin@test.com`
- **Password:** `password123`

### Student Portal

Students sign in at http://localhost:8080/student.html with a magic link. With the
Auth emulator running, the generated link is shown directly in the sign-in card
(no email needed). The seeded student account is `student@test.com`.

From the portal a student can:

- open any exam that is currently within its availability window,
- see past scores in the dashboard and recent-activity list,
- **Retake** an exam (`exam.html?examId=…&retake=true`) — starts a fresh attempt,
- **View Results** (`exam.html?examId=…&review=true`) — replays the latest submitted
  attempt, even after the exam has closed.

Students who open an exam link while signed in are started automatically; add
`&manualStart=true` to keep the name/email confirmation form visible.

**Every graded attempt requires a real (magic-link) identity.** A signed-out or
anonymous visit to `exam.html` is signed out and redirected to
`student.html?next=<original exam URL>`; after signing in the portal sends the
student back to that exact exam link.

### Development against Production Firebase

```bash
# Configure .env.development with your real Firebase project credentials
# Set VITE_USE_EMULATOR=false

npm run dev
```

## 📁 Project Structure

```
├── index.html              # Marketing landing page (public front door)
├── admin-login.html        # Admin sign-in (separate from the landing page)
├── terms.html              # Terms of Service
├── privacy.html            # Privacy Policy
├── contact.html            # Contact / support page
├── admin-dashboard.html    # Admin dashboard
├── create-exam.html        # Exam creation/editing
├── exam.html               # Student exam taking, results, retake & review
├── exam-results.html       # Exam results & analytics
├── student.html            # Student portal (magic-link sign-in, exam list)
├── functions/              # Cloud Functions (submitAttempt — server grading)
│   ├── index.js            # Callable: validate, grade, write score
│   ├── grading.cjs         # Pure grading logic (unit tested)
│   └── test/               # node:test unit tests
├── src/
│   ├── firebase.js         # Shared Firebase initialization (singleton)
│   └── student-portal.js   # Portal views, exam cards, score charts
├── js/
│   ├── admin.js            # Admin page utilities
│   ├── analytics.js        # Env-gated GA4 (no-op without a measurement ID)
│   ├── audit-log.js        # Append-only admin action log (never throws)
│   ├── exam.js             # Exam page utilities
│   ├── firestore-helpers.js # Firestore CRUD helpers (+ examKeys)
│   ├── grading.js          # Grading & category statistics
│   ├── landing.js          # Landing page: CTAs, sample question, mobile nav
│   ├── monitoring.js       # Env-gated Sentry scaffold (no-op without a DSN)
│   ├── question-generator.js # Procedural question generation
│   ├── reading-generator.js  # Reading passage/question generator
│   └── student-auth.js     # Magic-link auth wrapper
├── public/
│   ├── style.css           # Design system, app styles, marketing styles
│   ├── robots.txt          # Search indexing rules (app pages excluded)
│   └── sitemap.xml         # Marketing pages
├── scripts/                # One-off data/maintenance helpers
├── docs/OPERATIONS.md      # Staging, Sentry, backups, App Check, secrets
├── tests/                  # Playwright E2E tests + seed/verify helpers
├── .env.example            # Environment variable template
├── .env.staging.example    # Staging template (copy to .env.staging, gitignored)
├── .env.development        # Local dev config (gitignored)
├── .env.production         # Production config (gitignored)
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Composite indexes
├── vite.config.js          # Vite multi-page config
├── playwright.config.cjs   # Playwright test config
└── package.json
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | Yes |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | Yes |
| `VITE_USE_EMULATOR` | Set to `true` to connect to local emulators | No (default: false) |
| `VITE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key; App Check stays off when empty | No |
| `VITE_SENTRY_DSN` | Sentry browser DSN; monitoring is a no-op when empty | No |
| `VITE_SENTRY_ENVIRONMENT` | Sentry environment label (defaults to the Vite mode) | No |
| `VITE_GA_MEASUREMENT_ID` | GA4 measurement ID (`G-…`); analytics loads nothing when empty | No |

Create `.env.development` for local development and `.env.production` for production builds. **Never commit real secrets to git.** `.env.staging` is gitignored too — start from `.env.staging.example`.

### Firebase Emulators

The project uses Firebase Auth (port 9099), Firestore (8081), and Cloud Functions (5001) emulators for local development, configured in `firebase.json` with project `demo-test`. The Emulator UI is at http://127.0.0.1:4000.

Set `VITE_USE_EMULATOR=true` in `.env.development` to point the app at them. The Functions emulator runs the code with the host Node version; Cloud Functions use Node 20 in production, so a "node version mismatch" warning locally is expected.

## 🧪 Testing

```bash
# Run all tests (starts emulators, dev server, runs Playwright)
npm run test:all

# Run tests against already-running dev server
npm run test

# Phase 0.3 server-grading spec (single worker; Functions emulator required)
npm run test:server-grading

# Pure grading unit tests (no emulator)
node --test functions/test/grading.test.cjs

# Run tests with UI
npm run test:ui

# Run tests headed (see browser)
npm run test:headed

# Debug tests
npm run test:debug

# View test report
npm run test:report
```

### Test Structure

- `tests/smoke.spec.js` — Critical happy-path flows (login, create exam, take exam, view results)
- `tests/exam-platform.spec.js` — Comprehensive feature tests
- `tests/sections-solutions.spec.js` — Named sections, section badges, solutions on results
- `tests/student-portal.spec.js` — Portal → exam navigation without losing the signed-in session
- `tests/security-rules.spec.js` — Rules regression (anonymous denied, admin allowed, drafts hidden)
- `tests/exam-resume.spec.js` — Reload resumes the attempt; `retake=true` starts fresh
- `tests/exam-submit.spec.js` — Submission survives a deleted/abandoned draft document
- `tests/exam-retake-review.spec.js` — Retake starts a new attempt; review replays a submitted attempt
- `tests/server-grading.spec.js` — Phase 0.3: key hiding, score tampering, server grading, review
- `tests/audit-log.spec.js` — Admin-only append-only audit log
- `tests/layout-visual.spec.js`, `tests/visual-check.spec.js` — Layout constraints and visual checks
- `tests/utils.js` — Shared test helpers (`signInAsAdmin`, `signInAsStudent`, `signOut`, `createTestExam`, etc.)
- `tests/global-setup.cjs` — Creates test admin user & sample exam in emulators
- `tests/global-teardown.cjs` — Cleanup

Tests that take an exam must sign in as a real student first (`signInAsStudent`)
and open the exam with `&manualStart=true`, because a signed-in student is
auto-started and never sees the name/email form. `tests/server-grading.spec.js`
is excluded from the main suite (`playwright.config.cjs`) because it flips a
global feature switch; it runs in a second pass via its own config.

### Data Helpers

```bash
# Seed mock exams + submissions
npm run seed:mock

# Delete submissions for one exam (default: mock-history-world)
node scripts/dev-reset-exam.cjs <examId>

# Answer keys: write examKeys / strip inline keys / restore inline keys
node scripts/migrate-exam-keys.cjs [--strip|--restore] [--dry-run]

# Server-grading switch (defaults to the emulator)
node scripts/set-feature-flag.cjs serverGrading on|off

# Remove "Kaplan" from exam titles (dry run by default; add --apply to write)
node scripts/rename-exam-titles.cjs [--apply] [--prod]
```

Every maintenance script defaults to the **emulator** (`demo-test`,
localhost:8081). Production requires an explicit `--prod` and Application
Default Credentials. See the deploy order in [`ROADMAP.md`](ROADMAP.md) before
running anything with `--prod`.

## 🏗️ Building for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

Output goes to `dist/` — ready for static hosting.

## 🚀 Deployment

### GitHub Pages (Automatic via Actions)

1. Push to `main` (or open a PR — PRs build only, no deploy)
2. `.github/workflows/ci-cd.yml` runs `npm ci` → `npm run build` with the Firebase env secrets
3. The `dist/` artifact is published to GitHub Pages via `actions/deploy-pages`
4. Configure repository Settings → Pages → Source: **GitHub Actions**

`vite.config.js` uses `base: './'`, so the build works under a project subpath
(`https://<user>.github.io/<repo>/`) or a custom domain root.

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `FIREBASE_TOKEN` — for `firebase login:ci`; used only when `firestore.rules` or `firestore.indexes.json` changed

The same workflow deploys Firestore rules and indexes to the `entrax-878a1`
project in parallel with the Pages deploy (skipped when those files are unchanged).

### Cloud Functions (server grading)

`submitAttempt` lives in `functions/` and requires the **Blaze** plan. Nothing in
the current production deployment calls it until `config/features.serverGrading`
is turned on, so shipping the site and rules is safe before Functions exist.

```bash
npm --prefix functions install
firebase deploy --only functions --project entrax-878a1
```

Then follow the 6-step flip (and rollback) in [`ROADMAP.md`](ROADMAP.md) §0.3.
Deploy order matters: functions → keys → site → rules → flag → `--strip`.

### Manual Deployment

```bash
npm run build
# Deploy dist/ folder to any static host (Netlify, Vercel, Firebase Hosting, etc.)
```

## 🎨 Design System

The UI uses a comprehensive CSS custom property system in `public/style.css`:

- **Colors** — Semantic palette (primary, success, warning, danger, neutral scales)
- **Spacing** — Consistent 4px base scale (`--space-1` through `--space-20`)
- **Typography** — Inter + JetBrains Mono, fluid type scale
- **Shadows** — Layered elevation system
- **Border Radius** — Consistent rounding scale
- **Components** — Buttons, forms, cards, tables, badges, modals, progress bars, navigation

All components are built with accessibility in mind: focus states, ARIA labels, semantic HTML, reduced motion support.

## 🔐 Security

- Firebase security rules in `firestore.rules` — restrict reads/writes by auth state, claim, and ownership
  - Students must be **real** (magic-link) users: `isRealUser()` rejects anonymous sessions for exam reads/lists, submissions, and student profiles
  - Students can only read their own submissions (by `studentUid`, with legacy email fallbacks)
  - Submissions can only be created for an open exam; deletes are limited to abandoned drafts/admins
  - `examKeys/{examId}` (correct answers) and `auditLogs` are admin-only; `auditLogs` is append-only
- Student sessions use Firebase email-link (magic-link) auth; admin pages require the `role: admin` custom claim (`scripts/set-admin-claim.cjs`); a signed-in student is redirected
- Auth state is restored (`authStateReady()`) before pages decide a visitor is signed out, so a refresh never silently downgrades a student to anonymous
- **Server-side grading** (opt-in via `config/features.serverGrading`): clients may only create an ungraded draft and autosave answers; `submitAttempt` grades with the Admin SDK, so a student cannot write `score`/`passed` and never receives the answer key
- Client-side validation + server-side rules (defense in depth)
- XSS prevention via `escapeHtml()` utility on all dynamic content
- CSP-ready (no inline scripts except Vite's dev module shim)

Operational details (staging, Sentry, backups, App Check, secrets rotation) are in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## 📝 License

ISC License — feel free to use, modify, and distribute.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Submit a PR

---

**Note:** This project migrated from a no-build CDN-based approach to Vite + npm. Key changes:
- Firebase imported from npm (`firebase/app`, `firebase/auth`, `firebase/firestore`) instead of gstatic CDN
- Single shared `src/firebase.js` initializes Firebase once and exports `auth`, `db`, and `persistenceReady`
- Environment config via Vite's `import.meta.env` (`.env.*` files) instead of URL params
- Multi-page Vite build outputs all HTML pages to `dist/`
- GitHub Actions handles build + deploy on push to main
- Local development now requires `npm install` and `npm run dev` (no more opening HTML files directly)