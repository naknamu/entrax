# Online Exam Platform

A modern, full-featured online exam platform built with **Vite**, **Firebase (Auth + Firestore)**, and vanilla JavaScript. Features a clean, accessible UI designed for academic testing environments.

## ✨ Features

- **Multi-page Architecture** — Separate pages for login, admin dashboard, exam creation, exam taking, and results
- **Firebase Backend** — Authentication (email/password + anonymous) and Firestore for real-time data
- **Exam Creation** — Rich form with question builder, import from text/CSV/JSON/DOCX, categories, randomization
- **Exam Taking** — One-question-per-screen, live timer with auto-submit, progress tracking, flag questions, tab-switch detection
- **Grading & Results** — Automatic grading, detailed breakdowns, CSV export, print-friendly views
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

# Terminal 3: Start Vite dev server
npm run dev
```

Open http://localhost:8080 — you'll see the login page. Sign in with:
- **Email:** `admin@test.com`
- **Password:** `password123`

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
├── exam.html               # Student exam taking
├── exam-results.html       # Exam results & analytics
├── src/
│   └── firebase.js         # Shared Firebase initialization (singleton)
├── js/
│   ├── admin.js            # Admin page utilities
│   ├── exam.js             # Exam page utilities
│   ├── firestore-helpers.js # Firestore CRUD helpers
│   └── grading.js          # Grading logic
├── public/
│   └── style.css           # Design system & component styles
├── tests/                  # Playwright E2E tests
├── .env.example            # Environment variable template
├── .env.development        # Local dev config (gitignored)
├── .env.production         # Production config (gitignored)
├── vite.config.js          # Vite multi-page config
├── playwright.config.js    # Playwright test config
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

The project uses Firebase Auth (port 9099) and Firestore (port 8081) emulators for local development. Configured in `firebase.json`.

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
- `tests/utils.js` — Shared test helpers (auth, exam creation, etc.)
- `tests/global-setup.js` — Creates test admin user & sample exam in emulators
- `tests/global-teardown.js` — Cleanup

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

1. Push to `main` branch
2. GitHub Action runs: `npm ci` → `npm run build` → deploys `dist/` to `gh-pages` branch
3. Configure repository Settings → Pages → Source: "GitHub Actions"

**Required GitHub Secrets** (Settings → Secrets → Actions):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

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
- Single shared `src/firebase.js` initializes Firebase once and exports `auth`, `db`
- Environment config via Vite's `import.meta.env` (`.env.*` files) instead of URL params
- Multi-page Vite build outputs all HTML pages to `dist/`
- GitHub Actions handles build + deploy on push to main
- Local development now requires `npm install` and `npm run dev` (no more opening HTML files directly)