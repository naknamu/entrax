/**
 * Student Portal — Main Entry Point
 *
 * Handles:
 *  - Magic-link sign-in flow
 *  - Hash-based routing (#dashboard, #exams, #settings)
 *  - Dashboard stats, recent activity, score chart
 *  - Exam list with filters and search
 *  - Account settings
 */

import { db } from '@/firebase.js';
import {
  sendMagicLink,
  getEmulatorMagicLink,
  isMagicLink,
  completeMagicLinkSignIn,
  onStudentAuthStateChanged,
  studentSignOut,
  updateStudentDisplayName,
  getCurrentStudentProfile,
  getNextPath,
} from '@js/student-auth.js';
import {
  getStudentDashboardStats,
  getAvailableExams,
  getSubmissionsByStudent,
  getExam,
  formatTimestamp,
  toDate,
} from '@js/firestore-helpers.js';
import { initAnalytics, track } from '@js/analytics.js';

initAnalytics();

// ─── DOM refs ───────────────────────────────────────────────────────────────

const $signinView      = document.getElementById('signin-view');
const $portalView      = document.getElementById('portal-view');
const $signinForm      = document.getElementById('signin-form');
const $signinEmail     = document.getElementById('signin-email');
const $signinBtn       = document.getElementById('signin-btn');
const $signinSuccess   = document.getElementById('signin-success');
const $signinSentEmail = document.getElementById('signin-sent-email');
const $signinBackBtn   = document.getElementById('signin-back-btn');
const $signinError     = document.getElementById('signin-error');

const $sidebarUserName = document.getElementById('sidebar-user-name');
const $sidebarUserEmail= document.getElementById('sidebar-user-email');
const $sidebarAvatar   = document.getElementById('sidebar-avatar');
const $sidebarToggle   = document.getElementById('sidebar-toggle');
const $sidebar         = document.getElementById('student-sidebar');
const $logoutBtn       = document.getElementById('student-logout-btn');
const $navItems        = document.querySelectorAll('.student-nav-item, .student-mobile-nav-item');
const $views           = document.querySelectorAll('.student-view');

const $welcomeName     = document.getElementById('welcome-name');
const $welcomeQuote    = document.getElementById('welcome-quote');
const $statExamsTaken  = document.getElementById('stat-exams-taken');
const $statAvgScore    = document.getElementById('stat-avg-score');
const $statPassRate    = document.getElementById('stat-pass-rate');
const $statAvailable   = document.getElementById('stat-available');
const $statStreak      = document.getElementById('stat-streak');
const $statBest        = document.getElementById('stat-best');
const $scoreTrendChart = document.getElementById('score-trend-chart');
const $recentActivity  = document.getElementById('recent-activity-list');
const $focusAreasCard  = document.getElementById('focus-areas-card');
const $focusAreasList  = document.getElementById('focus-areas-list');
const $navExamBadge    = document.getElementById('nav-exam-badge');

const $examList        = document.getElementById('exam-list');
const $examListEmpty   = document.getElementById('exam-list-empty');
const $examEmptyTitle  = document.getElementById('exam-empty-title');
const $examEmptyText   = document.getElementById('exam-empty-text');
const $examSearch      = document.getElementById('exam-search');
const $filterTabs      = document.getElementById('exam-filter-tabs');
const $examPagBar      = document.getElementById('exam-pagination-bar');
const $examPagInfo     = document.getElementById('exam-pagination-info');
const $examPagNav      = document.getElementById('exam-pagination-nav');
const $examPageSize    = document.getElementById('exam-page-size');

const $settingsForm    = document.getElementById('settings-profile-form');
const $settingsName    = document.getElementById('settings-name');
const $settingsEmail   = document.getElementById('settings-email');
const $settingsMember  = document.getElementById('settings-member-since');
const $settingsTotalEx = document.getElementById('settings-total-exams');
const $settingsTotalTm = document.getElementById('settings-total-time');
const $settingsPassRt  = document.getElementById('settings-overall-pass');
const $settingsDelete  = document.getElementById('settings-delete-btn');

