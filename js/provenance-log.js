/**
 * Provenance Log — lightweight content-origin tracker for generated questions.
 *
 * Use cases:
 *  - Debugging bad question banks by tracing back to a generator call.
 *  - Auditing which batch/version produced a set of questions.
 *  - Re-running a specific seed if needed.
 */

const LOG_KEY = 'nightingale_provenance_log';

export function logProvenance(entry) {
  try {
    const existing = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    existing.push({
      ...entry,
      loggedAt: new Date().toISOString(),
    });
    // Keep last 200 entries to avoid unbounded growth.
    const trimmed = existing.slice(-200);
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // Never throw on logging.
  }
}

export function getProvenanceLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearProvenanceLog() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    // ignore
  }
}
