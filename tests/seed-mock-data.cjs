/**
 * Seed comprehensive mock data into the Firestore emulator for local development.
 *
 * Creates:
 *   - Admin user (admin@test.com / password123)
 *   - Student user (student@test.com / password123) with a profile doc
 *   - 5 exams in various states (open, upcoming, expired, no questions, etc.)
 *   - 6 submissions for the student (varied scores/dates) so the dashboard has real stats
 *
 * Usage:
 *   1. npm run emulators   (wait for auth 9099 + firestore 8081)
 *   2. npm run seed:mock
 */
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_IDS = ['demo-test', 'entrax-878a1'];

// ── helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 86400000));
}
function daysFromNow(n) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() + n * 86400000));
}

// ── exam templates ───────────────────────────────────────────────────────────
const exams = [
  {
    id: 'mock-math-101',
    title: 'Mathematics 101 — Algebra & Geometry',
    description: 'Covers linear equations, quadratic formulas, area/volume, and coordinate geometry. Designed for first-year undergraduates.',
    timeLimitMinutes: 45,
    passingPercent: 65,
    showResultsToStudent: true,
    randomizeQuestions: true,
    allowPrevious: true,
    sections: [
      { id: 'sec-alg', title: 'Algebra', description: 'Equations, inequalities, and functions' },
      { id: 'sec-geo', title: 'Geometry', description: 'Shapes, area, volume, and proofs' },
    ],
    questions: [
      { id: 'm1', text: 'Solve for x: 2x + 5 = 17', category: 'Algebra', choices: ['4', '6', '8', '10'], correctIndex: 1, sectionId: 'sec-alg', solution: '2x = 12, so x = 6.' },
      { id: 'm2', text: 'What is the area of a triangle with base 10 and height 6?', category: 'Geometry', choices: ['16', '30', '32', '60'], correctIndex: 1, sectionId: 'sec-geo', solution: 'Area = ½ × base × height = ½ × 10 × 6 = 30.' },
      { id: 'm3', text: 'What is the slope of the line y = 3x − 7?', category: 'Algebra', choices: ['−7', '3', '7', '−3'], correctIndex: 1, sectionId: 'sec-alg', solution: 'Slope is the coefficient of x, which is 3.' },
      { id: 'm4', text: 'A circle has radius 5. What is its circumference? (use π ≈ 3.14)', category: 'Geometry', choices: ['15.7', '31.4', '78.5', '25.0'], correctIndex: 1, sectionId: 'sec-geo', solution: 'C = 2πr = 2 × 3.14 × 5 = 31.4.' },
      { id: 'm5', text: 'Simplify: (x² · x³) / x⁴', category: 'Algebra', choices: ['x', 'x²', 'x⁵', '1/x'], correctIndex: 0, sectionId: 'sec-alg', solution: 'x⁵ / x⁴ = x¹ = x.' },
      { id: 'm6', text: 'What is the volume of a cube with side length 3?', category: 'Geometry', choices: ['9', '18', '27', '36'], correctIndex: 2, sectionId: 'sec-geo', solution: 'V = s³ = 3³ = 27.' },
      { id: 'm7', text: 'Factor: x² − 9', category: 'Algebra', choices: ['(x−3)(x+3)', '(x−9)(x+1)', '(x−3)²', '(x+9)(x−1)'], correctIndex: 0, sectionId: 'sec-alg', solution: 'Difference of squares: x² − 9 = (x−3)(x+3).' },
      { id: 'm8', text: 'What is the sum of interior angles of a pentagon?', category: 'Geometry', choices: ['360°', '450°', '540°', '720°'], correctIndex: 2, sectionId: 'sec-geo', solution: '(n−2)×180 = (5−2)×180 = 540°.' },
    ],
    startDate: daysAgo(3),
    endDate: daysFromNow(30),
  },
  {
    id: 'mock-reading-comp',
    title: 'Reading Comprehension Assessment',
    description: 'Passage-based questions testing inference, vocabulary in context, main idea identification, and author\'s purpose.',
    timeLimitMinutes: 30,
    passingPercent: 70,
    showResultsToStudent: true,
    randomizeQuestions: false,
    allowPrevious: true,
    sections: [
      { id: 'sec-vocab', title: 'Vocabulary in Context', description: 'Determine word meanings from context clues' },
      { id: 'sec-inference', title: 'Inference & Analysis', description: 'Draw conclusions from passages' },
    ],
    questions: [
      { id: 'r1', text: 'The scientist\'s hypothesis was *ludicrous* — her colleagues dismissed it immediately. "Ludicrous" most nearly means:', category: 'Vocabulary', choices: ['Brilliant', 'Absurd', 'Innovative', 'Plausible'], correctIndex: 1, sectionId: 'sec-vocab', solution: 'Ludicrous means absurd or ridiculous.' },
      { id: 'r2', text: 'A passage describes a city where "the streets hummed with an energy that never slept." This suggests the city is:', category: 'Inference', choices: ['Dangerous', 'Vibrant and active', 'Quiet and peaceful', 'Abandoned'], correctIndex: 1, sectionId: 'sec-inference', solution: 'The metaphor of energy that never slept implies vibrancy.' },
      { id: 'r3', text: 'Which of the following best states the *main idea* of a passage about the decline of bee populations and its impact on agriculture?', category: 'Inference', choices: ['Bees are insects', 'Agriculture is important', 'Declining bee populations threaten food production', 'Honey tastes good'], correctIndex: 2, sectionId: 'sec-inference', solution: 'The passage links bee decline to agricultural impact.' },
      { id: 'r4', text: 'The word *benevolent* in "The benevolent teacher stayed late to help struggling students" most nearly means:', category: 'Vocabulary', choices: ['Strict', 'Kind and generous', 'Tired', 'Impatient'], correctIndex: 1, sectionId: 'sec-vocab', solution: 'Benevolent means well-meaning, kind, generous.' },
      { id: 'r5', text: 'An author writes a nostalgic essay about their childhood hometown. The primary purpose is to:', category: 'Analysis', choices: ['Inform readers about geography', 'Persuade readers to visit', 'Evoke emotion and share personal reflection', 'Compare cities statistically'], correctIndex: 2, sectionId: 'sec-inference', solution: 'Nostalgic essays aim to evoke emotion and reflect personally.' },
    ],
    startDate: daysAgo(5),
    endDate: daysFromNow(20),
  },
  {
    id: 'mock-science-basics',
    title: 'General Science — Biology & Chemistry',
    description: 'Fundamental concepts in cell biology, periodic table, chemical reactions, and human body systems.',
    timeLimitMinutes: 40,
    passingPercent: 60,
    showResultsToStudent: true,
    randomizeQuestions: true,
    allowPrevious: true,
    sections: [],
    questions: [
      { id: 's1', text: 'What organelle is known as the "powerhouse of the cell"?', category: 'Biology', choices: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], correctIndex: 2, solution: 'Mitochondria produce ATP (energy) for the cell.' },
      { id: 's2', text: 'What is the chemical symbol for gold?', category: 'Chemistry', choices: ['Go', 'Gd', 'Au', 'Ag'], correctIndex: 2, solution: 'Au (from Latin aurum).' },
      { id: 's3', text: 'Which blood type is the universal donor?', category: 'Biology', choices: ['A+', 'B+', 'AB+', 'O−'], correctIndex: 3, solution: 'O− has no A, B, or Rh antigens.' },
      { id: 's4', text: 'What is the pH of a neutral solution?', category: 'Chemistry', choices: ['0', '5', '7', '14'], correctIndex: 2, solution: 'pH 7 is neutral at 25°C.' },
      { id: 's5', text: 'Which molecule carries genetic information?', category: 'Biology', choices: ['ATP', 'DNA', 'Glucose', 'Hemoglobin'], correctIndex: 1, solution: 'DNA stores and transmits genetic information.' },
      { id: 's6', text: 'What type of bond involves the sharing of electron pairs?', category: 'Chemistry', choices: ['Ionic', 'Covalent', 'Metallic', 'Hydrogen'], correctIndex: 1, solution: 'Covalent bonds share electron pairs between atoms.' },
    ],
    startDate: daysAgo(10),
    endDate: daysFromNow(14),
  },
  {
    id: 'mock-history-world',
    title: 'World History — 20th Century',
    description: 'Major events from WWI through the Cold War, decolonization, and the rise of global institutions.',
    timeLimitMinutes: 50,
    passingPercent: 70,
    showResultsToStudent: true,
    randomizeQuestions: false,
    allowPrevious: true,
    sections: [
      { id: 'sec-ww', title: 'World Wars', description: 'WWI, WWII, and their aftermaths' },
      { id: 'sec-cold', title: 'Cold War Era', description: 'Superpower rivalry and proxy conflicts' },
    ],
    questions: [
      { id: 'h1', text: 'In what year did World War I begin?', category: 'History', choices: ['1912', '1914', '1916', '1918'], correctIndex: 1, sectionId: 'sec-ww', solution: 'WWI began in 1914 after the assassination of Archduke Franz Ferdinand.' },
      { id: 'h2', text: 'Which treaty formally ended World War I?', category: 'History', choices: ['Treaty of Versailles', 'Treaty of Paris', 'Treaty of Ghent', 'Treaty of Utrecht'], correctIndex: 0, sectionId: 'sec-ww', solution: 'The Treaty of Versailles (1919) ended WWI.' },
      { id: 'h3', text: 'The Berlin Wall fell in which year?', category: 'History', choices: ['1987', '1989', '1991', '1993'], correctIndex: 1, sectionId: 'sec-cold', solution: 'The Berlin Wall fell on November 9, 1989.' },
      { id: 'h4', text: 'What was the primary purpose of the United Nations, founded in 1945?', category: 'History', choices: ['Economic competition', 'Maintaining international peace and security', 'Cultural exchange only', 'Military alliance against USSR'], correctIndex: 1, sectionId: 'sec-cold', solution: 'The UN was founded to maintain international peace and security.' },
      { id: 'h5', text: 'The Cuban Missile Crisis occurred in which year?', category: 'History', choices: ['1959', '1962', '1965', '1968'], correctIndex: 1, sectionId: 'sec-cold', solution: 'The Cuban Missile Crisis was a 13-day confrontation in October 1962.' },
      { id: 'h6', text: 'Which leader initiated the policy of *glasnost* (openness) in the Soviet Union?', category: 'History', choices: ['Lenin', 'Stalin', 'Khrushchev', 'Gorbachev'], correctIndex: 3, sectionId: 'sec-cold', solution: 'Mikhail Gorbachev introduced glasnost and perestroika in the 1980s.' },
    ],
    startDate: daysAgo(2),
    endDate: daysFromNow(45),
  },
  {
    id: 'mock-upcoming-csat',
    title: 'Critical Thinking & Problem Solving (Upcoming)',
    description: 'Logical reasoning, pattern recognition, and analytical problem-solving. This exam opens next week.',
    timeLimitMinutes: 35,
    passingPercent: 75,
    showResultsToStudent: true,
    randomizeQuestions: true,
    allowPrevious: false,
    sections: [],
    questions: [
      { id: 'c1', text: 'If all Bloops are Razzies and all Razzies are Lazzies, then all Bloops are definitely…', category: 'Logic', choices: ['Razzies', 'Lazzies', 'Both Razzies and Lazzies', 'None of the above'], correctIndex: 1, solution: 'Transitive property: Bloops → Razzies → Lazzies, so Bloops → Lazzies.' },
      { id: 'c2', text: 'Find the next number: 2, 6, 14, 30, …', category: 'Patterns', choices: ['44', '56', '62', '66'], correctIndex: 2, solution: 'Differences: 4, 8, 16 → next diff is 32 → 30 + 32 = 62.' },
      { id: 'c3', text: 'A doctor gives you 3 pills and says take one every 30 minutes. How long until all pills are taken?', category: 'Reasoning', choices: ['30 minutes', '60 minutes', '90 minutes', '120 minutes'], correctIndex: 1, solution: 'First pill at 0 min, second at 30, third at 60 → total 60 minutes.' },
      { id: 'c4', text: 'Which word does NOT belong: Apple, Banana, Carrot, Mango?', category: 'Logic', choices: ['Apple', 'Banana', 'Carrot', 'Mango'], correctIndex: 2, solution: 'Carrot is a vegetable; the others are fruits.' },
    ],
    startDate: daysFromNow(7),
    endDate: daysFromNow(60),
  },
];

