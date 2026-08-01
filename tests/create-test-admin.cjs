/**
 * Creates a test admin user in the Firebase Auth emulator
 * Run with: node tests/create-test-admin.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator config
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'demo-test'
});

const auth = admin.auth();

async function createTestAdmin() {
  const email = 'admin@test.com';
  const password = 'password123';
  const displayName = 'Test Admin';

  try {
    // Try to get existing user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('Admin user already exists:', userRecord.uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        userRecord = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: true
        });
        console.log('Created admin user:', userRecord.uid);
      } else {
        throw error;
      }
    }

    // Set custom claims for admin (optional)
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    console.log('Set admin claims for user:', userRecord.uid);

    console.log('\n✅ Test admin ready:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UID:', userRecord.uid);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

createTestAdmin();