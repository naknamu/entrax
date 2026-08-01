/**
 * Grading Logic
 * Client-side grading for exam submissions
 */

/**
 * Grade an exam by comparing student answers to correct answers
 * @param {Array} questions - Array of question objects with id, correctIndex, choices
 * @param {Array} studentAnswers - Array of { questionId, selectedIndex }
 * @param {number} passingPercent - Passing percentage (default 70)
 * @returns {Object} Grading result with score, percentage, passed, etc.
 */
export function gradeExam(questions, studentAnswers, passingPercent = 70) {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return {
      score: 0,
      totalQuestions: 0,
      percentage: 0,
      passed: false,
      details: []
    };
  }

  const totalQuestions = questions.length;
  let score = 0;
  const details = [];

  // Create a map of student answers for quick lookup
  const answerMap = new Map();
  if (studentAnswers && Array.isArray(studentAnswers)) {
    studentAnswers.forEach(answer => {
      if (answer && typeof answer.questionId !== 'undefined' && typeof answer.selectedIndex !== 'undefined') {
        answerMap.set(answer.questionId, answer.selectedIndex);
      }
    });
  }

  // Grade each question
  questions.forEach((question, index) => {
    const studentAnswerIndex = answerMap.get(question.id);
    const correctIndex = question.correctIndex ?? 0;
    const isAnswered = studentAnswerIndex !== undefined && studentAnswerIndex >= 0;
    const isCorrect = isAnswered && studentAnswerIndex === correctIndex;

    if (isCorrect) {
      score++;
    }

    details.push({
      questionIndex: index,
      questionId: question.id,
      questionText: question.text,
      category: question.category || null,
      choices: question.choices || [],
      correctIndex,
      studentAnswerIndex: isAnswered ? studentAnswerIndex : null,
      isCorrect,
      isAnswered
    });
  });

  const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
  const passed = percentage >= passingPercent;

  return {
    score,
    totalQuestions,
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
    passed,
    passingPercent,
    details
  };
}

/**
 * Calculate score for a single question
 * @param {Object} question - Question object
 * @param {number} studentAnswerIndex - Student's selected index (-1 if unanswered)
 * @returns {Object} Question result
 */
export function gradeQuestion(question, studentAnswerIndex) {
  const correctIndex = question.correctIndex ?? 0;
  const isAnswered = studentAnswerIndex !== undefined && studentAnswerIndex >= 0;
  const isCorrect = isAnswered && studentAnswerIndex === correctIndex;

  return {
    questionId: question.id,
    questionText: question.text,
    category: question.category || null,
    choices: question.choices || [],
    correctIndex,
    studentAnswerIndex: isAnswered ? studentAnswerIndex : null,
    isCorrect,
    isAnswered
  };
}

/**
 * Get letter grade from percentage
 * @param {number} percentage 
 * @returns {string} Letter grade
 */
export function getLetterGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * Get performance level description
 * @param {number} percentage 
 * @returns {string} Performance level
 */
export function getPerformanceLevel(percentage) {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Good';
  if (percentage >= 70) return 'Satisfactory';
  if (percentage >= 60) return 'Needs Improvement';
  return 'Unsatisfactory';
}

/**
 * Calculate statistics for a set of submissions
 * @param {Array} submissions - Array of submission objects
 * @returns {Object} Statistics
 */
export function calculateStatistics(submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      count: 0,
      averageScore: 0,
      averagePercentage: 0,
      passRate: 0,
      highestScore: 0,
      lowestScore: 0,
      medianPercentage: 0
    };
  }

  const percentages = submissions.map(s => s.percentage || 0).sort((a, b) => a - b);
  const scores = submissions.map(s => s.score || 0).sort((a, b) => a - b);
  const passed = submissions.filter(s => s.passed).length;

  return {
    count: submissions.length,
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    averagePercentage: percentages.reduce((a, b) => a + b, 0) / percentages.length,
    passRate: (passed / submissions.length) * 100,
    highestScore: scores[scores.length - 1],
    lowestScore: scores[0],
    medianPercentage: percentages[Math.floor(percentages.length / 2)]
  };
}

/**
 * Generate CSV content from submissions
 * @param {Array} submissions - Array of submission objects
 * @param {Object} exam - Exam object
 * @returns {string} CSV content
 */
