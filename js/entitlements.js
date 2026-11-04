/**
 * Paid access ("entitlements").
 *
 * A student's paid access lives in `entitlements/{uid}`. Only the payment
 * webhook (Admin SDK) or an admin may write it — the browser can read its own
 * document and nothing else. That asymmetry is the whole security model: the
 * client never decides that it has paid.
 *
 * Document shape:
 *   {
 *     plan: 'pass' | 'extension' | 'lifetime',
 *     source: 'paddle' | 'admin' | 'grant',
 *     productId?: string,        // provider price/product id
 *     transactionId?: string,    // provider transaction id (refund/audit)
 *     purchasedAt?: Timestamp,
 *     accessUntil: Timestamp|null, // null = no fixed end (lifetime / grant)
 *     updatedAt: Timestamp,
 *   }
 *
 * @see firestore.rules — `entitlements/{uid}`
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase.js';
import { toDate } from '@js/firestore-helpers.js';

/**
 * The three one-time products. `priceLabel` is display copy only; the amount
 * actually charged comes from the Paddle price id, so keep this in sync with
 * the landing page (`index.html#pricing`) and the Paddle dashboard.
 */
export const PLANS = {
  pass: { id: 'pass', label: 'Exam Pass', priceLabel: '$19', days: 90 },
  extension: { id: 'extension', label: 'Extension', priceLabel: '$9', days: 90 },
  lifetime: { id: 'lifetime', label: 'Lifetime', priceLabel: '$49', days: null },
};

const FREE = Object.freeze({
  active: false,
  plan: 'free',
  label: 'Free',
  accessUntil: null,
  daysLeft: null,
  lifetime: false,
});

/**
 * Read the signed-in student's entitlement.
 * A missing document (never paid) or a denied read both mean "free tier" —
 * this must never throw into the portal's render path.
 *
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function getEntitlement(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'entitlements', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn('Could not load entitlement:', err?.code || err);
    return null;
  }
}

/**
 * Turn a raw entitlement document into something the UI can render.
 *
 * @param {Object|null} entitlement
 * @param {Date} [now]
 * @returns {{active: boolean, plan: string, label: string,
 *            accessUntil: Date|null, daysLeft: number|null, lifetime: boolean}}
 */
export function describeEntitlement(entitlement, now = new Date()) {
  if (!entitlement) return { ...FREE };

  const plan = PLANS[entitlement.plan] ? entitlement.plan : 'pass';
  const accessUntil = toDate(entitlement.accessUntil);
  // No fixed end: a Lifetime purchase, or an admin grant without an expiry.
  const lifetime = plan === 'lifetime' || accessUntil === null;
  const daysLeft = accessUntil
    ? Math.ceil((accessUntil.getTime() - now.getTime()) / 86400000)
    : null;
  const active = lifetime || daysLeft > 0;

  return {
    active,
    plan,
    label: PLANS[plan].label,
    accessUntil,
    daysLeft,
    lifetime,
  };
}

/**
 * One-line description for the account page.
 *
 * @param {ReturnType<typeof describeEntitlement>} status
 * @returns {string}
 */
export function entitlementSummary(status) {
  if (!status?.active) {
    return status?.accessUntil
      ? `Your ${status.label} ended ${formatDay(status.accessUntil)}.`
      : 'No paid access yet — the free tier is still available.';
  }
  if (status.lifetime) return 'Lifetime access. Thank you!';
  const days = status.daysLeft;
  if (days === 0) return `${status.label} ends today.`;
  return `${status.label} active — ${days} day${days === 1 ? '' : 's'} left.`;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
