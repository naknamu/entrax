# Product Roadmap — Nursing Entrance Exam practice (B2C)

## Product definition

A self-serve practice platform for **nursing school applicants preparing for the
Kaplan Nursing Entrance Exam**. Students study on their own, mostly on a laptop
or phone, and pay for realistic timed practice, explanations, and proof that
their score is improving.

**Core loop:** diagnostic mock → section/weak-area drills → explanations →
progress trend → next recommended drill.

**Not (yet):** a school/institution administration platform. No orgs, cohorts,
instructor dashboards, SSO, or LTI until Phase 3. Keeping this out of Phase 1
removes most of the compliance and sales surface.

### Target user

- Pre-nursing students (community college / 4-year / accelerated BSN applicants)
- Studying 4–12 weeks before their entrance exam
- Price-sensitive, mobile-heavy, expects instant sign-up and clear progress
- Buys outcomes ("raise my score"), not "exam management"

### Positioning & legal (read before writing copy)

- **Do not imply affiliation with Kaplan.** "Kaplan" is a registered trademark.
  Use a neutral product name/domain; if the exam name is mentioned, use it
  descriptively ("practice for the Kaplan Nursing Entrance Exam") with a clear
  disclaimer: *not affiliated with, endorsed by, or sponsored by Kaplan, Inc.*
- **Content must be original.** Audit `js/question-generator.js`,
  `js/reading-generator.js`, `scripts/fix-reading-exams.cjs`, and
  `exam-data-preview.json` for copied passages/questions before launch. Do not
  ship Kaplan-derived material. Keep an authoring log/provenance per question.
- **Scores are practice estimates**, not official results. Say so in the UI and
  ToS; avoid promising a passing score.
- Publish ToS, privacy policy, refund policy, and a content-removal (DMCA)
  contact before taking payments.

### Success metrics (instrument from day one)

- Activation: % of sign-ups who finish one mock within 48h
- Weekly practice: sessions and questions answered per active user
- Learning: score delta from first to latest mock
- Conversion: free → paid
- Retention: 4-week and 8-week return rate
- Churn and refund rate

---

## Release gate

Nothing outside the team until Phase 0 is green. A leaked student record or a
cheatable score is company-ending for a paid exam product; a missing chart is not.

---

## Production data — 104 existing exams (live, do not wipe)

Production (`entrax-878a1`) already contains **104 exams**, created before the
draft/published model existed, plus real student submissions. Treat it as live
customer data, not seed data.

Consequences for this pass:

1. **Every script defaults to the emulator** (`demo-test`, localhost). Anything
   pointed at production must be explicit (`--prod`) and run by a human who has
   checked the count first.
2. **Deploy order matters.** Phase 0.2 rules only let students read exams with
   `status == 'published'`; the 104 legacy exams have no `status`. Shipping the
   rules before the backfill hides **all 104 exams from every student**. Correct
   order:
   1. `node scripts/backfill-exam-status.cjs --prod` → expect
      `Exams scanned: 104`, `Marked published: 104`.
   2. `node scripts/set-admin-claim.cjs <your-admin-email> --prod` →
      without the claim the new admin guard redirects every admin to the portal.
   3. `firebase deploy --only firestore:rules,firestore:indexes --project entrax-878a1`
   4. Deploy the site.
   Verify after step 3: portal lists all 104, admin dashboard loads, a student
   cannot list submissions.
3. **Rollback:** re-deploying the previous rules is safe (they only widen
   access); the site rollback alone is not, because old code queries exams
   without the `status` filter. Roll back both or neither.
4. **Content provenance (launch gate):** if any of those 104 exams were
   transcribed from Kaplan material, they cannot be sold — see *Content must be
   original* above. Audit them before charging money; the backfill only changes
   visibility, not rights.

---

## Phase 0 — Safety & reliability (current pass)

### 0.1 Roles & admin authorization

- [x] `firestore.rules`: `isAdmin()` requires the `role == 'admin'` custom claim.
- [x] Admin pages (`admin-dashboard.html`, `create-exam.html`,
      `exam-results.html`, `index.html`) verify the claim and redirect
      non-admins.