const $alertContainer  = document.getElementById('student-alert-container');
const $confirmModal    = document.getElementById('confirm-modal');
const $confirmBody     = document.getElementById('confirm-modal-body');
const $confirmOk       = document.getElementById('confirm-modal-ok');
const $confirmCancel   = document.getElementById('confirm-modal-cancel');
const $confirmClose    = document.getElementById('confirm-modal-close');

// ─── State ──────────────────────────────────────────────────────────────────

let currentUser = null;
let dashboardStats = null;
let allExams = [];
let studentSubmissions = [];
let currentFilter = 'all';
let examPage = 1;
let examPageSize = 10;
let confirmResolve = null;
let drillCategory = null;

const MOTIVATIONAL_QUOTES = [
  '"The secret of getting ahead is getting started." — Mark Twain',
  '"Success is the sum of small efforts, repeated day in and day out." — Robert Collier',
  '"Education is the most powerful weapon which you can use to change the world." — Nelson Mandela',
  '"The only way to do great work is to love what you do." — Steve Jobs',
  '"It does not matter how slowly you go as long as you do not stop." — Confucius',
  '"Believe you can and you\'re halfway there." — Theodore Roosevelt',
  '"The expert in anything was once a beginner." — Helen Hayes',
  '"Don\'t watch the clock; do what it does. Keep going." — Sam Levenson',
  '"Every accomplishment starts with the decision to try." — John F. Kennedy',
  '"You don\'t have to be great to start, but you have to start to be great." — Zig Ziglar',
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(timestamp) {
  const date = toDate(timestamp);
  if (!date || isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Split the axis label into date + year so narrow screens can stack them
// instead of clipping or overlapping (the year must never be dropped).
function formatChartDate(timestamp) {
  const date = toDate(timestamp);
  if (!date || isNaN(date.getTime())) return ['—', ''];
  const [datePart, yearPart = ''] = date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .split(', ');
  return [`${datePart},`, yearPart];
}

function formatRelativeTime(timestamp) {
  const date = toDate(timestamp);
  if (!date) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(timestamp);
}

function showAlert(message, type = 'danger') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `<span>${escapeHtml(message)}</span>`;
  $alertContainer.innerHTML = '';
  $alertContainer.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function showConfirm(message, title = 'Confirm') {
  return new Promise(resolve => {
    confirmResolve = resolve;
    $confirmBody.textContent = message;
    document.getElementById('confirm-modal-title').textContent = title;
    $confirmModal.hidden = false;
  });
}

// ─── Sign-in flow ───────────────────────────────────────────────────────────

async function handleMagicLinkOnLoad() {
  if (isMagicLink()) {
    try {
      showSigningInLoader();
      const user = await completeMagicLinkSignIn();
      if (user) {
        // Firebase sets creationTime == lastSignInTime (within a few seconds)
        // on the very first sign-in. Treat that as a completed signup; later
        // links are returning logins.
        const created = Date.parse(user.metadata?.creationTime || '');
        const last = Date.parse(user.metadata?.lastSignInTime || '');
        const isNewUser =
          Number.isFinite(created) && Number.isFinite(last) && Math.abs(last - created) < 60_000;
        track(isNewUser ? 'signup_completed' : 'login_completed', { method: 'magic_link' });
      }
      // Auth state change will handle the rest
    } catch (err) {
      console.error('Magic link sign-in failed:', err);
      showSigninView();
      showError('Sign-in failed: ' + (err.message || 'Unknown error'));
    }
  }
}

function showSigningInLoader() {
  hideAuthLoading();
  $signinForm.hidden = true;
  $signinSuccess.hidden = true;
  $signinError.hidden = true;
  $signinView.style.display = '';
  $signinView.hidden = false;
  $portalView.style.display = 'none';
  $portalView.hidden = true;
  // Show a simple loading message
  const loader = document.createElement('div');
  loader.id = 'signin-loader';
  loader.className = 'student-signin-loading';
  loader.innerHTML = '<div class="spinner"></div><p>Signing you in...</p>';
  $signinView.querySelector('.student-signin-card').appendChild(loader);
}

function hideAuthLoading() {
  const el = document.getElementById('auth-loading');
  if (el) el.remove();
}

function showSigninView() {
  hideAuthLoading();
  $signinView.style.display = '';
  $signinView.hidden = false;
  $portalView.style.display = 'none';
  $portalView.hidden = true;
  $signinForm.hidden = false;
  $signinSuccess.hidden = true;
  $signinError.hidden = true;
  const loader = document.getElementById('signin-loader');
  if (loader) loader.remove();
  $signinEmail.focus();
}

function showPortalView() {
  hideAuthLoading();
  $signinView.style.display = 'none';
  $signinView.hidden = true;
  $portalView.style.display = '';
  $portalView.hidden = false;
}

function showError(msg) {
  $signinError.textContent = msg;
  $signinError.hidden = false;
}

$signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $signinEmail.value.trim();
  if (!email) return;

  $signinBtn.disabled = true;
  $signinBtn.innerHTML = '<div class="spinner-sm"></div> Sending...';
  $signinError.hidden = true;

  try {
    await sendMagicLink(email);
    track('magic_link_requested', { method: 'magic_link' });
    $signinForm.hidden = true;
    $signinSuccess.hidden = false;
    $signinSentEmail.textContent = email;

    // In emulator mode, show the sign-in link directly (no email is sent)
    const $devLink = document.getElementById('signin-dev-link');
    const $devLinkAnchor = document.getElementById('signin-dev-link-anchor');
    if ($devLink && $devLinkAnchor) {
      $devLink.hidden = true;
      $devLinkAnchor.textContent = '';
      $devLinkAnchor.href = '#';
      try {
        const link = await getEmulatorMagicLink();
        if (link) {
          $devLinkAnchor.href = link;
          $devLinkAnchor.textContent = link;
          $devLink.hidden = false;
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error('Failed to send magic link:', err);
    const code = err.code || '';
    if (code === 'auth/unauthorized-continue-uri') {
      showError(
        'This domain is not authorized in Firebase. ' +
        'Add "' + window.location.hostname + '" to Firebase Console → Authentication → Settings → Authorized domains.'
      );
    } else {
      showError(err.message || 'Failed to send magic link. Please try again.');
    }
  } finally {
    $signinBtn.disabled = false;
    $signinBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Send Magic Link';
  }
});

$signinBackBtn.addEventListener('click', () => {
  $signinSuccess.hidden = true;
  $signinForm.hidden = false;
  $signinEmail.value = '';
  $signinEmail.focus();
});

// ─── Auth state ─────────────────────────────────────────────────────────────

onStudentAuthStateChanged(async (user) => {
  currentUser = user;
  if (user && !user.isAnonymous) {
    // A direct exam link sent the student here to sign in. Return them to it
    // instead of showing the portal dashboard.
    const next = getNextPath();
    if (next) {
      window.location.replace(next);
      return;
    }
    showPortalView();
    updateSidebarUser(user);
    navigateTo(getCurrentHash() || 'dashboard');
    loadDashboardData();
  } else if (isMagicLink()) {
    // Handled by handleMagicLinkOnLoad
  } else {
    showSigninView();
  }
});

function updateSidebarUser(user) {
  const name = user.displayName || user.email?.split('@')[0] || 'Student';
  $sidebarUserName.textContent = name;
  $sidebarUserEmail.textContent = user.email || '';
  $sidebarAvatar.textContent = name.charAt(0).toUpperCase();
}

$logoutBtn.addEventListener('click', async () => {
  await studentSignOut();
});

// ─── Navigation / Routing ───────────────────────────────────────────────────

function getCurrentHash() {
  const hash = window.location.hash.replace('#', '');
  return hash || 'dashboard';
}

function navigateTo(view) {
  // Update active nav items
  $navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Show the correct view
  $views.forEach(v => {
    v.hidden = v.dataset.view !== view;
  });

  // Update URL hash without triggering hashchange
  if (window.location.hash !== `#${view}`) {
    history.replaceState(null, '', `#${view}`);
  }

  // Load view data
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'exams':     renderExamList();  break;
    case 'settings':  renderSettings();  break;
  }
}

window.addEventListener('hashchange', () => {
  if (currentUser) navigateTo(getCurrentHash());
});

// Nav item click handlers
document.querySelectorAll('.student-nav-item, .student-mobile-nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.view);
  });
});

