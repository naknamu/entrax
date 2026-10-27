'use strict';

/**
 * Pure grading logic for server-side exam submission.
 *
 * This module intentionally has no Firebase imports so it can be unit tested
 * with plain Node (`node --test`) and reused by scripts.
 *
 * Correct answers are resolved per question in this order:
 *   1. `answerKey[question.id]` (from the admin-only `examKeys/{examId}` doc)
 *   2. `question.correctIndex` (legacy inline value)
 *   3. 0
 */

const MIN_CHOICE_INDEX = 0;
const MAX_CHOICE_INDEX = 3;

/**
 * Round a score to a percentage with one decimal place.
 * Matches the client (`js/grading.js`): Math.round(score / total * 1000) / 10.
 *
 * @param {number} score
 * @param {number} total
 * @returns {number}
 */
function percentageFor(score, total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safeScore = Number.isFinite(score) ? score : 0;
  return Math.round((safeScore / total) * 1000) / 10;
}

/**
 * Normalize a student answer to a choice index. Anything that is not a finite
 * number in 0..3 is treated as unanswered (-1).
 *
 * @param {*} value
 * @returns {number}
 */
function selectedIndexFor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return -1;
  const index = Math.trunc(value);
  return index >= MIN_CHOICE_INDEX && index <= MAX_CHOICE_INDEX ? index : -1;
}

/**
 * Normalize a correct-answer value. Unlike a student answer, an invalid key is
 * reported as null so the caller can fall back to another source.
 *
 * @param {*} value
 * @returns {number|null}
 */
function correctIndexFor(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= MIN_CHOICE_INDEX && value <= MAX_CHOICE_INDEX ? value : null;
}

function resolveCorrectIndex(question, answerKey) {
  const key = idKey(question && question.id);
  if (key !== null && answerKey && typeof answerKey === 'object') {
    const fromKey = correctIndexFor(answerKey[key]);
    if (fromKey !== null) return fromKey;
  }
  const inline = correctIndexFor(question && question.correctIndex);
  return inline !== null ? inline : 0;
}

/**
 * Normalize a question id to a Map key. Strings and finite numbers are
 * accepted (legacy exams may use numeric ids); anything else is unusable.
 *
 * @param {*} value
 * @returns {string|null}
 */
function idKey(value) {
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Grade an attempt.
 *
 * @param {Object} input
 * @param {Array<{id: string, category?: string, correctIndex?: number}>} input.questions
 * @param {Object<string, number>} [input.answerKey] - questionId -> correctIndex
 * @param {Array<{questionId: string, selectedIndex: number}>} [input.studentAnswers]
 * @param {number} [input.passingPercent=70]
 * @returns {{
 *   score: number,
 *   totalQuestions: number,
 *   percentage: number,
 *   passed: boolean,
 *   answers: Array<{questionId: *, selectedIndex: number, correctIndex: number, isCorrect: boolean}>,
 *   categoryStats: Object<string, {total: number, correct: number, percentage: number}>
 * }}
 */
function gradeAttempt({ questions, answerKey, studentAnswers, passingPercent } = {}) {
  const list = Array.isArray(questions) ? questions : [];
  const totalQuestions = list.length;

  // Only the first answer for a given questionId counts; unknown ids and
  // duplicates are ignored.
  const selectedByQuestion = new Map();
  if (Array.isArray(studentAnswers)) {
    for (const answer of studentAnswers) {
      if (!answer || typeof answer !== 'object') continue;
      const key = idKey(answer.questionId);
      if (key === null) continue;
      if (selectedByQuestion.has(key)) continue;
      selectedByQuestion.set(key, selectedIndexFor(answer.selectedIndex));
    }
  }

  const categoryMap = new Map();
  const answers = new Array(totalQuestions);
  let score = 0;

  for (let index = 0; index < totalQuestions; index += 1) {
    const question = list[index] || {};
    const key = idKey(question.id);
    // Never emit `undefined` (Firestore rejects it); malformed questions get ''.
    const questionId = key === null ? '' : question.id;
    const selectedIndex = key !== null && selectedByQuestion.has(key)
      ? selectedByQuestion.get(key)
      : -1;
    const correctIndex = resolveCorrectIndex(question, answerKey);
    const isCorrect = selectedIndex >= 0 && selectedIndex === correctIndex;

    if (isCorrect) score += 1;

    answers[index] = { questionId, selectedIndex, correctIndex, isCorrect };

    const category = question.category ? String(question.category) : '';
    if (!category) continue;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { total: 0, correct: 0, percentage: 0 });
    }
    const stats = categoryMap.get(category);
    stats.total += 1;
    if (isCorrect) stats.correct += 1;
  }

  for (const stats of categoryMap.values()) {
    stats.percentage = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  }

  const percentage = percentageFor(score, totalQuestions);
  // Match the client (`js/grading.js`): pass/fail is decided on the *raw*
  // percentage, while the stored percentage is rounded to one decimal. Comparing
  // the rounded value would let 2/3 pass a 66.7 threshold.
  const rawPercentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
  const threshold =
    typeof passingPercent === 'number' && Number.isFinite(passingPercent) ? passingPercent : 70;

  return {
    score,
    totalQuestions,
    percentage,
    passed: rawPercentage >= threshold,
    answers,
    // Object.fromEntries defines own properties safely (even for odd keys).
    categoryStats: Object.fromEntries(categoryMap),
  };
}

module.exports = { gradeAttempt, percentageFor };
