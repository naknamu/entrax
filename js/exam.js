/**
 * Exam Utility Functions
 * Shared utilities for student-facing exam page
 */

import { gradeExam } from './grading.js';

/**
 * Format date/time for display
 * @param {Date|Timestamp|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateTime(date) {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date only
 * @param {Date|Timestamp|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format duration in milliseconds to human readable
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return 'N/A';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format percentage
 * @param {number} value - Percentage value
 * @returns {string} Formatted percentage
 */
export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(1)}%`;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
 * Show alert message
 * @param {HTMLElement} container - Container element
 * @param {string} message - Message text
 * @param {string} type - Alert type (success, error, warning, info)
 */
export function showAlert(container, message, type = 'info') {
  if (!container) return;
  const icons = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  container.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      <span class="alert-icon">${icons[type] || icons.info}</span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  
  // Auto-dismiss success/info after 5 seconds
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }
}

/**
 * Show confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @returns {Promise<boolean>} True if confirmed
 */
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal">
        <header class="modal-header">
          <h3 class="modal-title">${escapeHtml(title)}</h3>
        </header>
        <div class="modal-body">
          <p>${escapeHtml(message)}</p>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-outline" data-action="cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-action="confirm">Confirm</button>
        </footer>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const cleanup = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeydown);
    };
    
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });
  });
}

/**
 * Save exam progress to localStorage
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email
 * @param {Object} data - Progress data
 */
export function saveProgressLocal(examId, studentEmail, data) {
  try {
    const key = `exam_${examId}_${studentEmail}_progress`;
    localStorage.setItem(key, JSON.stringify({
      ...data,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to save progress to localStorage:', e);
  }
}

/**
 * Load exam progress from localStorage
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email
 * @returns {Object|null} Progress data or null
 */
export function loadProgressLocal(examId, studentEmail) {
  try {
    const key = `exam_${examId}_${studentEmail}_progress`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Failed to load progress from localStorage:', e);
    return null;
  }
}

/**
 * Clear exam progress from localStorage
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email
 */
export function clearProgressLocal(examId, studentEmail) {
  try {
    const key = `exam_${examId}_${studentEmail}_progress`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear progress from localStorage:', e);
  }
}

/**
 * Check if exam is available (within date window)
 * @param {Object} exam - Exam object
 * @returns {Object} { available: boolean, message: string }
 */
export function checkExamAvailability(exam) {
  const now = new Date();
  const startDate = exam.startDate?.toDate ? exam.startDate.toDate() : (exam.startDate ? new Date(exam.startDate) : null);
  const endDate = exam.endDate?.toDate ? exam.endDate.toDate() : (exam.endDate ? new Date(exam.endDate) : null);
  
  if (startDate && startDate > now) {
    return { 
      available: false, 
      message: `This exam opens on ${formatDateTime(startDate)}.` 
    };
  }
  
  if (endDate && endDate < now) {
    return { 
      available: false, 
      message: `This exam closed on ${formatDateTime(endDate)}.` 
    };
  }
  
  return { available: true, message: '' };
}

/**
 * Calculate remaining time for exam
 * @param {number} startTime - Exam start timestamp
 * @param {number} timeLimitMs - Time limit in milliseconds
 * @returns {Object} { remaining: number, expired: boolean }
 */
export function calculateRemainingTime(startTime, timeLimitMs) {
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, timeLimitMs - elapsed);
  return {
    remaining,
    expired: remaining <= 0,
    elapsed
  };
}

/**
 * Format remaining time for display
 * @param {number} ms - Remaining milliseconds
 * @returns {string} Formatted time (MM:SS)
 */
export function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get progress percentage
 * @param {Array} answers - Array of answer objects
 * @param {number} totalQuestions - Total number of questions
 * @returns {number} Progress percentage (0-100)
 */
export function getProgressPercentage(answers, totalQuestions) {
  if (!answers || totalQuestions === 0) return 0;
  const answered = answers.filter(a => a?.selectedIndex >= 0).length;
  return Math.round((answered / totalQuestions) * 100);
}

/**
 * Shuffle array (Fisher-Yates)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (new array)
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Create randomized question order
 * @param {number} questionCount - Number of questions
 * @returns {Array} Array of indices in random order
 */
export function createRandomOrder(questionCount) {
  return shuffleArray(Array.from({ length: questionCount }, (_, i) => i));
}

/**
 * Validate exam data before saving
 * @param {Object} examData - Exam data to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateExamData(examData) {
  const errors = [];
  
  if (!examData.title?.trim()) {
    errors.push('Exam title is required');
  }
  
  if (!examData.timeLimitMinutes || examData.timeLimitMinutes < 1 || examData.timeLimitMinutes > 480) {
    errors.push('Time limit must be between 1 and 480 minutes');
  }
  
  if (examData.passingPercent === undefined || examData.passingPercent < 0 || examData.passingPercent > 100) {
    errors.push('Passing percentage must be between 0 and 100');
  }
  
  if (!examData.questions || examData.questions.length === 0) {
    errors.push('At least one question is required');
  } else {
    examData.questions.forEach((q, i) => {
      if (!q.text?.trim()) {
        errors.push(`Question ${i + 1}: Question text is required`);
      }
      if (!q.choices || q.choices.length !== 4) {
        errors.push(`Question ${i + 1}: Exactly 4 answer choices are required`);
      } else {
        q.choices.forEach((choice, ci) => {
          if (!choice?.trim()) {
            errors.push(`Question ${i + 1}, Choice ${String.fromCharCode(65 + ci)}: Choice text is required`);
          }
        });
      }
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex > 3) {
        errors.push(`Question ${i + 1}: Correct answer must be selected (A, B, C, or D)`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Download data as file
 * @param {string} data - Data to download
 * @param {string} filename - Filename
 * @param {string} type - MIME type
 */
export function downloadFile(data, filename, type = 'text/plain') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get exam link for sharing
 * @param {string} examId - Exam ID
 * @param {string} baseUrl - Base URL (optional, defaults to current origin)
 * @returns {string} Full exam URL
 */
export function getExamLink(examId, baseUrl = window.location.origin) {
  return `${baseUrl}/exam.html?examId=${examId}`;
}

/**
 * Generate student token (simple, not cryptographically secure)
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email
 * @returns {string} Token
 */
export function generateStudentToken(examId, studentEmail) {
  const str = `${examId}:${studentEmail}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 12);
}