// Sidebar toggle (mobile)
$sidebarToggle.addEventListener('click', () => {
  $sidebar.classList.toggle('student-sidebar-open');
});

// Close sidebar on overlay click (mobile)
document.addEventListener('click', (e) => {
  if ($sidebar.classList.contains('student-sidebar-open') &&
      !$sidebar.contains(e.target) &&
      e.target !== $sidebarToggle) {
    $sidebar.classList.remove('student-sidebar-open');
  }
});

// ─── Dashboard ──────────────────────────────────────────────────────────────

async function loadDashboardData() {
  if (!currentUser) return;
  try {
    dashboardStats = await getStudentDashboardStats(db, currentUser.uid);
    studentSubmissions = dashboardStats.recentSubmissions;
    // Re-render dashboard now that data is available
    const currentView = document.querySelector('.student-view:not([hidden])');
    if (currentView?.dataset.view === 'dashboard') {
      renderDashboard();
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    dashboardStats = null;
  }
}

function renderDashboard() {
  if (!currentUser) return;

  // Greeting
  const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Student';
  $welcomeName.textContent = name;
  $welcomeQuote.textContent = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];

  if (!dashboardStats) {
    // Show loading or zeros
    $statExamsTaken.textContent = '—';
    $statAvgScore.textContent = '—';
    $statPassRate.textContent = '—';
    $statAvailable.textContent = '—';
    $statStreak.textContent = '—';
    $statBest.textContent = '—';
    return;
  }

  const s = dashboardStats;

  // Stat cards
  $statExamsTaken.textContent = s.examsTaken;
  $statAvgScore.textContent = `${s.avgScore}%`;
  $statPassRate.textContent = `${s.passRate}%`;
  $statAvailable.textContent = s.totalAvailable;
  $statStreak.textContent = s.streak;
  $statBest.textContent = `${s.bestScore}%`;

  // Available exam badge
  if (s.totalAvailable > 0) {
    $navExamBadge.textContent = s.totalAvailable;
    $navExamBadge.hidden = false;
  } else {
    $navExamBadge.hidden = true;
  }

  // Score trend chart
  const passingPercent = s.availableExams?.length > 0
    ? Math.min(...s.availableExams.map(e => e.passingPercent || 70))
    : 70;
  renderScoreChart(s.scoreTrend, passingPercent);

  // Recent activity
  renderRecentActivity(s.recentSubmissions, s.availableExams);

  // Focus areas (weak-area analysis)
  renderFocusAreas(s.weakAreas);
}

