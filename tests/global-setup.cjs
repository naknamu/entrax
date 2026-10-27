/**
 * Global setup for Playwright tests
 * This runs once before all tests when using firebase emulators:exec
 * The emulators are already started by firebase emulators:exec
 */

const admin = require('firebase-admin');

async function globalSetup() {
  console.log('🔧 Global setup: Starting...');
  console.log('🔧 FIRESTORE_EMULATOR_HOST:', process.env.FIRESTORE_EMULATOR_HOST);
  console.log('🔧 FIREBASE_AUTH_EMULATOR_HOST:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  
  // Initialize Admin SDK to use emulators
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  
  console.log('🔧 After setting env vars:');
  console.log('🔧 FIRESTORE_EMULATOR_HOST:', process.env.FIRESTORE_EMULATOR_HOST);
  console.log('🔧 FIREBASE_AUTH_EMULATOR_HOST:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  
  admin.initializeApp({
    projectId: 'demo-test'
  });
  
  const auth = admin.auth();
  const db = admin.firestore();

  // The server-grading spec flips `config/features.serverGrading` globally. If a
  // previous run crashed before its cleanup, every later client-graded attempt
  // would be rejected by the rules — always start from a clean switch.
  await db.doc('config/features').delete().catch(() => {});
  
  // Create (or find) the test admin user and grant the admin custom claim.
  // Look up by email so an account created earlier with a different uid still
  // gets the claim — rules and admin pages rely on `role: admin`, not the uid.
  console.log('👤 Ensuring test admin user + admin claim...');
  let adminUid = null;
  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail('admin@test.com');
      console.log('ℹ️ Admin user already exists:', userRecord.uid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      userRecord = await auth.createUser({
        uid: 'test-admin-uid',
        email: 'admin@test.com',
        password: 'password123',
        displayName: 'Test Admin',
        emailVerified: true
      });
      console.log('✅ Admin user created:', userRecord.uid);
    }
    adminUid = userRecord.uid;
    await auth.setCustomUserClaims(adminUid, { role: 'admin' });
    const verified = await auth.getUser(adminUid);
    console.log('✅ Admin claim set for', adminUid, JSON.stringify(verified.customClaims || {}));
  } catch (error) {
    console.error('❌ Failed to set up admin user:', error.message);
    throw error;
  }
  
  // Create sample exam with FIXED ID for testing
  console.log('📝 Creating sample exam...');
  try {
    const examId = 'sample-exam-test-fixed-id';
    const examData = {
      title: 'Sample Exam for Testing',
      description: 'This is a sample exam used for automated testing',
      status: 'published',
      createdBy: adminUid,
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
        },
        {
          id: 'q4',
          text: 'What is the largest mammal?',
          category: 'Biology',
          choices: ['Elephant', 'Blue Whale', 'Giraffe', 'Hippo'],
          correctIndex: 1
        },
        {
          id: 'q5',
          text: 'Who wrote "Romeo and Juliet"?',
          category: 'Literature',
          choices: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
          correctIndex: 1
        }
      ],
      startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 86400000)), // Started yesterday
      endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000)), // Ends tomorrow
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    console.log('📝 About to write exam to Firestore...');
    console.log('📝 Exam ID:', examId);
    
    // Add timeout to prevent hanging
    const writePromise = db.collection('exams').doc(examId).set(examData);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Firestore write timeout after 10 seconds')), 10000)
    );
    
    await Promise.race([writePromise, timeoutPromise]);
    
    console.log('✅ Sample exam created:', examId);
    
    // Store exam ID for tests to use
    process.env.TEST_EXAM_ID = examId;
    
  } catch (error) {
    console.error('❌ Failed to create sample exam:', error.message);
    console.error('❌ Full error:', error);
    throw error;
  }
  
  console.log('✅ Global setup complete');
}

module.exports = globalSetup;
