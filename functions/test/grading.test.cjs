'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { gradeAttempt, percentageFor } = require('../grading.cjs');

const questions = [
  { id: 'q1', category: 'Math' },
  { id: 'q2', category: 'Math' },
  { id: 'q3', category: 'Science' },
];

const answerKey = { q1: 1, q2: 2, q3: 3 };

test('all correct answers score 100% and pass', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 3 },
    ],
    passingPercent: 70,
  });

  assert.equal(result.score, 3);
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
  assert.deepEqual(result.answers, [
    { questionId: 'q1', selectedIndex: 1, correctIndex: 1, isCorrect: true },
    { questionId: 'q2', selectedIndex: 2, correctIndex: 2, isCorrect: true },
    { questionId: 'q3', selectedIndex: 3, correctIndex: 3, isCorrect: true },
  ]);
});

test('all wrong answers score 0% and fail', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 0 },
    ],
    passingPercent: 70,
  });

  assert.equal(result.score, 0);
  assert.equal(result.percentage, 0);
  assert.equal(result.passed, false);
  assert.equal(result.answers.every((answer) => answer.isCorrect === false), true);
});

test('mixed answers use the 1-decimal percentage and the passing threshold', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 3 },
    ],
    passingPercent: 70,
  });

  assert.equal(result.score, 2);
  assert.equal(result.percentage, 66.7);
  assert.equal(result.passed, false);

  const lenient = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 3 },
    ],
    passingPercent: 60,
  });
  assert.equal(lenient.passed, true);
});

test('unanswered and invalid selections are stored as -1', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: -1 },
      { questionId: 'q2', selectedIndex: 4 },
      { questionId: 'q3', selectedIndex: 1.9 },
    ],
  });

  assert.equal(result.score, 0);
  assert.deepEqual(
    result.answers.map((answer) => answer.selectedIndex),
    [-1, -1, 1]
  );
  assert.equal(result.answers[2].isCorrect, false);
});

test('missing answers array grades every question as unanswered', () => {
  const result = gradeAttempt({ questions, answerKey });

  assert.equal(result.score, 0);
  assert.equal(result.totalQuestions, 3);
  assert.deepEqual(
    result.answers.map((answer) => answer.selectedIndex),
    [-1, -1, -1]
  );
});

test('missing answerKey entries fall back to inline correctIndex, then 0', () => {
  const inlineQuestions = [
    { id: 'q1', correctIndex: 2 },
    { id: 'q2', correctIndex: 1 },
    { id: 'q3' },
  ];

  const result = gradeAttempt({
    questions: inlineQuestions,
    answerKey: { q1: 3 },
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 3 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 0 },
    ],
  });

  assert.deepEqual(
    result.answers.map((answer) => answer.correctIndex),
    [3, 1, 0]
  );
  assert.equal(result.score, 3);
});

test('invalid answerKey values fall back to inline correctIndex', () => {
  const result = gradeAttempt({
    questions: [
      { id: 'q1', correctIndex: 2 },
      { id: 'q2', correctIndex: 1 },
      { id: 'q3', correctIndex: 3 },
    ],
    answerKey: { q1: 5, q2: 1.5, q3: '2' },
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 2 },
      { questionId: 'q2', selectedIndex: 1 },
      { questionId: 'q3', selectedIndex: 3 },
    ],
  });

  assert.deepEqual(
    result.answers.map((answer) => answer.correctIndex),
    [2, 1, 3]
  );
  assert.equal(result.score, 3);
});

test('unknown and duplicate questionIds are ignored', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 0 },
      { questionId: 'q1', selectedIndex: 1 }, // duplicate: ignored
      { questionId: 'ghost', selectedIndex: 3 }, // unknown: ignored
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 3 },
    ],
  });

  assert.equal(result.score, 2);
  assert.deepEqual(
    result.answers.map((answer) => answer.selectedIndex),
    [0, 2, 3]
  );
});

test('missing or invalid question ids never produce undefined fields', () => {
  const result = gradeAttempt({
    questions: [{ id: undefined, category: 'X' }, { id: null }, { id: 7 }],
    answerKey: { 7: 1 },
    studentAnswers: [
      { questionId: 7, selectedIndex: 1 },
      { questionId: '7', selectedIndex: 0 }, // duplicate (same id): ignored
    ],
  });

  assert.equal(result.answers[0].questionId, '');
  assert.equal(result.answers[1].questionId, '');
  assert.equal(result.answers[2].questionId, 7);
  assert.equal(result.score, 1);
  for (const answer of result.answers) {
    assert.notEqual(answer.questionId, undefined);
    assert.notEqual(answer.questionId, null);
  }
});

test('categoryStats match the client shape', () => {
  const result = gradeAttempt({
    questions: [
      ...questions,
      { id: 'q4' }, // no category: excluded from stats
    ],
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
      { questionId: 'q3', selectedIndex: 3 },
      { questionId: 'q4', selectedIndex: 0 },
    ],
  });

  assert.deepEqual(result.categoryStats, {
    Math: { total: 2, correct: 1, percentage: 50 },
    Science: { total: 1, correct: 1, percentage: 100 },
  });
});

test('percentageFor rounds to one decimal place', () => {
  assert.equal(percentageFor(1, 3), 33.3);
  assert.equal(percentageFor(2, 3), 66.7);
  assert.equal(percentageFor(1, 6), 16.7);
  assert.equal(percentageFor(5, 6), 83.3);
  assert.equal(percentageFor(0, 0), 0);
  assert.equal(percentageFor(3, 3), 100);
});

test('empty question list grades safely', () => {
  const result = gradeAttempt({ questions: [], answerKey: {}, studentAnswers: [] });

  assert.deepEqual(result, {
    score: 0,
    totalQuestions: 0,
    percentage: 0,
    passed: false,
    answers: [],
    categoryStats: {},
  });
});

test('passing uses the raw percentage, like the client', () => {
  // 2/3 = 66.666…%; the stored percentage rounds to 66.7, but a 66.7 threshold
  // must still fail (js/grading.js compares the unrounded value).
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 0 },
    ],
    passingPercent: 66.7,
  });

  assert.equal(result.percentage, 66.7);
  assert.equal(result.passed, false);
});

test('defaults passingPercent to 70', () => {
  const result = gradeAttempt({
    questions,
    answerKey,
    studentAnswers: [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 2 },
      { questionId: 'q3', selectedIndex: 0 },
    ],
  });

  assert.equal(result.percentage, 66.7);
  assert.equal(result.passed, false);
});