function renderScoreChart(trend, passingPercent = 70) {
  if (!trend || trend.length === 0) {
    $scoreTrendChart.innerHTML = '<div class="student-chart-empty">Take your first exam to see your progress here.</div>';
    return;
  }

  const isSingle = trend.length === 1;
  const threshold = Math.max(0, Math.min(100, Math.round(Number(passingPercent) || 70)));

  const barsHtml = trend.map(item => {
    const value = Math.max(0, Math.min(100, Number(item.percentage) || 0));
    // Clamp so a stray value can never push a bar outside the plot.
    const height = Math.max(4, value);
    const color = item.passed ? 'var(--color-success-500)' : 'var(--color-danger-500)';
    const [datePart, yearPart] = formatChartDate(item.submittedAt);
    return `
      <div class="student-chart-bar-col">
        <div class="student-chart-bar" style="height:${height}%;background:${color}">
          <span class="student-chart-bar-tooltip">${Math.round(value)}%</span>
        </div>
        <span class="student-chart-bar-label"><span class="student-chart-bar-date">${datePart}</span> <span class="student-chart-bar-year">${yearPart}</span></span>
      </div>`;
  }).join('');

  const summary = trend.map(item => `${Math.round(Number(item.percentage) || 0)}%`).join(', ');
  const innerClass = isSingle ? 'student-chart-inner student-chart-inner--single' : 'student-chart-inner';
  const barsClass = isSingle ? 'student-chart-bars student-chart-bars--single' : 'student-chart-bars';
  $scoreTrendChart.innerHTML = `
    <div class="${innerClass}">
      <div class="student-chart-legend"><span class="student-chart-legend-swatch" aria-hidden="true"></span>Passing ${threshold}%</div>
      <div class="${barsClass}">
        <div class="student-chart-y-axis" aria-hidden="true">
          <span style="bottom:100%">100%</span>
          <span style="bottom:75%">75%</span>
          <span style="bottom:50%">50%</span>
          <span style="bottom:25%">25%</span>
          <span style="bottom:0%">0%</span>
        </div>
        <div class="student-chart-scroll">
          <div class="student-chart-plot" role="img" aria-label="Score trend for your last ${trend.length} submission${isSingle ? '' : 's'}: ${summary}">
            <div class="student-chart-gridline" style="bottom:75%"></div>
            <div class="student-chart-gridline" style="bottom:50%"></div>
            <div class="student-chart-gridline" style="bottom:25%"></div>
            <div class="student-chart-pass-line" style="bottom:${threshold}%" title="Passing threshold: ${threshold}%"></div>
            ${barsHtml}
          </div>
        </div>
      </div>
    </div>`;
}

