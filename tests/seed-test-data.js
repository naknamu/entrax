/**
 * Seed test data for Firebase emulators
 * Run with: node tests/seed-test-data.js
 */

const admin = require('firebase-admin');

// Initialize Admin SDK with emulator config
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'demo-test'
});

const auth = admin.auth();
const db = admin.firestore();

async function seedTestData() {
  console.log('Seeding test data...');
  
  try {
    // Create admin user
    console.log('Creating admin user...');
    const adminEmail = 'admin@test.com';
    const adminPassword = 'password123';
    
    try {
      await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'Test Admin',
        emailVerified: true
      });
      console.log('Admin user created:', adminEmail);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('Admin user already exists');
      } else {
        throw error;
      }
    }
    
    // Create sample exam
    console.log('Creating sample exam...');
    const examId = 'sample-exam-' + Date.now();
    const examData = {
      title: 'Sample Exam for Testing',
      description: 'This is a sample exam used for automated testing',
      timeLimitMinutes: 30,
      passingPercent: 70,
      showResultsToStudent: true,
      randomizeQuestions: false,
      allowPrevious: true,
      questions: [
        {
          id: 'q1',
          text: 'What is 2 + 2?',
          category: 'Math',
          choices: ['3', '4', '5', '6'],
          correctIndex: 1
        },
        {
          id: 'q2',
          text: 'What is the capital of France?',
          category: 'Geography',
          choices: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctIndex: 2
        },
        {
          id: 'q3',
          text: 'Which planet is known as the Red Planet?',
          category: 'Science',
          choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
          correctIndex: 1
        }
      ],
      createdBy: 'admin-uid',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('exams').doc(examId).set(examData);
    console.log('Sample exam created:', examId);
    
    console.log('Test data seeded successfully!');
    console.log('Exam ID:', examId);
    
  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();