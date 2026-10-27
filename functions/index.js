'use strict';

/**
 * Cloud Functions for the exam platform.
 *
 * Phase 0.3: when `config/features.serverGrading` is true, clients can only
 * create/autosave an ungraded draft submission; the score is computed here in
 * `submitAttempt` using the admin-only `examKeys/{examId}` document.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
// Use the modular subpath rather than `admin.firestore.FieldValue`: the
// Functions emulator wraps the `firebase-admin` module in a proxy whose
// `firestore` export is a bound function, and bound functions lose their
// static properties (FieldValue, Timestamp, ...). In production both forms are
// the same class; in the emulator only this one is defined.
const { FieldValue } = require('firebase-admin/firestore');
const { gradeAttempt } = require('./grading.cjs');

admin.initializeApp();

const db = admin.firestore();

const MAX_ANSWERS = 500;
const MAX_TAB_SWITCHES = 10000;
const MAX_FLAGGED_INDEX = 499;
const MAX_ID_LENGTH = 200;

const DEFAULT_PASSING_PERCENT = 70;
const DEFAULT_TIME_LIMIT_MINUTES = 60;

function requireId(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${field} must be a non-empty string.`
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_ID_LENGTH) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${field} is too long.`
    );
  }
  return trimmed;
}

function sanitizeTabSwitchCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_TAB_SWITCHES, Math.max(0, Math.trunc(value)));
}

function sanitizeFlaggedQuestions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const result = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const index = Math.trunc(item);
    if (index < 0 || index > MAX_FLAGGED_INDEX || seen.has(index)) continue;
    seen.add(index);
    result.push(index);
    if (result.length >= MAX_ANSWERS) break;
  }
  return result;
}

function toMillis(value) {
  if (value == null) return null;
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return null;
}

function toNonNegativeInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function toPercentage(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Clamp the attempt duration to the server clock and the exam's own limits.
 * A client-supplied duration is never trusted, and a submit that lands a few
 * seconds after the deadline is not rejected (the client auto-submits on a
 * timer, and network latency is expected).
 */
function computeTimeTakenMs(submission, exam, now) {
  const startedAt = toMillis(submission.startedAt);
  if (startedAt == null) return 0;

  const elapsed = Math.max(0, now - startedAt);
  const bounds = [elapsed];

  const minutes = exam.timeLimitMinutes;
  const effectiveMinutes =
    typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
      ? minutes
      : DEFAULT_TIME_LIMIT_MINUTES;
  bounds.push(effectiveMinutes * 60 * 1000);

  const endsAt = toMillis(exam.endDate);
  if (endsAt != null) bounds.push(Math.max(0, endsAt - startedAt));

  return Math.max(0, Math.min(...bounds));
}

/**
 * The callable's public result. Deliberately excludes `answerKey` and any
 * timestamps.
 */
function buildResult(submissionId, data) {
  return {
    submissionId,
    score: toNonNegativeInteger(data.score),
    totalQuestions: toNonNegativeInteger(data.totalQuestions),
    percentage: toPercentage(data.percentage),
    passed: data.passed === true,
    autoSubmitted: data.autoSubmitted === true,
    categoryStats: isPlainObject(data.categoryStats) ? data.categoryStats : {},
    answers: Array.isArray(data.answers) ? data.answers : [],
  };
}

exports.submitAttempt = functions.https.onCall(async (data, context) => {
  const auth = context && context.auth;
  if (!auth || !auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to submit an exam.'
    );
  }

  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Anonymous accounts cannot submit exams.'
    );
  }

  const payload = isPlainObject(data) ? data : {};
  const submissionId = requireId(payload.submissionId, 'submissionId');
  const examId = requireId(payload.examId, 'examId');

  if (!Array.isArray(payload.answers)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'answers must be an array.'
    );
  }
  if (payload.answers.length > MAX_ANSWERS) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `answers must contain at most ${MAX_ANSWERS} entries.`
    );
  }

  const uid = auth.uid;
  const submissionRef = db.collection('submissions').doc(submissionId);
  const examRef = db.collection('exams').doc(examId);
  const keyRef = db.collection('examKeys').doc(examId);

  const result = await db.runTransaction(async (transaction) => {
    const submissionSnap = await transaction.get(submissionRef);
    if (!submissionSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Submission not found.');
    }

    const submission = submissionSnap.data() || {};
    if (submission.studentUid !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'This submission belongs to another student.'
      );
    }
    if (submission.examId !== examId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Submission does not belong to the supplied exam.'
      );
    }

    // Idempotent: a retried call (or an auto-submit racing a manual submit)
    // returns the stored grade instead of grading twice.
    if (submission.submittedAt != null) {
      return buildResult(submissionId, submission);
    }

    const examSnap = await transaction.get(examRef);
    const keySnap = await transaction.get(keyRef);

    if (!examSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Exam not found.');
    }
    const exam = examSnap.data() || {};
    if (exam.status !== 'published') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This exam is not published.'
      );
    }
    if (!Array.isArray(exam.questions) || exam.questions.length === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This exam has no questions.'
      );
    }

    const answerKey =
      keySnap.exists && isPlainObject(keySnap.data().answers)
        ? keySnap.data().answers
        : {};

    const graded = gradeAttempt({
      questions: exam.questions,
      answerKey,
      studentAnswers: payload.answers,
      passingPercent:
        typeof exam.passingPercent === 'number'
          ? exam.passingPercent
          : DEFAULT_PASSING_PERCENT,
    });

    const now = Date.now();
    const autoSubmitted = payload.autoSubmitted === true;
    const tabSwitchCount = sanitizeTabSwitchCount(
      payload.tabSwitchCount != null ? payload.tabSwitchCount : submission.tabSwitchCount
    );
    const flaggedQuestions = sanitizeFlaggedQuestions(
      payload.flaggedQuestions != null
        ? payload.flaggedQuestions
        : submission.flaggedQuestions
    );
    const timeTakenMs = computeTimeTakenMs(submission, exam, now);

    const gradedFields = {
      answers: graded.answers,
      score: graded.score,
      totalQuestions: graded.totalQuestions,
      percentage: graded.percentage,
      passed: graded.passed,
      autoSubmitted,
      timeTakenMs,
      tabSwitchCount,
      flaggedQuestions,
      categoryStats: graded.categoryStats,
    };

    transaction.update(submissionRef, {
      ...gradedFields,
      submittedAt: FieldValue.serverTimestamp(),
      gradedBy: 'server',
    });

    return buildResult(submissionId, gradedFields);
  });

  return result;
});
