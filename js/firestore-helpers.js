/**
 * Firestore Helper Functions
 * Common database operations for the exam platform
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

/**
 * Create a new exam
 * @param {Firestore} db - Firestore instance
 * @param {Object} examData - Exam data
 * @param {string} examId - Optional custom ID
 * @returns {Promise<string>} Exam ID
 */
export async function createExam(db, examData, examId = null) {
  const id = examId || generateId();
  const examRef = doc(db, 'exams', id);
  
  const data = {
    ...examData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    questionCount: examData.questions?.length || 0
  };
  
  await setDoc(examRef, data);
  return id;
}

/**
 * Get exam by ID
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @returns {Promise<Object|null>} Exam data or null
 */
export async function getExam(db, examId) {
  const examRef = doc(db, 'exams', examId);
  const snap = await getDoc(examRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Update exam
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateExam(db, examId, updates) {
  const examRef = doc(db, 'exams', examId);
  await updateDoc(examRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    questionCount: updates.questions?.length || undefined
  });
}

/**
 * Delete exam and all its submissions
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @returns {Promise<void>}
 */
export async function deleteExam(db, examId) {
  const batch = writeBatch(db);
  
  // Delete exam
  batch.delete(doc(db, 'exams', examId));
  
  // Delete submissions
  const submissionsQuery = query(
    collection(db, 'submissions'),
    where('examId', '==', examId)
  );
  const submissionsSnap = await getDocs(submissionsQuery);
  submissionsSnap.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  
  await batch.commit();
}

/**
 * Get all exams for an admin
 * @param {Firestore} db - Firestore instance
 * @param {string} adminUid - Admin user ID
 * @returns {Promise<Array>} Array of exams
 */
export async function getExamsByAdmin(db, adminUid) {
  const examsQuery = query(
    collection(db, 'exams'),
    where('createdBy', '==', adminUid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(examsQuery);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all exams (admin only)
 * @param {Firestore} db - Firestore instance
 * @returns {Promise<Array>} Array of exams
 */
export async function getAllExams(db) {
  const examsQuery = query(
    collection(db, 'exams'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(examsQuery);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Create a submission
 * @param {Firestore} db - Firestore instance
 * @param {Object} submissionData - Submission data
 * @param {string} submissionId - Optional custom ID
 * @returns {Promise<string>} Submission ID
 */
export async function createSubmission(db, submissionData, submissionId = null) {
  const id = submissionId || generateId();
  const subRef = doc(db, 'submissions', id);
  
  await setDoc(subRef, {
    ...submissionData,
    createdAt: serverTimestamp()
  });
  
  return id;
}

/**
 * Update submission (for autosave)
 * @param {Firestore} db - Firestore instance
 * @param {string} submissionId - Submission ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateSubmission(db, submissionId, updates) {
  const subRef = doc(db, 'submissions', submissionId);
  await updateDoc(subRef, updates);
}

/**
 * Submit exam (finalize)
 * @param {Firestore} db - Firestore instance
 * @param {string} submissionId - Submission ID
 * @param {Object} finalData - Final submission data (answers, score, etc.)
 * @returns {Promise<void>}
 */
export async function submitExam(db, submissionId, finalData) {
  const subRef = doc(db, 'submissions', submissionId);
  await updateDoc(subRef, {
    ...finalData,
    submittedAt: serverTimestamp()
  });
}

/**
 * Get submission by ID
 * @param {Firestore} db - Firestore instance
 * @param {string} submissionId - Submission ID
 * @returns {Promise<Object|null>} Submission data or null
 */
export async function getSubmission(db, submissionId) {
  const subRef = doc(db, 'submissions', submissionId);
  const snap = await getDoc(subRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Get submissions for an exam
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of submissions
 */
export async function getSubmissionsForExam(db, examId, options = {}) {
  const { orderByField = 'submittedAt', orderDirection = 'desc', limitCount = null } = options;
  
  let q = query(
    collection(db, 'submissions'),
    where('examId', '==', examId),
    orderBy(orderByField, orderDirection)
  );
  
  if (limitCount) {
    q = query(q, limit(limitCount));
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Check if student already submitted
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email/ID
 * @returns {Promise<Object|null>} Existing submission or null
 */
export async function getExistingSubmission(db, examId, studentEmail) {
  const q = query(
    collection(db, 'submissions'),
    where('examId', '==', examId),
    where('studentEmail', '==', studentEmail),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Get submission count for an exam
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @returns {Promise<number>} Count
 */
export async function getSubmissionCount(db, examId) {
  const q = query(
    collection(db, 'submissions'),
    where('examId', '==', examId)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Batch update submissions (e.g., re-grade)
 * @param {Firestore} db - Firestore instance
 * @param {Array} updates - Array of { id, data }
 * @returns {Promise<void>}
 */
export async function batchUpdateSubmissions(db, updates) {
  const batch = writeBatch(db);
  updates.forEach(({ id, data }) => {
    batch.update(doc(db, 'submissions', id), data);
  });
  await batch.commit();
}

/**
 * Generate a simple unique ID
 * @param {number} length - ID length
 * @returns {string} Random ID
 */
export function generateId(length = 12) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Convert Firestore timestamp to Date
 * @param {Timestamp|Date|string|number} timestamp - Firestore timestamp
 * @returns {Date|null} Date object or null
 */
export function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
}

/**
 * Format Firestore timestamp for display
 * @param {Timestamp|Date|string|number} timestamp - Firestore timestamp
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp, options = {}) {
  const date = toDate(timestamp);
  if (!date || isNaN(date.getTime())) return 'N/A';
  
  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return date.toLocaleString('en-US', { ...defaultOptions, ...options });
}

/**
 * Get exam statistics
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @returns {Promise<Object>} Statistics
 */
export async function getExamStats(db, examId) {
  const submissions = await getSubmissionsForExam(db, examId);
  
  if (submissions.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      averagePercentage: 0,
      passRate: 0,
      highestScore: 0,
      lowestScore: 0
    };
  }
  
  const scores = submissions.map(s => s.score || 0);
  const percentages = submissions.map(s => s.percentage || 0);
  const passed = submissions.filter(s => s.passed).length;
  
  return {
    totalAttempts: submissions.length,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    averagePercentage: percentages.reduce((a, b) => a + b, 0) / percentages.length,
    passRate: (passed / submissions.length) * 100,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores)
  };
}

/**
 * Real-time listener for exam submissions
 * @param {Firestore} db - Firestore instance
 * @param {string} examId - Exam ID
 * @param {Function} callback - Callback function(submissions)
 * @returns {Function} Unsubscribe function
 */
export async function subscribeToSubmissions(db, examId, callback) {
  const q = query(
    collection(db, 'submissions'),
    where('examId', '==', examId),
    orderBy('submittedAt', 'desc')
  );
  
  const { onSnapshot } = await import('firebase/firestore');
  return onSnapshot(q, (snapshot) => {
    const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(submissions);
  });
}

/**
 * Real-time listener for a single submission
 * @param {Firestore} db - Firestore instance
 * @param {string} submissionId - Submission ID
 * @param {Function} callback - Callback function(submission)
 * @returns {Function} Unsubscribe function
 */
export async function subscribeToSubmission(db, submissionId, callback) {
  const subRef = doc(db, 'submissions', submissionId);
  const { onSnapshot } = await import('firebase/firestore');
  return onSnapshot(subRef, (doc) => {
    callback(doc.exists() ? { id: doc.id, ...doc.data() } : null);
  });
}