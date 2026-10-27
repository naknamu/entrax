/**
 * Admin-page guard regression tests (Phase 0.1).
 *
 * Admin pages are protected by Firestore rules (role: admin claim). The
 * ensureAdmin() guard is the UX layer: visitors who are not admins must be
 * redirected instead of seeing an empty/blocked dashboard.
 */

import { test, expect } from '@playwright/test';
import { signInAsAdmin } from './utils.js';

test.describe('Admin guard', () => {
  test('anonymous visitor is redirected away from the admin dashboard', async ({ page }) => {
    await page.goto('/admin-dashboard.html', { waitUntil: 'domcontentloaded' });

    // Signed-out visitors go to the admin login page (admin-login.html); a
    // signed-in non-admin would go to the student portal.
    await page.waitForURL(/student\.html|admin-login\.html/, { timeout: 20000 });
    await expect(page).toHaveURL(/student\.html|admin-login\.html/);
    await expect(page.locator('h1')).not.toContainText('Admin Dashboard');
  });

  test('admin still reaches the dashboard', async ({ page }) => {
    await signInAsAdmin(page);

    await expect(page).toHaveURL(/admin-dashboard\.html/);
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    // Dashboard data loaded (not redirected mid-load).
    await expect(page.locator('#exams-tbody tr').first()).toBeVisible({ timeout: 20000 });
  });
});
