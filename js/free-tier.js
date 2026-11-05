/**
 * Free-tier boundary.
 *
 * The landing page promises a free tier: one full-length diagnostic, sample
 * practice sets, and the score breakdown. Everything else needs a paid plan
 * (`entitlements/{uid}`).
 *
 * The boundary lives in one document, `config/freeTier`:
 *
 *   { enabled: true, examIds: ['…', '…'] }
 *
 * Keeping it in config rather than on each exam document means the exam page
 * can decide access from a single small read, and the whole gate can be turned
 * off with one write. `scripts/mark-free-exams.cjs` seeds and edits it.
 *
 * **Fails open on purpose.** A missing document, `enabled: false`, or an empty
 * `examIds` all mean "no gate", so a config mistake can never lock every
 * student out of the catalogue.
 *
 * This is an honour-system gate, not a security boundary: until server grading
 * is on, exam documents are readable by any signed-in student and still carry
 * `correctIndex`. It exists to make the free/paid promise real, not to protect
 * paid content.
 */

import { doc, getDoc } from 'firebase/firestore';

const CONFIG_COLLECTION = 'config';
const CONFIG_ID = 'freeTier';

let cache = null;

/**
 * Read (and memoise) the free-tier config.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<{enabled: boolean, examIds: Set<string>}>}
 */
export async function loadFreeTier(db) {
  if (cache) return cache;

  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_ID));
    const data = snap.exists() ? snap.data() : {};
    const examIds = Array.isArray(data.examIds) ? data.examIds.filter(Boolean) : [];

    cache = {
      // An enabled gate with no exams listed would lock the whole catalogue,
      // which is never what anyone means. Treat it as off.
      enabled: data.enabled === true && examIds.length > 0,
      examIds: new Set(examIds),
    };
  } catch (err) {
    console.warn('Could not load the free-tier config; leaving the catalogue open:', err);
    cache = { enabled: false, examIds: new Set() };
  }

  return cache;
}

/** Drop the memoised config (used by tests that rewrite it mid-run). */
export function resetFreeTierCache() {
  cache = null;
}

/**
 * Decide whether a student may open an exam.
 *
 * @param {string} examId
 * @param {Object} access
 * @param {{enabled: boolean, examIds: Set<string>}} access.freeTier
 * @param {boolean} access.hasFullAccess  active entitlement (or admin)
 * @returns {boolean}
 */
export function canAccessExam(examId, { freeTier, hasFullAccess } = {}) {
  if (hasFullAccess) return true;
  if (!freeTier?.enabled) return true;
  return freeTier.examIds.has(examId);
}

/**
 * Copy for the paywall and the plan card. Kept here so the portal and the exam
 * page cannot drift apart.
 */
export const PAYWALL_COPY = {
  title: 'This set needs an Exam Pass',
  body: 'Your free account includes the full-length diagnostic and sample practice sets. An Exam Pass unlocks every practice set, every mock, and all explanations.',
  cta: 'See plans',
};
