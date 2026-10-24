# Online Exam Platform

A modern, full-featured online exam platform built with **Vite**, **Firebase (Auth + Firestore)**, and vanilla JavaScript. Features a clean, accessible UI designed for academic testing environments.

## ✨ Features

- **Multi-page Architecture** — Separate pages for login, admin dashboard, exam creation, exam taking, results, and the student portal
- **Firebase Backend** — Authentication (admin email/password, student magic link, anonymous fallback) and Firestore for real-time data
- **Student Portal** — Sign in with a magic link, browse open exams, see past scores, retake an exam, or review a submitted attempt
- **Exam Creation** — Rich form with question builder, import from text/CSV/JSON/DOCX, categories, named sections, randomization, and a procedural question generator (Kaplan reading/math/writing/science)
- **Exam Taking** — One-question-per-screen, live timer with auto-submit, progress tracking, flag questions, tab-switch detection, optional sections
- **Grading & Results** — Automatic grading, per-category weak-area breakdown, detailed answer review, CSV export, print-friendly views
- **Retake & Review** — Retake creates a fresh attempt; review replays the last submitted attempt (answers, flags, order) without creating a submission
- **Admin Dashboard** — Stats overview, exam management, submission review with filtering/sorting
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Accessibility** — Semantic HTML, ARIA labels, keyboard navigation, focus management, reduced motion support
- **Firebase Emulators** — Local development with zero cloud costs
- **Vite Build** — Fast dev server, optimized production builds, multi-page output

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

Open http://localhost:8080 — you'll see the login page. Sign in with:
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

Students who open an exam link while signed in are started automatically; the
name/email form is only shown to signed-out visitors using a direct link.

### Development against Production Firebase

```bash
# Configure .env.development with your real Firebase project credentials
# Set VITE_USE_EMULATOR=false

npm run dev
```

## 📁 Project Structure

```
├── index.html              # Login page (entry point)
├── admin-dashboard.html    # Admin dashboard
├── create-exam.html        # Exam creation/editing
├── exam.html               # Student exam taking, results, retake & review
├── exam-results.html       # Exam results & analytics
├── student.html            # Student portal (magic-link sign-in, exam list)
├── src/
│   ├── firebase.js         # Shared Firebase initialization (singleton)
│   └── student-portal.js   # Portal views, exam cards, score charts
├── js/
│   ├── admin.js            # Admin page utilities
│   ├── exam.js             # Exam page utilities
│   ├── firestore-helpers.js # Firestore CRUD helpers
│   ├── grading.js          # Grading & category statistics
│   ├── question-generator.js # Procedural question generation
│   ├── reading-generator.js  # Reading passage/question generator
│   └── student-auth.js     # Magic-link auth wrapper
├── public/
│   └── style.css           # Design system & component styles
├── scripts/                # One-off data/maintenance helpers
├── tests/                  # Playwright E2E tests + seed/verify helpers
├── .env.example            # Environment variable template
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

Create `.env.development` for local development and `.env.production` for production builds. **Never commit real secrets to git.**

### Firebase Emulators

The project uses Firebase Auth (port 9099) and Firestore (port 8081) emulators for local development, configured in `firebase.json` with project `demo-test`. The Emulator UI is at http://127.0.0.1:4000.

Set `VITE_USE_EMULATOR=true` in `.env.development` to point the app at them.

## 🧪 Testing

```bash
# Run all tests (starts emulators, dev server, runs Playwright)
npm run test:all

# Run tests against already-running dev server
npm run test

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
- `tests/exam-submit.spec.js` — Submission survives a deleted/abandoned draft document
- `tests/exam-retake-review.spec.js` — Retake starts a new attempt; review replays a submitted attempt
- `tests/layout-visual.spec.js`, `tests/visual-check.spec.js` — Layout constraints and visual checks
- `tests/utils.js` — Shared test helpers (`signInAsAdmin`, `signOut`, `createTestExam`, etc.)
- `tests/global-setup.cjs` — Creates test admin user & sample exam in emulators
- `tests/global-teardown.cjs` — Cleanup

Tests that exercise the direct-link student flow call `signOut(page)` first, because
a signed-in student is auto-started and never sees the name/email form.

### Data Helpers

```bash
# Seed mock exams + submissions
npm run seed:mock

# Delete submissions for one exam (default: mock-history-world)
node scripts/dev-reset-exam.cjs <examId>
```

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

- Firebase security rules in `firestore.rules` — restrict reads/writes by auth state and ownership
  - Students can only read their own submissions (by `studentUid`, with legacy email fallbacks)
  - Submissions can only be created for an open exam; deletes are limited to abandoned drafts/admins
- Student sessions use Firebase email-link (magic-link) auth; admin pages require a non-anonymous user
- Auth state is restored (`authStateReady()`) before pages decide a visitor is signed out, so a refresh never silently downgrades a student to anonymous
- Client-side validation + server-side rules (defense in depth)
- XSS prevention via `escapeHtml()` utility on all dynamic content
- CSP-ready (no inline scripts except Vite's dev module shim)

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