function renderRecentActivity(submissions, availableExams) {
  if (!submissions || submissions.length === 0) {
    $recentActivity.innerHTML = '<div class="student-activity-empty">No recent activity yet. Start an exam!</div>';
    return;
  }

  // Build a map of examId → exam title
  const examMap = {};
  if (availableExams) {
    availableExams.forEach(e => { examMap[e.id] = e; });
  }

  $recentActivity.innerHTML = submissions.map(sub => {
    const examTitle = examMap[sub.examId]?.title || 'Exam';
    const score = sub.percentage != null ? `${sub.percentage}%` : '—';
    const badgeClass = sub.passed ? 'badge-success' : 'badge-danger';
    const badgeText = sub.passed ? 'Passed' : 'Failed';
    const time = formatRelativeTime(sub.submittedAt);

    return `
      <div class="student-activity-item">
        <div class="student-activity-icon ${sub.passed ? 'success' : 'danger'}">
          ${sub.passed
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
        </div>
        <div class="student-activity-info">
          <span class="student-activity-exam">${escapeHtml(examTitle)}</span>
          <span class="student-activity-meta">Score: ${score} · ${time}</span>
        </div>
        <span class="badge ${badgeClass}">${badgeText}</span>
        <a href="exam.html?examId=${sub.examId}&review=true" class="btn btn-ghost btn-sm" title="View results">Review</a>
      </div>`;
  }).join('');
}

function renderFocusAreas(weakAreas) {
  if (!$focusAreasCard || !$focusAreasList) return;

  if (!weakAreas || weakAreas.length === 0) {
    $focusAreasCard.hidden = true;
    return;
  }

  $focusAreasCard.hidden = false;
  const toShow = weakAreas.slice(0, 5);

  $focusAreasList.innerHTML = toShow.map(area => {
    const pct = area.percentage;
    const barColor = pct < 60
      ? 'var(--color-danger)'
      : pct < 80
        ? 'var(--color-warning)'
        : 'var(--color-success)';
    const icon = pct < 60
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : pct < 80
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

    return `
      <div class="student-focus-item">
        <div class="student-focus-icon" style="color: ${barColor};">${icon}</div>
        <div class="student-focus-info">
          <div class="student-focus-row">
            <span class="student-focus-name">${escapeHtml(area.category)}</span>
            <span class="student-focus-pct" style="color: ${barColor};">${pct}%</span>
          </div>
          <div class="student-focus-bar-track">
            <div class="student-focus-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
          </div>
          <span class="student-focus-detail">${area.correct}/${area.total} correct</span>
        </div>
        <button class="btn btn-sm student-drill-btn" data-category="${escapeHtml(area.category)}" type="button" aria-label="Drill ${escapeHtml(area.category)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>Drill</button>
      </div>
    `;
  }).join('');

  // Drill button handlers
  $focusAreasList.querySelectorAll('.student-drill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      startDrill(category);
    });
  });
}

