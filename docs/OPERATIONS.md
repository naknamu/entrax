# Operations runbook

Operator-facing steps for the exam platform. Deploy *order* (and the production
backfill caveats) lives in [ROADMAP.md](../ROADMAP.md) — read that before any
production change.

Production project: `entrax-878a1` (legacy ID; Firebase project IDs are immutable). Emulator project: `demo-test`.

---

## 1. Staging project

Nothing goes to production before it has run in staging.

1. Create the Firebase project **`nightingale-staging`** (Blaze only if you need
   Functions; Firestore + Auth work on Spark).
2. Enable **Authentication → Sign-in method → Email link (passwordless)**. Add
   the Google provider too if/when it ships.
3. Create **Firestore** in production mode (rules are deployed from the repo,
   not typed into the console).
4. **Authentication → Settings → Authorized domains**: add
   `localhost`, `nightingale-staging.web.app`, and any staging custom domain.
5. Register a Web app and copy its config:

   ```bash
   cp .env.staging.example .env.staging   # fill in the staging values
   npm run build:staging                  # vite build --mode staging
   ```

   `.env.staging` is a local file and must never be committed. Only
   `.env.staging.example` belongs in the repo.

6. Deploy the rules, indexes, and functions **to staging first**:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project nightingale-staging
   firebase deploy --only functions --project nightingale-staging   # when Functions exist
   ```

   Only after staging is green do you repeat the same commands against
   `entrax-878a1` (see the ROADMAP deploy order — production also needs the
   exam-status backfill and the admin claim before the new rules).

7. Smoke-check in staging: magic-link sign-in, portal lists published exams, a
   student cannot open an admin page, an admin can create/publish an exam, and
   a submission round-trips.

---

## 2. Sentry (frontend error monitoring)

`js/monitoring.js` is a no-op until a DSN exists — the SDK is dynamically
imported, so the bundle is unchanged while monitoring is off.

1. Sentry → new **Browser / JavaScript** project, one per environment
   (`nightingale-web-staging`, `nightingale-web-prod`).
2. Copy the DSN into `VITE_SENTRY_DSN` (`.env.staging`, and the production
   build's Vite env in CI). `VITE_SENTRY_ENVIRONMENT` defaults to Vite's `MODE`
   (`staging` / `production`).
3. Rebuild and deploy, then throw a deliberate error in the console
   (`setTimeout(() => { throw new Error('sentry-check'); })`) and confirm it
   appears in Sentry with the right environment tag.
4. Verify PII is off: `sendDefaultPii: false`, and the attached user is
   `{ id: uid }` only — no email, no name. Never pass answers or student data
   in `captureException(error, context)`.

---

## 3. Backups / PITR

Firestore managed exports and point-in-time recovery require the **Blaze**
plan.

- **Manual export** (also what the workflow runs):

  ```bash
  gcloud firestore export \
    "gs://<bucket>/firestore/$(date -u +%Y%m%dT%H%M%SZ)" \
    --project=entrax-878a1
  ```

  Use a dedicated bucket (e.g. `nightingale-firestore-backups`) with a lifecycle rule
  (30–90 days) and no public access. The exporting service account needs
  datastore import/export permission plus write on the bucket — nothing else.

- **PITR**: Firebase Console → Firestore → Backups → enable point-in-time
  recovery (7-day window) once on Blaze. PITR is *not* a substitute for
  exports; keep both.

- **Restore test**: restore an export into `nightingale-staging` (Console → Import,
  or `gcloud firestore import gs://... --project=nightingale-staging`) and check
  counts and a few documents. **Never** import into production without a fresh
  export of production first and an explicit human decision.

- **GitHub workflow**: `.github/workflows/firestore-backup.yml` is
  **manual-only** (`workflow_dispatch`). It needs:

  | Kind | Name | Value |
  | --- | --- | --- |
  | Secret | `GCP_SA_KEY` | JSON key of a least-privilege service account |
  | Variable | `FIRESTORE_BACKUP_BUCKET` | bucket name only, no `gs://` |

  It fails fast with a clear message if either is missing. A commented-out
  nightly `schedule` is in the file; enable it only after Blaze is on, the
  secret/variable exist, and one manual run has produced a readable export.