/**
 * Verify student token
 * @param {string} token - Token to verify
 * @param {string} examId - Exam ID
 * @param {string} studentEmail - Student email
 * @returns {boolean} Valid or not
 */
export function verifyStudentToken(token, examId, studentEmail) {
  const expected = generateStudentToken(examId, studentEmail);
  return token === expected;
}

/**
 * Get color for score percentage
 * @param {number} percentage - Score percentage
 * @returns {string} CSS color class
 */
export function getScoreColorClass(percentage) {
  if (percentage >= 90) return 'text-success';
  if (percentage >= 70) return 'text-primary';
  if (percentage >= 60) return 'text-warning';
  return 'text-danger';
}

/**
 * Get badge class for status
 * @param {string} status - Status string
 * @returns {string} Badge class
 */
export function getStatusBadgeClass(status) {
  const classes = {
    passed: 'badge-success',
    failed: 'badge-danger',
    'auto-submitted': 'badge-warning',
    pending: 'badge-secondary',
    draft: 'badge-outline'
  };
  return classes[status] || 'badge-secondary';
}

/**
 * Sort submissions
 * @param {Array} submissions - Submissions array
 * @param {string} field - Field to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} Sorted submissions
 */
export function sortSubmissions(submissions, field, direction = 'desc') {
  return [...submissions].sort((a, b) => {
    let valA = a[field];
    let valB = b[field];
    
    // Handle dates
    if (valA?.toDate) valA = valA.toDate();
    if (valB?.toDate) valB = valB.toDate();
    if (valA instanceof Date) valA = valA.getTime();
    if (valB instanceof Date) valB = valB.getTime();
    
    // Handle strings
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Filter submissions
 * @param {Array} submissions - Submissions array
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered submissions
 */
export function filterSubmissions(submissions, filters) {
  return submissions.filter(sub => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const name = (sub.studentName || '').toLowerCase();
      const email = (sub.studentEmail || '').toLowerCase();
      if (!name.includes(search) && !email.includes(search)) return false;
    }
    
    if (filters.status === 'passed' && !sub.passed) return false;
    if (filters.status === 'failed' && sub.passed) return false;
    if (filters.status === 'auto' && !sub.autoSubmitted) return false;
    
    return true;
  });
}

/**
 * Calculate time taken for submission
 * @param {Object} submission - Submission object
 * @returns {number} Time in milliseconds
 */
export function getTimeTaken(submission) {
  if (!submission.startedAt || !submission.submittedAt) return 0;
  const start = submission.startedAt.toDate ? submission.startedAt.toDate() : new Date(submission.startedAt);
  const end = submission.submittedAt.toDate ? submission.submittedAt.toDate() : new Date(submission.submittedAt);
  return end.getTime() - start.getTime();
}

/**
 * Format time taken for display
 * @param {Object} submission - Submission object
 * @returns {string} Formatted time
 */
export function formatTimeTaken(submission) {
  return formatDuration(getTimeTaken(submission));
}

/**
 * Check if submission is auto-submitted
 * @param {Object} submission - Submission object
 * @returns {boolean}
 */
export function isAutoSubmitted(submission) {
  return submission.autoSubmitted === true;
}

/**
 * Get student display name
 * @param {Object} submission - Submission object
 * @returns {string} Display name
 */
export function getStudentDisplayName(submission) {
  return submission.studentName || submission.studentEmail || 'Unknown Student';
}

/**
 * Initialize exam page common functionality
 * @param {Object} options - Options
 */
export function initExamPage(options = {}) {
  // Prevent back navigation during exam
  if (options.preventBack) {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      history.pushState(null, '', location.href);
    });
  }
  
  // Prevent right-click context menu during exam
  if (options.preventContextMenu) {
    document.addEventListener('contextmenu', e => e.preventDefault());
  }
  
  // Prevent text selection during exam
  if (options.preventSelection) {
    document.addEventListener('selectstart', e => e.preventDefault());
  }
  
  // Warn before unload
  if (options.warnBeforeUnload) {
    window.addEventListener('beforeunload', (e) => {
      if (!options.isSubmitted) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
  }
}

/**
 * Cleanup exam page event listeners
 * @param {Object} options - Options
 */
export function cleanupExamPage(options = {}) {
  if (options.preventBack) {
    window.removeEventListener('popstate', () => {});
  }
  if (options.preventContextMenu) {
    document.removeEventListener('contextmenu', e => e.preventDefault());
  }
  if (options.preventSelection) {
    document.removeEventListener('selectstart', e => e.preventDefault());
  }
  if (options.warnBeforeUnload) {
    window.removeEventListener('beforeunload', () => {});
  }
}