function startDrill(category) {
  drillCategory = category;
  currentFilter = 'available';
  examPage = 1;

  // Update filter tabs
  $filterTabs.querySelectorAll('.student-filter-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === 'available')
  );

  // Show drill badge
  const $badge = document.getElementById('drill-badge');
  const $name = document.getElementById('drill-category-name');
  if ($badge && $name) {
    $name.textContent = category;
    $badge.hidden = false;
  }

  navigateTo('exams');
}

// ─── Exam List ──────────────────────────────────────────────────────────────

async function renderExamList() {
  if (!currentUser) return;

  try {
    // Load exams and submissions in parallel
    const [exams, submissions] = await Promise.all([
      getAvailableExams(db),
      getSubmissionsByStudent(db, currentUser.uid),
    ]);

    allExams = exams;
    studentSubmissions = submissions;

    // Build submission map: examId → best submission
    const submissionMap = {};
    submissions.forEach(sub => {
      const existing = submissionMap[sub.examId];
      if (!existing || (sub.percentage || 0) > (existing.percentage || 0)) {
        submissionMap[sub.examId] = sub;
      }
    });

    applyExamFilter(submissionMap);
  } catch (err) {
    console.error('Failed to load exams:', err);
    $examList.innerHTML = '';
    $examListEmpty.hidden = false;
    $examEmptyTitle.textContent = 'Failed to load exams';
    $examEmptyText.textContent = 'Please try again later.';
  }
}

function applyExamFilter(submissionMap) {
  if (!submissionMap) {
    // Rebuild from current data
    submissionMap = {};
    studentSubmissions.forEach(sub => {
      const existing = submissionMap[sub.examId];
      if (!existing || (sub.percentage || 0) > (existing.percentage || 0)) {
        submissionMap[sub.examId] = sub;
      }
    });
  }

  const search = ($examSearch.value || '').trim().toLowerCase();

  let filtered = allExams.filter(exam => {
    // Search filter
    if (search && !exam.title?.toLowerCase().includes(search)) return false;

    // Category drill filter (case-insensitive, trimmed)
    if (drillCategory) {
      const normalized = drillCategory.trim().toLowerCase();
      const hasCategory = (exam.questions || []).some(q => q.category && q.category.trim().toLowerCase() === normalized);
      if (!hasCategory) return false;
    }

    const sub = submissionMap[exam.id];
    switch (currentFilter) {
      case 'available': return !sub;
      case 'completed': return !!sub;
      case 'passed':    return sub?.passed;
      default:          return true;
    }
  });

  // Paginate
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / examPageSize));
  if (examPage > pages) examPage = pages;
  const start = (examPage - 1) * examPageSize;
  const pageExams = filtered.slice(start, start + examPageSize);

  renderExamCards(pageExams, submissionMap, total, pages, start);
}

