/**
 * Test fixtures and seed data
 */

// Admin user for testing
const TEST_ADMIN = {
  email: 'admin@test.com',
  password: 'password123',
  displayName: 'Test Admin'
};

// Sample exam data
const SAMPLE_EXAM = {
  title: 'Sample Exam for Testing',
  description: 'This is a sample exam used for automated testing',
  timeLimitMinutes: 30,
  passingPercent: 70,
  showResultsToStudent: true,
  randomizeQuestions: false,
  allowPrevious: true,
  questions: [
    {
      text: 'What is 2 + 2?',
      category: 'Math',
      choices: ['3', '4', '5', '6'],
      correctIndex: 1
    },
    {
      text: 'What is the capital of France?',
      category: 'Geography',
      choices: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctIndex: 2
    },
    {
      text: 'Which planet is known as the Red Planet?',
      category: 'Science',
      choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctIndex: 1
    }
  ]
};

// Student test data
const TEST_STUDENTS = [
  {
    name: 'Alice Smith',
    email: 'alice@test.com',
    answers: [1, 2, 1], // All correct
    expectedScore: 3,
    expectedPercent: 100,
    expectedPass: true
  },
  {
    name: 'Bob Jones',
    email: 'bob@test.com',
    answers: [0, 0, 0], // All wrong
    expectedScore: 0,
    expectedPercent: 0,
    expectedPass: false
  },
  {
    name: 'Carol White',
    email: 'carol@test.com',
    answers: [1, 0, 2], // Mixed (2 correct)
    expectedScore: 2,
    expectedPercent: 66.7,
    expectedPass: false
  }
];

// Invalid exam data for validation tests
const INVALID_EXAMS = {
  noQuestions: {
    title: 'Invalid Exam',
    description: 'No questions',
    timeLimitMinutes: 30,
    passingPercent: 70,
    questions: []
  },
  noCorrectAnswer: {
    title: 'Invalid Exam',
    description: 'Question with no correct answer',
    timeLimitMinutes: 30,
    passingPercent: 70,
    questions: [
      {
        text: 'Test question?',
        category: 'Test',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: -1 // Invalid
      }
    ]
  },
  zeroTimeLimit: {
    title: 'Invalid Exam',
    description: 'Zero time limit',
    timeLimitMinutes: 0,
    passingPercent: 70,
    questions: [
      {
        text: 'Test question?',
        category: 'Test',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 0
      }
    ]
  },
  negativeTimeLimit: {
    title: 'Invalid Exam',
    description: 'Negative time limit',
    timeLimitMinutes: -5,
    passingPercent: 70,
    questions: [
      {
        text: 'Test question?',
        category: 'Test',
        choices: ['A', 'B', 'C', 'D'],
        correctIndex: 0
      }
    ]
  }
};

module.exports = {
  TEST_ADMIN,
  SAMPLE_EXAM,
  TEST_STUDENTS,
  INVALID_EXAMS
};