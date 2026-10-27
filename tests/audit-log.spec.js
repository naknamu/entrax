/**
 * Audit-log regression tests (Phase 0.6).
 *
 * Covers the two halves of the `auditLogs` contract:
 *   1. An admin's `logAdminAction()` writes a document whose `actorUid` is the
 *      caller and whose `createdAt` is a server timestamp, and an admin can
 *      query it back through the client SDK.
 *   2. Unauthenticated clients cannot create or read `auditLogs` — asserted
 *      against the emulator's REST API with no Authorization header, so the
 *      test does not depend on any UI or on a student sign-in helper.
 *
 * Import notes for page.evaluate (same constraints as security-rules.spec.js):
 * bare `firebase/firestore` specifiers are not rewritten by Vite inside an
 * evaluated string, so the SDK is resolved through the module URL the page
 * already loaded. `/js/audit-log.js` is imported through the dev server, which
 * resolves `@/firebase.js` to the same `/src/firebase.js` module instance the
 * page is using (a second instance would break the SDK's `instanceof` checks
 * and reconnect the emulators).
 *
 * Audit entries are append-only, so this spec intentionally leaves its
 * documents behind in the emulator (which is disposable and reseeded by
 * tests/global-setup.cjs).
 */

import { test, expect } from '@playwright/test';
import { injectEmulatorConfig, signInAsAdmin } from './utils.js';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
const PROJECT_ID = 'demo-test';
const DOCS_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

test.describe('Admin audit log', () => {
  test('admin action is written to auditLogs and readable by an admin', async ({ page }) => {
    await injectEmulatorConfig(page);
    await signInAsAdmin(page);
    await page.waitForFunction(
      () => window.__FIREBASE_AUTH__?.currentUser?.uid,
      null,
      { timeout: 20000 }
    );

    const targetId = `audit-target-${Date.now()}`;

    const result = await page.evaluate(async ({ targetId }) => {
      const { logAdminAction } = await import('/js/audit-log.js');

      const id = await logAdminAction('test.audit', {
        targetType: 'exam',
        targetId,
        details: { ok: true },
      });

      const firestoreUrl = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /firebase_firestore\.js/.test(name));
      if (!firestoreUrl) throw new Error('firebase/firestore module URL not found');

      const { collection, getDocs, query, where } = await import(firestoreUrl);
      const db = window.__FIREBASE_DB__;
      const uid = window.__FIREBASE_AUTH__.currentUser.uid;

      // Admin `list` of the collection, constrained the way the rules expect.
      const snap = await getDocs(
        query(collection(db, 'auditLogs'), where('actorUid', '==', uid))
      );
      const match = snap.docs.find((entry) => entry.id === id);
      const data = match?.data() ?? null;

      return {
        id,
        uid,
        found: Boolean(match),
        action: data?.action ?? null,
        targetType: data?.targetType ?? null,
        targetId: data?.targetId ?? null,
        detailsOk: data?.details?.ok === true,
        // Firestore Timestamp: seconds > 0 proves serverTimestamp() resolved.
        createdAtSeconds: data?.createdAt?.seconds ?? null,
      };
    }, { targetId });

    expect(typeof result.id, 'logAdminAction must return a document id').toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.found, 'audit doc must be queryable by the admin').toBe(true);
    expect(result.action).toBe('test.audit');
    expect(result.targetType).toBe('exam');
    expect(result.targetId).toBe(targetId);
    expect(result.detailsOk).toBe(true);
    expect(result.createdAtSeconds).toBeGreaterThan(0);
  });

  test('unauthenticated clients cannot create or read auditLogs', async ({ request }) => {
    // No Authorization header → request.auth == null → rules deny. The emulator
    // answers 403 (PERMISSION_DENIED); accept 401 too so this stays stable
    // across emulator versions.
    const stamp = Date.now();

    const create = await request.post(`${DOCS_URL}/auditLogs`, {
      data: {
        fields: {
          actorUid: { stringValue: 'unauthenticated-writer' },
          action: { stringValue: `test.audit.forged.${stamp}` },
          targetType: { stringValue: 'exam' },
          targetId: { stringValue: `forged-${stamp}` },
          details: { nullValue: null },
          createdAt: { timestampValue: new Date().toISOString() },
        },
      },
    });

    expect(create.ok(), 'unauthenticated create must not succeed').toBe(false);
    expect([401, 403]).toContain(create.status());

    const read = await request.get(`${DOCS_URL}/auditLogs`);

    expect(read.ok(), 'unauthenticated list must not succeed').toBe(false);
    expect([401, 403]).toContain(read.status());
  });
});