function renderExamCards(exams, submissionMap, total, pages, start) {
  if (total === 0) {
    $examList.innerHTML = '';
    $examListEmpty.hidden = false;
    $examPagBar.hidden = true;
    switch (currentFilter) {
      case 'available':
        $examEmptyTitle.textContent = 'No available exams';
        $examEmptyText.textContent = 'You\'ve attempted all available exams. Great job!';
        break;
      case 'completed':
        $examEmptyTitle.textContent = 'No completed exams';
        $examEmptyText.textContent = 'Start taking exams to see your results here.';
        break;
      case 'passed':
        $examEmptyTitle.textContent = 'No passed exams yet';
        $examEmptyText.textContent = 'Keep trying — you\'ll get there!';
        break;
      default:
        $examEmptyTitle.textContent = 'No exams found';
        $examEmptyText.textContent = search ? 'Try a different search term.' : 'Check back later for new exams.';
    }
    return;
  }

  $examListEmpty.hidden = true;
  $examList.innerHTML = exams.map(exam => {
    const sub = submissionMap[exam.id];
    const qCount = exam.questions?.length || exam.questionCount || 0;
    const timeLimit = exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : 'No limit';
    const passing = exam.passingPercent != null ? `${exam.passingPercent}%` : '—';

    let statusBadge, actionBtn, statusClass;

    if (sub) {
      if (sub.passed) {
        statusBadge = '<span class="badge badge-success">Passed</span>';
        statusClass = 'passed';
      } else {
        statusBadge = '<span class="badge badge-danger">Failed</span>';
        statusClass = 'failed';
      }
      actionBtn = `
        <a href="exam.html?examId=${exam.id}&retake=true" class="btn btn-outline btn-sm student-retake-btn">Retake</a>
        <a href="exam.html?examId=${exam.id}&review=true" class="btn btn-primary btn-sm">View Results</a>`;
    } else {
      statusBadge = '<span class="badge badge-primary student-new-badge">New</span>';
      statusClass = 'new';
      actionBtn = `<a href="exam.html?examId=${exam.id}" class="btn btn-primary btn-sm">Start Exam</a>`;
    }

    // Availability dates
    let availInfo = '';
    if (exam.endDate) {
      const end = toDate(exam.endDate);
      if (end) {
        const now = new Date();
        const daysLeft = Math.ceil((end - now) / 86400000);
        availInfo = daysLeft > 0
          ? `<span class="student-exam-deadline">⏱ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left</span>`
          : '<span class="student-exam-deadline expired">Expired</span>';
      }
    }

    // Description
    const desc = exam.description
      ? (exam.description.length > 120 ? exam.description.slice(0, 120) + '…' : exam.description)
      : '';

    // Score display for completed exams
    const scoreDisplay = sub && sub.percentage != null
      ? `<div class="student-exam-score"><span class="student-exam-score-value">${sub.percentage}%</span><span class="student-exam-score-label">Score</span></div>`
      : '';

    return `
      <article class="card student-exam-card ${statusClass}" data-exam-id="${exam.id}">
        <div class="student-exam-card-header">
          <div class="student-exam-card-info">
            <h3 class="student-exam-card-title">${escapeHtml(exam.title || 'Untitled Exam')}</h3>
            ${desc ? `<p class="student-exam-card-desc">${escapeHtml(desc)}</p>` : ''}
          </div>
          ${scoreDisplay}
        </div>
        <div class="student-exam-card-meta">
          <span class="student-exam-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${qCount} question${qCount !== 1 ? 's' : ''}
          </span>
          <span class="student-exam-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeLimit}
          </span>
          <span class="student-exam-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
            Pass: ${passing}
          </span>
          ${availInfo}
        </div>
        <div class="student-exam-card-footer">
          ${statusBadge}
          <div class="student-exam-card-actions">${actionBtn}</div>
        </div>
      </article>`;
  }).join('');

  // Pagination controls
  $examPagBar.hidden = pages <= 1;
  const from = start + 1;
  const to = Math.min(start + examPageSize, total);
  $examPagInfo.textContent = `Showing ${from}\u2013${to} of ${total}`;
  renderExamPagination(pages);
}