- [x] `scripts/set-admin-claim.cjs` to grant/revoke the claim (emulator and
      production).
- [x] Test global setup grants the claim to the emulator admin.

**Acceptance:** a student token gets `permission-denied` creating/updating/
deleting an exam; the admin still can.

Note: exam `update`/`delete` are admin-only and deliberately ignore `createdBy`
ownership — the 104 legacy production exams carry a foreign service uid.
`create` still requires `createdBy == request.auth.uid`.

### 0.2 Query scoping (student PII)

- [x] `submissions` list/get scoped to `studentUid` (or admin); remove the
      anonymous-read fallback.
- [x] `exams` list returns only published exams to students; drafts are
      admin-only.
- [x] Client queries carry the same constraints (portal, duplicate check,
      review lookup, helpers).

**Acceptance:** as a student, an unscoped `getDocs(collection(db,'submissions'))`
or a draft-exam query fails; the portal still lists open exams and the student's
own history.

Rules detail:
- Exam `get` uses `isExamReadable()`: a **published** exam with questions that has
  started. Drafts and not-yet-open exams are unreadable via `get`.
- Exam `list` only requires `status == 'published'`, so any signed-in user can
  query published exams — including future/closed ones — and read
  `correctIndex`. The `get` window check does not close that.
- Published exams also stay readable via `get` after `endDate` so `?review=true`
  can re-render a past attempt.
- Submission `create` still uses `isExamOpen()` (published + inside the window),
  so a closed exam cannot be started.

### 0.3 Server-side grading `[!]`

Blocked on: Firebase **Blaze** plan + Cloud Functions.

- [ ] Move `correctIndex` to `examKeys/{examId}` (Admin SDK only).
- [ ] `submitAttempt` callable validates the attempt, grades, and writes
      `score/percentage/passed/submittedAt` with server timestamps.
- [ ] Rules deny client writes to those fields.
- [ ] Server-side attempt counter (duplicate prevention).

Interim: drafts are not readable, and `get` of a not-yet-open exam is blocked, but
published exams — including future/closed ones — remain **listable** by any
signed-in user, and `correctIndex` is in the document. Answers are not shown in
the UI. Not sufficient for paid, high-stakes practice — do this before charging
money.

**Blocking before charging money:** any authenticated user (incl. anonymous) can
list published exams — including future/closed ones — and read `correctIndex`;
fixed only by server-side grading / key separation.

### 0.4 Attempt resilience

- [x] Resume an in-progress draft on reload (answers, flags, order, start time).
- [x] Timer derives from the server `startedAt`; auto-submit when expired.
- [x] Autosave debounced and flushed on submit / visibility change.

### 0.5 Auth hardening

- [x] Optional Firebase App Check scaffold (`VITE_APPCHECK_SITE_KEY`).
- [!] Production magic-link email: verified sending domain + branded template
      (or Postmark/SendGrid via a Function).
- [!] Decide: allow anonymous direct-link attempts, or require magic-link
      identity for every graded attempt?
- [ ] Rate limiting and Auth authorized domains pinned to the product domain.

### 0.6 Ops baseline

- [x] CI runs Playwright on every push/PR against the emulators; deploys do not wait for it (advisory gate).
- [!] Sentry (or equivalent) wired into the frontend.
- [!] Staging Firebase project + `.env.staging`.
- [!] Scheduled Firestore exports / PITR.
- [ ] Audit log collection for admin actions.

---

## Phase 1 — Paid B2C launch

### Onboarding & accounts

- [ ] Sign-up with magic link **and** Google; display name; exam date + target
      score; timezone.
- [ ] Free tier: one full mock + a limited drill set. Paid tier unlocks the
      bank, analytics, and full-length mocks.
- [ ] Stripe Checkout + customer portal; webhook writes
      `entitlements/{uid}`; rules gate premium exams/content.
- [ ] Account settings: export data, delete account, manage subscription.

### Exam experience (student-facing)

- [ ] Explanations for every question (why the right answer is right and each
      distractor is wrong) — the #1 reason students pay.