// ── student submissions ──────────────────────────────────────────────────────
function makeSubmission(uid, name, email, examId, examTitle, pct, daysBack, passed) {
  const ts = daysAgo(daysBack);
  return {
    examId,
    studentUid: uid,
    studentName: name,
    studentEmail: email,
    answers: [0, 1, 2, 0, 1, 2, 0, 1],
    score: Math.round(pct * 0.08),
    totalPoints: 8,
    percentage: pct,
    passed,
    autoSubmitted: false,
    startedAt: admin.firestore.Timestamp.fromDate(new Date(ts.toMillis() - 15 * 60000)),
    submittedAt: ts,
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function seed() {
  for (const pid of PROJECT_IDS) {
    const app = admin.initializeApp({ projectId: pid }, `mock-${pid}-${Date.now()}`);
    const db = app.firestore();
    const auth = app.auth();

    console.log(`\n── Seeding project: ${pid} ──`);

    // 1. Admin user
    let adminUid = 'mock-admin-uid';
    try {
      const rec = await auth.getUserByEmail('admin@test.com');
      adminUid = rec.uid;
      await auth.setCustomUserClaims(adminUid, { role: 'admin' });
      console.log('  ✓ Admin exists:', adminUid);
    } catch {
      const rec = await auth.createUser({ email: 'admin@test.com', password: 'password123', displayName: 'Test Admin', emailVerified: true });
      adminUid = rec.uid;
      await auth.setCustomUserClaims(adminUid, { role: 'admin' });
      console.log('  ✓ Admin created:', adminUid);
    }

    // 2. Student user
    let studentUid = 'mock-student-uid';
    try {
      const rec = await auth.getUserByEmail('student@test.com');
      studentUid = rec.uid;
      console.log('  ✓ Student exists:', studentUid);
    } catch {
      const rec = await auth.createUser({ email: 'student@test.com', password: 'password123', displayName: 'Mock Student', emailVerified: true });
      studentUid = rec.uid;
      console.log('  ✓ Student created:', studentUid);
    }

    // Student profile
    await db.collection('students').doc(studentUid).set({
      displayName: 'Mock Student',
      email: 'student@test.com',
      photoURL: null,
      createdAt: daysAgo(60),
      lastLoginAt: daysAgo(0),
      examCount: 6,
      avgScore: 78,
      notificationPreference: true,
    }, { merge: true });
    console.log('  ✓ Student profile written');

    // 3. Exams
    for (const exam of exams) {
      await db.collection('exams').doc(exam.id).set({
        ...exam,
        status: exam.status || 'published',
        createdBy: adminUid,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(1),
      });
      console.log(`  ✓ Exam: ${exam.title}`);
    }

    // 4. Submissions for the student
    const subs = [
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-math-101', 'Mathematics 101', 88, 20, true),
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-reading-comp', 'Reading Comprehension', 72, 15, true),
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-science-basics', 'General Science', 60, 12, false),
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-history-world', 'World History — 20th Century', 95, 7, true),
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-math-101', 'Mathematics 101', 81, 3, true),
      makeSubmission(studentUid, 'Mock Student', 'student@test.com', 'mock-science-basics', 'General Science', 55, 1, false),
    ];
    for (const s of subs) {
      const ref = await db.collection('submissions').add(s);
      console.log(`  ✓ Submission: ${s.studentEmail} → ${s.examId} (${s.percentage}%)`);
    }

    await app.delete();
    console.log(`── Done: ${pid} ──\n`);
  }

  console.log('✅ Mock data seeded successfully!');
  console.log('\n📋 Test credentials:');
  console.log('   Admin:   admin@test.com   / password123');
  console.log('   Student: student@test.com / password123');
  console.log('\n🌐 Visit http://localhost:8080/student.html to see the portal with data.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