function renderExamPagination(pages) {
  if (pages <= 1) { $examPagNav.innerHTML = ''; return; }

  let html = `<button class="page-btn" data-page="prev" ${examPage === 1 ? 'disabled' : ''}>\u2039</button>`;

  // Sliding window of up to 7 page buttons
  let pStart = Math.max(1, examPage - 3);
  let pEnd = Math.min(pages, pStart + 6);
  if (pEnd - pStart < 6) pStart = Math.max(1, pEnd - 6);

  if (pStart > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (pStart > 2) html += `<span class="pagination-ellipsis">\u2026</span>`;
  }
  for (let p = pStart; p <= pEnd; p++) {
    html += `<button class="page-btn${p === examPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
  }
  if (pEnd < pages) {
    if (pEnd < pages - 1) html += `<span class="pagination-ellipsis">\u2026</span>`;
    html += `<button class="page-btn" data-page="${pages}">${pages}</button>`;
  }

  html += `<button class="page-btn" data-page="next" ${examPage === pages ? 'disabled' : ''}>\u203a</button>`;
  $examPagNav.innerHTML = html;
}

// Filter tab clicks
$filterTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.student-filter-tab');
  if (!tab) return;
  currentFilter = tab.dataset.filter;
  examPage = 1;
  $filterTabs.querySelectorAll('.student-filter-tab').forEach(t =>
    t.classList.toggle('active', t === tab)
  );
  applyExamFilter();
});

// Drill clear button
document.getElementById('drill-clear')?.addEventListener('click', () => {
  drillCategory = null;
  document.getElementById('drill-badge').hidden = true;
  document.getElementById('drill-category-name').textContent = '';
  applyExamFilter();
});

// Search input
$examSearch.addEventListener('input', () => {
  examPage = 1;
  applyExamFilter();
});

// Pagination clicks
$examPagNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.page-btn');
  if (!btn || btn.disabled) return;
  const page = btn.dataset.page;
  if (page === 'prev') examPage--;
  else if (page === 'next') examPage++;
  else examPage = parseInt(page, 10);
  applyExamFilter();
  $examList.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Page size change
$examPageSize.addEventListener('change', () => {
  examPageSize = parseInt($examPageSize.value, 10);
  examPage = 1;
  applyExamFilter();
});

// Clickable exam cards
$examList.addEventListener('click', (e) => {
  const card = e.target.closest('.student-exam-card');
  if (!card) return;
  if (e.target.closest('a, button')) return;
  const examId = card.dataset.examId;
  if (examId) {
    window.location.href = `exam.html?examId=${examId}`;
  }
});

// ─── Settings ───────────────────────────────────────────────────────────────

async function renderSettings() {
  if (!currentUser) return;

  // Profile
  $settingsName.value = currentUser.displayName || '';
  $settingsEmail.value = currentUser.email || '';

  const profile = await getCurrentStudentProfile();
  if (profile?.createdAt) {
    $settingsMember.value = formatDate(profile.createdAt);
  } else {
    $settingsMember.value = formatDate(currentUser.metadata?.creationTime);
  }

  // History stats
  if (dashboardStats) {
    $settingsTotalEx.textContent = dashboardStats.examsTaken;
    $settingsTotalTm.textContent = formatDuration(dashboardStats.totalTimeMs);
    $settingsPassRt.textContent = `${dashboardStats.passRate}%`;
  }
}

$settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $settingsName.value.trim();
  if (!name) {
    showAlert('Display name cannot be empty.', 'warning');
    return;
  }

  try {
    await updateStudentDisplayName(name);
    updateSidebarUser({ ...currentUser, displayName: name });
    currentUser.displayName = name;
    showAlert('Profile updated successfully!', 'success');
  } catch (err) {
    console.error('Failed to update profile:', err);
    showAlert('Failed to update profile: ' + (err.message || 'Unknown error'));
  }
});

$settingsDelete.addEventListener('click', async () => {
  const confirmed = await showConfirm(
    'Are you sure you want to delete your account? This action cannot be undone. Your exam submissions will remain anonymized.',
    'Delete Account'
  );
  if (!confirmed) return;

  try {
    const { deleteStudentProfile } = await import('@js/firestore-helpers.js');
    await deleteStudentProfile(db, currentUser.uid);
    await studentSignOut();
    showAlert('Account deleted.', 'success');
  } catch (err) {
    console.error('Failed to delete account:', err);
    showAlert('Failed to delete account: ' + (err.message || 'Unknown error'));
  }
});

// ─── Confirm modal ──────────────────────────────────────────────────────────

function closeConfirmModal(result) {
  $confirmModal.hidden = true;
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

$confirmOk.addEventListener('click', () => closeConfirmModal(true));
$confirmCancel.addEventListener('click', () => closeConfirmModal(false));
$confirmClose.addEventListener('click', () => closeConfirmModal(false));
$confirmModal.addEventListener('click', (e) => {
  if (e.target === $confirmModal) closeConfirmModal(false);
});

// ─── Init ───────────────────────────────────────────────────────────────────

(async function init() {
  // Check for magic link in URL first
  await handleMagicLinkOnLoad();
})();