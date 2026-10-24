/**
 * Security-rules regression tests (Phase 0.1 / 0.2).
 *
 * Runs in the browser against the page's own Firebase instance so the rules
 * see real auth tokens:
 *   - a student (anonymous session) cannot read draft exams, cannot start a
 *     draft, cannot list submissions/exams unconstrained, and cannot create an
 *     exam
 *   - a student CAN read a published exam after its endDate (review-after-close)
 *   - an admin can list submissions/exams, create/delete their own exam, and
 *     update/delete an exam owned by a different uid (legacy production exams)
 *
 * Import notes for page.evaluate:
 *   - Bare `firebase/firestore` specifiers are not rewritten by Vite inside an
 *     evaluated string, so we resolve the SDK through the URL the page already
 *     loaded (performance resource entries). Importing `/@id/firebase/firestore`
 *     or `/src/firebase.js` would create a *second* module instance, and the
 *     `instanceof` checks inside the SDK then reject the page's db object.
 *   - Auth/Firestore instances come from the window globals for the same
 *     reason (a second `/src/firebase.js` evaluation also reconnects the
 *     emulators and throws `auth/emulator-config-failed`).
 *
 * Draft / closed / foreign-owned exams are seeded through the emulator's REST
 * API with owner credentials, so the tests don't depend on the admin UI.
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_AUTH = { Authorization: 'Bearer owner' };

function examFields({ title, status, createdBy, startDate, endDate }) {
  const fields = {
    title: { stringValue: title },
    status: { stringValue: status },
    createdBy: { stringValue: createdBy },
    timeLimitMinutes: { integerValue: '30' },
    passingPercent: { integerValue: '50' },
    questions: {
      arrayValue: {
        values: [{
          mapValue: {
            fields: {
              id: { stringValue: 'q1' },
              text: { stringValue: 'Pick A' },
              category: { stringValue: 'Rules' },
              choices: { arrayValue: { values: [{ stringValue: 'A' }, { stringValue: 'B' }] } },
              correctIndex: { integerValue: '0' },
            },
          },
        }],
      },
    },
  };
  if (startDate) fields.startDate = { timestampValue: startDate };
  if (endDate) fields.endDate = { timestampValue: endDate };
  return { fields };
}

async function seedExam(request, examId, overrides) {
  const response = await request.patch(`${DOCS_URL}/exams/${examId}`, {
    headers: OWNER_AUTH,
    data: examFields(overrides),
  });
  expect(response.ok()).toBeTruthy();
}

async function removeExam(request, examId) {
  await request.delete(`${DOCS_URL}/exams/${examId}`, { headers: OWNER_AUTH });
}

async function signInAnonymously(page) {
  await page.goto('/index.html?test=true', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__FIREBASE_AUTH__ !== undefined, { timeout: 30000 });

  const user = await page.evaluate(async () => {
    const authUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => /firebase_auth\.js/.test(name));
    if (!authUrl) throw new Error('firebase/auth module URL not found');

    const auth = window.__FIREBASE_AUTH__;
    const { signInAnonymously, onAuthStateChanged } = await import(authUrl);

    if (!auth.currentUser) {
      await new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
          if (u) { unsubscribe(); resolve(u); }
        }, reject);
        signInAnonymously(auth).catch(reject);
      });
    }
    return { uid: auth.currentUser.uid, isAnonymous: auth.currentUser.isAnonymous };
  });

  expect(user.isAnonymous).toBe(true);
  return user;
}

test.describe('Firestore security rules', () => {
  test('student cannot read/start drafts but can review a closed published exam', async ({ page, request }) => {
    const stamp = Date.now();
    const draftId = `rules-draft-${stamp}`;
    const closedId = `rules-closed-${stamp}`;

    await seedExam(request, draftId, {
      title: 'Draft exam (must stay hidden)',
      status: 'draft',
      createdBy: 'test-admin-uid',
      startDate: '2020-01-01T00:00:00Z',
    });
    await seedExam(request, closedId, {
      title: 'Closed published exam',
      status: 'published',
      createdBy: 'test-admin-uid',
      startDate: '2020-01-01T00:00:00Z',
      endDate: '2020-02-01T00:00:00Z',
    });

    try {
      await signInAnonymously(page);

      const result = await page.evaluate(async ({ draftId, closedId }) => {
        const firestoreUrl = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((name) => /firebase_firestore\.js/.test(name));
        if (!firestoreUrl) throw new Error('firebase/firestore module URL not found');

        const auth = window.__FIREBASE_AUTH__;
        const db = window.__FIREBASE_DB__;
        const {
          collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
        } = await import(firestoreUrl);

        const out = {};

        try {
          const snap = await getDoc(doc(db, 'exams', draftId));
          out.draftGet = snap.exists() ? 'allowed' : 'missing';
        } catch (error) {
          out.draftGet = error.code || String(error);
        }

        try {
          const snap = await getDoc(doc(db, 'exams', closedId));
          out.closedGet = snap.exists() ? 'allowed' : 'missing';
        } catch (error) {
          out.closedGet = error.code || String(error);
        }

        try {
          await setDoc(doc(db, 'submissions', `rules-draft-sub-${Date.now()}`), {
            examId: draftId,
            studentName: 'Rules Student',
            studentEmail: 'rules@test.com',
            studentUid: auth.currentUser.uid,
            startedAt: serverTimestamp(),
            submittedAt: null,
            answers: [],
          });
          out.draftSubmit = 'allowed';
        } catch (error) {
          out.draftSubmit = error.code || String(error);
        }

        try {
          const snap = await getDocs(collection(db, 'submissions'));
          out.submissions = `allowed:${snap.size}`;
        } catch (error) {
          out.submissions = error.code || String(error);
        }

        try {
          const snap = await getDocs(collection(db, 'exams'));
          out.exams = `allowed:${snap.size}`;
        } catch (error) {
          out.exams = error.code || String(error);
        }

        try {
          await setDoc(doc(db, 'exams', `student-created-${Date.now()}`), {
            title: 'Should never be created',
            createdBy: auth.currentUser.uid,
            questions: [],
            createdAt: serverTimestamp(),
          });
          out.createExam = 'allowed';
        } catch (error) {
          out.createExam = error.code || String(error);
        }

        return out;
      }, { draftId, closedId });

      expect(result.draftGet).toBe('permission-denied');
      expect(result.closedGet).toBe('allowed');
      expect(result.draftSubmit).toBe('permission-denied');
      expect(result.submissions).toBe('permission-denied');
      expect(result.exams).toBe('permission-denied');
      expect(result.createExam).toBe('permission-denied');
    } finally {
      await removeExam(request, draftId);
      await removeExam(request, closedId);
    }
  });

  test('admin can manage an exam owned by another uid (legacy content)', async ({ page, request }) => {
    const examId = `rules-foreign-${Date.now()}`;
    await seedExam(request, examId, {
      title: 'Legacy foreign-owned exam',
      status: 'published',
      createdBy: 'legacy-service-uid',
      startDate: '2020-01-01T00:00:00Z',
    });

    try {
      await signInAsAdmin(page);
      await page.waitForFunction(() => window.__FIREBASE_AUTH__?.currentUser?.uid, null, { timeout: 20000 });

      const result = await page.evaluate(async ({ examId }) => {
        const firestoreUrl = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((name) => /firebase_firestore\.js/.test(name));
        if (!firestoreUrl) throw new Error('firebase/firestore module URL not found');

        const auth = window.__FIREBASE_AUTH__;
        const db = window.__FIREBASE_DB__;
        const {
          collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp,
        } = await import(firestoreUrl);

        const out = { uid: auth.currentUser.uid };
        out.submissions = (await getDocs(collection(db, 'submissions'))).size;
        out.exams = (await getDocs(collection(db, 'exams'))).size;

        // Foreign-owned exam: update must not require ownership.
        try {
          await updateDoc(doc(db, 'exams', examId), { title: 'Updated by admin' });
          out.updated = true;
          const snap = await getDoc(doc(db, 'exams', examId));
          out.updatedTitle = snap.data()?.title;
        } catch (error) {
          out.updateError = error.code || String(error);
        }

        try {
          await deleteDoc(doc(db, 'exams', examId));
          out.deleted = true;
        } catch (error) {
          out.deleteError = error.code || String(error);
        }

        // A newly created exam still belongs to the admin and can be removed.
        const ownId = `rules-admin-${Date.now()}`;
        try {
          await setDoc(doc(db, 'exams', ownId), {
            title: 'Admin rules test',
            createdBy: auth.currentUser.uid,
            status: 'draft',
            questions: [],
            createdAt: serverTimestamp(),
          });
          out.created = true;
          await deleteDoc(doc(db, 'exams', ownId));
          out.deletedOwn = true;
        } catch (error) {
          out.createError = error.code || String(error);
        }

        return out;
      }, { examId });

      expect(result.submissions).toBeGreaterThanOrEqual(0);
      expect(result.exams).toBeGreaterThanOrEqual(0);
      expect(result.updated).toBe(true);
      expect(result.updatedTitle).toBe('Updated by admin');
      expect(result.deleted).toBe(true);
      expect(result.created).toBe(true);
      expect(result.deletedOwn).toBe(true);
      expect(result.updateError).toBeUndefined();
      expect(result.deleteError).toBeUndefined();
      expect(result.createError).toBeUndefined();
    } finally {
      await removeExam(request, examId);
    }
  });
});