export function generateCSV(submissions, exam) {
  const headers = [
    'Student Name',
    'Email / ID',
    'Score',
    'Total Questions',
    'Percentage',
    'Passed',
    'Time Taken (minutes)',
    'Submitted At',
    'Auto-submitted',
    'Tab Switches'
  ];

  const rows = submissions.map(sub => {
    const timeTaken = sub.timeTakenMs 
      ? Math.round(sub.timeTakenMs / 60000) 
      : (sub.submittedAt && sub.startedAt 
        ? Math.round((new Date(sub.submittedAt).getTime() - new Date(sub.startedAt).getTime()) / 60000)
        : 0);
    
    return [
      `"${(sub.studentName || '').replace(/"/g, '""')}"`,
      `"${(sub.studentEmail || '').replace(/"/g, '""')}"`,
      sub.score || 0,
      exam.questions?.length || 0,
      (sub.percentage || 0).toFixed(1),
      sub.passed ? 'Yes' : 'No',
      timeTaken,
      sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A',
      sub.autoSubmitted ? 'Yes' : 'No',
      sub.tabSwitchCount || 0
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export results to CSV file download
 * @param {Array} submissions - Array of submission objects
 * @param {Object} exam - Exam object
 * @param {string} filename - Optional filename
 */
export function exportToCSV(submissions, exam, filename = 'exam-results.csv') {
  const csv = generateCSV(submissions, exam);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Format time taken in milliseconds to human readable
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time
 */
export function formatTimeTaken(ms) {
  if (!ms || ms < 0) return 'N/A';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Check if a submission is valid for grading
 * @param {Object} submission - Submission object
 * @param {Object} exam - Exam object
 * @returns {boolean}
 */
export function isValidForGrading(submission, exam) {
  return submission 
    && exam 
    && exam.questions 
    && Array.isArray(exam.questions)
    && exam.questions.length > 0
    && submission.answers
    && Array.isArray(submission.answers);
}

/**
 * Re-grade a submission (useful if correct answers changed)
 * @param {Object} submission - Submission object
 * @param {Object} exam - Exam object
 * @returns {Object} Updated grading result
 */
export function regradeSubmission(submission, exam) {
  if (!isValidForGrading(submission, exam)) {
    return null;
  }
  
  return gradeExam(exam.questions, submission.answers, exam.passingPercent || 70);
}

/**
 * Get question statistics across all submissions
 * @param {Array} submissions - Array of submission objects
 * @param {Array} questions - Array of question objects
 * @returns {Array} Question statistics
 */
export function getQuestionStatistics(submissions, questions) {
  return questions.map((question, index) => {
    const total = submissions.length;
    let correct = 0;
    let answered = 0;
    const answerDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, unanswered: 0 };

    submissions.forEach(sub => {
      const answer = sub.answers?.find(a => a.questionId === question.id);
      if (answer && answer.selectedIndex >= 0) {
        answered++;
        answerDistribution[answer.selectedIndex]++;
        if (answer.selectedIndex === question.correctIndex) {
          correct++;
        }
      } else {
        answerDistribution.unanswered++;
      }
    });

    return {
      questionIndex: index,
      questionId: question.id,
      questionText: question.text,
      category: question.category,
      correctIndex: question.correctIndex,
      totalAttempts: total,
      answeredCount: answered,
      unansweredCount: total - answered,
      correctCount: correct,
      correctPercentage: total > 0 ? (correct / total) * 100 : 0,
      answerDistribution
    };
  });
}

/**
 * Get category performance breakdown
 * @param {Array} submissions - Array of submission objects
 * @param {Array} questions - Array of question objects
 * @returns {Object} Category statistics
 */
export function getCategoryStatistics(submissions, questions) {
  const categories = new Map();
  
  questions.forEach(q => {
    if (q.category) {
      if (!categories.has(q.category)) {
        categories.set(q.category, { questions: [], total: 0, correct: 0 });
      }
      categories.get(q.category).questions.push(q.id);
    }
  });

  const result = {};
  categories.forEach((data, category) => {
    let total = 0;
    let correct = 0;
    
    submissions.forEach(sub => {
      data.questions.forEach(qId => {
        const answer = sub.answers?.find(a => a.questionId === qId);
        if (answer && answer.selectedIndex >= 0) {
          total++;
          const question = questions.find(q => q.id === qId);
          if (question && answer.selectedIndex === question.correctIndex) {
            correct++;
          }
        }
      });
    });
    
    result[category] = {
      totalQuestions: data.questions.length,
      totalAttempts: total,
      correctAnswers: correct,
      percentage: total > 0 ? (correct / total) * 100 : 0
    };
  });

  return result;
}