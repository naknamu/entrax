/**
 * Seeds a sample exam into the Firestore emulator for layout verification.
 * Run after `npm run emulators` is up. Uses the fixed ID sample-exam-layout-fix
 * so Playwright scripts can target it deterministically.
 *
 * The web app (via .env.development) uses projectId entrax-878a1, while the
 * emulator is typically started with --project demo-test. With singleProjectMode
 * the emulator still keeps per-project data, so the exam is written under BOTH
 * project IDs so rules' exists()/get() lookups succeed for the browser.
 */
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const EXAM_ID = 'sample-exam-layout-fix';
const PROJECT_IDS = ['demo-test', 'entrax-878a1'];

const examData = {
  title: 'Layout Verification Exam',
  description: 'Seeded exam used to verify the exam-taking layout renders in multi-columns.',
  timeLimitMinutes: 30,
  passingPercent: 70,
  showResultsToStudent: true,
  randomizeQuestions: false,
  allowPrevious: true,
  sections: [
    { id: 'sec-math', title: 'Math', description: 'Arithmetic and problem solving' },
    { id: 'sec-reading', title: 'Reading', description: 'Comprehension questions' },
    { id: 'sec-science', title: 'Science', description: 'Life and physical science' }
  ],
  questions: [
    { id: 'q1', text: 'What is 2 + 2?', category: 'Math', choices: ['3', '4', '5', '6'], correctIndex: 1, sectionId: 'sec-math', solution: '2 + 2 = 4.' },
    { id: 'q2', text: 'What is the capital of France?', category: 'Geography', choices: ['London', 'Berlin', 'Paris', 'Madrid'], correctIndex: 2, sectionId: 'sec-reading', solution: 'Paris is the capital of France.' },
    { id: 'q3', text: 'Which planet is known as the Red Planet?', category: 'Science', choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1, sectionId: 'sec-science', solution: 'Mars has an iron-oxide-rich surface that appears red.' },
    { id: 'q4', text: 'What is the largest mammal?', category: 'Biology', choices: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'], correctIndex: 1, sectionId: 'sec-science', solution: 'The blue whale is the largest mammal.' },
    { id: 'q5', text: 'Who wrote "Romeo and Juliet"?', category: 'Literature', choices: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'], correctIndex: 1, sectionId: 'sec-reading', solution: 'William Shakespeare wrote Romeo and Juliet.' },
    { id: 'q6', text: 'What is the chemical symbol for water?', category: 'Chemistry', choices: ['H2O', 'CO2', 'O2', 'NaCl'], correctIndex: 0, sectionId: 'sec-science', solution: 'Water is H2O: two hydrogen atoms and one oxygen atom.' },
    { id: 'q7', text: 'Which ocean is the largest?', category: 'Geography', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3, sectionId: 'sec-reading', solution: 'The Pacific Ocean is the largest.' },
    { id: 'q8', text: 'What year did World War II end?', category: 'History', choices: ['1943', '1944', '1945', '1946'], correctIndex: 2, sectionId: 'sec-reading', solution: 'World War II ended in 1945.' },
    { id: 'q9', text: 'How many sides does a hexagon have?', category: 'Math', choices: ['5', '6', '7', '8'], correctIndex: 1, sectionId: 'sec-math', solution: 'A hexagon has 6 sides (hexa = six).' },
    { id: 'q10', text: 'Which gas do plants absorb from the atmosphere?', category: 'Science', choices: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctIndex: 2, sectionId: 'sec-science', solution: 'Plants absorb carbon dioxide for photosynthesis.' }
  ],
  startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)),
  endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000)),
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
};

(async () => {
  for (const pid of PROJECT_IDS) {
    const app = admin.initializeApp({ projectId: pid }, `seed-${pid}`);
    await app.firestore().collection('exams').doc(EXAM_ID).set(examData);
    console.log('Seeded exam into project:', pid);
  }
  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
