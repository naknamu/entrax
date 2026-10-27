/**
 * Admin audit log (Phase 0.6).
 *
 * Append-only record of privileged actions. Firestore rules are the real
 * enforcement:
 *   - `create` only for a token with `role: admin`, with `actorUid` equal to
 *     the caller and `createdAt` equal to `request.time`
 *   - `read` admin-only; `update` / `delete` denied
 *
 * This helper is best-effort: an audit write must never block or fail the
 * admin action that triggered it, so every failure is swallowed with a warning.
 * The caller should not await it before finishing the real work (or may, but
 * the promise never rejects).
 *
 * Keep `details` small and non-sensitive: an action name, ids, counts, and
 * maybe the changed field names. Never log passwords, tokens, full submission
 * answers, or student PII beyond what the action itself targets.
 */

import { auth, db } from '@/firebase.js';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const AUDIT_LOGS_COLLECTION = 'auditLogs';

/**
 * Write one admin audit entry.
 *
 * @param {string} action Short dotted action name, e.g. 'exam.delete'.
 * @param {Object} [options]
 * @param {string|null} [options.targetType] Collection/entity touched ('exam', 'submission', ...).
 * @param {string|null} [options.targetId] Document id of the target, if any.
 * @param {Object|null} [options.details] Small plain object (no secrets, no answers).
 * @returns {Promise<string|null>} New document id, or null when skipped/failed.
 */
export async function logAdminAction(action, {
  targetType = null,
  targetId = null,
  details = null,
} = {}) {
  const user = auth.currentUser;
  if (!user) {
    console.warn('[audit-log] no signed-in user, skipping audit entry:', action);
    return null;
  }

  try {
    const ref = await addDoc(collection(db, AUDIT_LOGS_COLLECTION), {
      actorUid: user.uid,
      actorEmail: user.email || null,
      action,
      targetType,
      targetId,
      details,
      // Must be the server timestamp: rules require createdAt == request.time.
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    // Never throw: audit logging is observability, not a gate.
    console.warn('[audit-log] could not write audit entry:', action, error);
    return null;
  }
}

export default logAdminAction;