---

## 4. Authorized domains / App Check

- **Authorized domains** (Auth → Settings): keep only the product domain, its
  `www` if used, `*.web.app`/`*.firebaseapp.com` for the project, and
  `localhost` for development. Remove anything you do not recognise — a leaked
  magic-link flow on an attacker-controlled domain is an account-takeover path.
- **App Check (reCAPTCHA v3)**: set `VITE_APPCHECK_SITE_KEY` per environment.
  Start in **monitor mode** (Console → App Check → APIs → Firestore/Auth →
  *Unenforced*), watch metrics for a few days, fix any legitimate traffic that
  fails, then switch to **enforced**. Enforcing before monitoring will break
  real users.
- App Check **does not work with the emulators**; `src/firebase.js` only
  initializes it when the site key is set *and* `VITE_USE_EMULATOR !== 'true'`.

---

## 5. Rate limiting reality

Firestore security rules **cannot rate-limit**. Rules see one request at a
time, cannot count requests per user, and cannot sleep. Do not try.

What actually limits abuse today:

- **App Check** (once enforced): blocks non-browser/scripted clients that
  cannot produce a reCAPTCHA token. This is the main lever.
- **Firebase Auth quotas**: magic-link email sends are quota-limited per project
  (and per address); this is the only built-in brake on sign-up spam.
- **Firestore document size / write throughput**: implicit, not a policy.
- **Cloud Functions** (Phase 0.3+, Blaze): concurrency and per-function quota
  settings are the place to add real per-user limits, since a Function can
  count and reject.

Not protected today:

- A signed-in user can read/write as fast as the SDK allows (subject to rules).
- While `config/features.serverGrading` is **off** (current production), published
  exams — including future/closed ones — are listable by any signed-in user and
  `correctIndex` is in those documents. Turning the switch on (Phase 0.3) removes
  the key from the exam document; see ROADMAP §0.3 for the flip order.
- No per-IP or per-uid throttling on submissions; duplicate-attempt prevention
  is client-side only.
- Audit-log writes are not rate-limited (an admin can write many entries; they
  are cheap and capped by rules to their own uid).

---

## 6. Audit log (`auditLogs`)

- **What is logged**: `actorUid`, `actorEmail`, `action` (dotted name such as
  `exam.delete`), `targetType`, `targetId`, `details` (small plain object),
  and a server `createdAt`. Written by `js/audit-log.js`
  (`logAdminAction()`), best-effort — a failed audit write never blocks the
  admin action.
- **What must not be logged**: passwords, tokens, full submission answers, or
  bulk student PII. Keep `details` to ids, counts, and changed field names.
- **Who can read**: only tokens with the `role: admin` custom claim. Students
  and anonymous sessions get `permission-denied`.
- **Append-only**: rules allow `create` (admin, own uid, server timestamp) and
  admin `read`; `update` and `delete` are denied. Corrections are new entries,
  never edits. Retention: keep indefinitely for now; if you add a TTL/export
  policy, document it here first.

---

## 7. Secrets

- `.env.*` files are never committed. Only `*.example` templates are in the
  repo. Production Vite env comes from GitHub Secrets at build time.
- Rotate `GCP_SA_KEY` and `FIREBASE_TOKEN` on a schedule and immediately on
  suspected exposure (delete the old key in GCP/IAM, then update the secret).
- Service accounts should be least-privilege and separate per job:
  - rules/indexes deploy: Firebase Hosting/Firestore rules permissions only
  - backups: Firestore import/export + write on the backup bucket only
  - never reuse a project-owner key for CI.
- If a key leaks: revoke it first, then check Firestore/Auth audit logs and
  billing, then rotate.

---

## 8. Deploy order

See [ROADMAP.md](../ROADMAP.md) → *Production data — 104 existing exams*.
Short version: staging first, then production backfill → admin claim → rules →
site. Roll back rules and site together, never the site alone.
