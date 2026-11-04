/**
 * Paid access (entitlements).
 *
 * Access is read from `entitlements/{uid}`, which only the payment webhook
 * (Admin SDK) may write. These tests cover the three states the portal has to
 * render — free, active, expired — plus the rule that stops a student from
 * granting themselves a plan.
 *
 * Checkout itself stays dark in tests: no Paddle price ids are configured, so
 * the buy buttons must not appear.
 *
 * Run: npx playwright test tests/entitlements.spec.js
 */

import { test, expect } from '@playwright/test';
import {
  signInAsStudent,
  setFirestoreDoc,
  deleteFirestoreDoc,
  FIRESTORE_DOCS_URL,
} from './utils.js';

const DAY = 86400000;

async function openSettings(page) {
  await page.goto('/student.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#portal-view')).toBeVisible({ timeout: 20000 });
  await page.click('.student-nav-item[data-view="settings"]');
  await expect(page.locator('#settings-plan-badge')).toBeVisible();
}

test.describe('Entitlements', () => {
  test('a student with no purchase sees the free tier and no buy buttons', async ({ page }) => {
    await signInAsStudent(page, `plan-free-${Date.now()}@test.com`);
    await openSettings(page);

    await expect(page.locator('#settings-plan-badge')).toHaveText('Free');
    await expect(page.locator('#settings-plan-detail')).toContainText('No paid access yet');

    // Checkout is not configured in the test env, so nothing is for sale yet.
    await expect(page.locator('#settings-plan-actions')).toBeHidden();
    await expect(page.locator('#settings-plan-hint')).toContainText('Checkout opens soon');
  });

  test('an active Exam Pass shows the plan and the days left', async ({ page, request }) => {
    await signInAsStudent(page, `plan-active-${Date.now()}@test.com`);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    const path = `entitlements/${uid}`;

    try {
      await setFirestoreDoc(request, path, {
        plan: 'pass',
        source: 'paddle',
        transactionId: 'txn_test_1',
        purchasedAt: new Date(),
        accessUntil: new Date(Date.now() + 30 * DAY),
        updatedAt: new Date(),
      });

      await openSettings(page);

      await expect(page.locator('#settings-plan-badge')).toHaveText('Exam Pass');
      await expect(page.locator('#settings-plan-badge')).toHaveClass(/badge-success/);
      await expect(page.locator('#settings-plan-detail')).toHaveText(
        /Exam Pass active — 30 days left/
      );
    } finally {
      await deleteFirestoreDoc(request, path);
    }
  });

  test('a lapsed pass falls back to the free tier', async ({ page, request }) => {
    await signInAsStudent(page, `plan-expired-${Date.now()}@test.com`);
    const uid = await page.evaluate(() => window.__FIREBASE_AUTH__?.currentUser?.uid);
    const path = `entitlements/${uid}`;

    try {
      await setFirestoreDoc(request, path, {
        plan: 'pass',
        source: 'paddle',
        purchasedAt: new Date(Date.now() - 120 * DAY),
        accessUntil: new Date(Date.now() - DAY),
        updatedAt: new Date(),
      });

      await openSettings(page);

      await expect(page.locator('#settings-plan-badge')).toHaveText('Free');
      await expect(page.locator('#settings-plan-detail')).toContainText('ended');
    } finally {
      await deleteFirestoreDoc(request, path);
    }
  });

  test('a student cannot write their own entitlement', async ({ page, request }) => {
    await signInAsStudent(page, `plan-forge-${Date.now()}@test.com`);

    const { uid, token } = await page.evaluate(async () => ({
      uid: window.__FIREBASE_AUTH__?.currentUser?.uid,
      token: await window.__FIREBASE_AUTH__?.currentUser?.getIdToken(),
    }));
    expect(uid).toBeTruthy();

    // Same REST surface the client SDK uses, with the student's own ID token.
    const res = await request.patch(`${FIRESTORE_DOCS_URL}/entitlements/${uid}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { fields: { plan: { stringValue: 'lifetime' } } },
    });

    expect(res.status(), 'a client write must be denied by firestore.rules').toBe(403);
  });
});