- [ ] Section practice: Reading, Math, Writing, Science (matches the current
      generators and sections model).
- [ ] Full-length timed mock with a **scaled score estimate** and section
      breakdown.
- [ ] Weak-area drills generated from missed categories; "practice this next".
- [ ] Scratch pad/calculator where appropriate, flag + review, keyboard
      shortcuts.
- [ ] Mobile-first exam layout + PWA (installable, offline draft).

### Progress & motivation

- [ ] Dashboard: score trend, section mastery, study streak, next recommended
      action (some pieces already exist in `student-portal.js`).
- [ ] Item review history: revisit past attempts and explanations.
- [ ] Email reminders (study streak, exam date countdown).

### Growth

- [ ] Marketing site with SEO pages per section ("nursing entrance math
      practice"), sample questions, and a free diagnostic as the lead magnet.
- [ ] Analytics (PostHog/GA4): signup → diagnostic → paid funnel.
- [ ] Referral or share-your-score loop.
- [ ] Support: FAQ, contact form, refund flow.

### Trust

- [ ] Disclaimer: independent practice, not affiliated with Kaplan; scores are
      estimates.
- [ ] ToS, privacy, refunds, data deletion, content provenance log.
- [ ] WCAG 2.1 AA pass on the exam flow (radio-group semantics, modal focus
      trap, contrast, keyboard-only run).

---

## Phase 2 — Retention & content scale

- [ ] Question bank at scale (target 1,000+ original items) with tags,
      difficulty, and explanations.
- [ ] Item analysis to calibrate difficulty and retire bad questions.
- [ ] Adaptive practice + spaced repetition of missed items.
- [ ] Score prediction with confidence range from mock history.
- [ ] Study plan generator from exam date and available hours/week.
- [ ] Performance: split the 1,600-line inline scripts into modules, code-split
      the generator, trim the 127 KB `style.css`.
- [ ] Unit tests (Vitest) for grading, randomization, section grouping, stats.
- [ ] Optional i18n.

---

## Phase 3 — Institutional (optional, only if schools ask)

- [ ] Organizations, cohorts, instructor dashboards, roster import.
- [ ] SSO and LTI 1.3.
- [ ] FERPA/DPA paperwork, accessibility VPAT.

---

## Decisions needed

1. **Brand & domain** — neutral name (recommended), with a descriptive
   "nursing entrance exam" subtitle and a non-affiliation disclaimer.
2. **Content rights** — who authors/reviews questions, and can we prove
   originality? This gates paid launch.
3. **Free/paid boundary** — what is free (one mock?) and what is paid.
4. **Pricing** — subscription ($9–19/mo) vs. one-time exam pass ($39–59);
   recommend testing both.
5. **Firebase plan** — Blaze for Cloud Functions (server grading, email,
   scheduled backups). Required for 0.3.
6. **Identity** — allow anonymous direct-link attempts, or require sign-in for
   every graded attempt? (Recommend sign-in.)
7. **Email provider** — Firebase email link vs. Postmark/SendGrid via Function.

---

## Verification

```bash
npm run build                 # production build
npm run test                  # full Playwright suite (emulators required)
npm run seed:mock             # seed student + exams for manual checks
node scripts/set-admin-claim.cjs admin@test.com --emulator
```

Production (only after a dry run against the emulator):

```bash
node scripts/backfill-exam-status.cjs --prod    # expect 104 scanned / 104 published
node scripts/set-admin-claim.cjs <admin-email> --prod  # grant the admin claim
```

Manual smoke checklist:

- [ ] Magic-link student: portal lists only open/published exams.
- [ ] Magic-link student: cannot open `admin-dashboard.html` (redirected).
- [ ] Student: refresh mid-exam restores answers and remaining time.
- [ ] Student: retake starts a fresh attempt; review still works.
- [ ] Admin: create/publish/delete exam and read all submissions.
- [ ] Direct-link (anonymous) student: exam still starts and submits.
- [ ] Free vs. paid entitlement hides premium exams (after Phase 1).
