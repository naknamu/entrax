/**
 * Marketing landing page behaviour.
 *
 * Kept separate from the HTML so the page stays readable and so the analytics
 * calls are in one place. Everything here is progressive enhancement: the page
 * is fully readable with JavaScript disabled.
 */

import { initAnalytics, track } from '/js/analytics.js';

initAnalytics();

// ─── CTA tracking ───────────────────────────────────────────────────────────

document.querySelectorAll('[data-cta]').forEach((element) => {
  element.addEventListener('click', () => {
    track('cta_click', {
      cta: element.dataset.cta,
      location: element.dataset.location || 'landing',
    });
  });
});

// ─── Mobile navigation ──────────────────────────────────────────────────────

const navToggle = document.getElementById('mk-nav-toggle');
const navLinks = document.getElementById('mk-nav-links');

if (navToggle && navLinks) {
  const closeNav = () => {
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeNav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });
}

// ─── Sample question ────────────────────────────────────────────────────────

const sample = document.querySelector('[data-sample-question]');

if (sample) {
  const answerIndex = Number(sample.dataset.answer);
  const choices = Array.from(sample.querySelectorAll('.mk-choice'));
  const result = sample.querySelector('[data-sample-result]');

  choices.forEach((button, index) => {
    button.addEventListener('click', () => {
      const isCorrect = index === answerIndex;

      choices.forEach((choice, choiceIndex) => {
        choice.disabled = true;
        choice.classList.toggle('is-correct', choiceIndex === answerIndex);
        choice.classList.toggle('is-wrong', choiceIndex === index && !isCorrect);
      });

      result.hidden = false;
      result.classList.toggle('is-correct', isCorrect);
      result.classList.toggle('is-wrong', !isCorrect);
      result.innerHTML = isCorrect
        ? '<strong>Correct.</strong> 0.75 L = 750 mL, and 750 ÷ 6 = <strong>125 mL/hr</strong>.'
        : '<strong>Not quite.</strong> Convert litres to millilitres first: 0.75 L = 750 mL. Then divide by 6 hours: 750 ÷ 6 = <strong>125 mL/hr</strong>.';

      track('sample_question_answered', { correct: isCorrect, section: 'math' });
    });
  });
}

// ─── FAQ accordion (one answer open at a time) ──────────────────────────────

const faq = document.querySelector('.mk-faq');

if (faq) {
  const items = Array.from(faq.querySelectorAll('.mk-faq-item'));

  // Collapse the other answers on `click`, not on `toggle`.
  //
  // The `toggle` event is queued: by the time it fires, the browser has already
  // expanded the clicked answer and painted it, so the page grew and then
  // shrank again — a visible double jump/flicker. Closing the others in the
  // click handler happens before the default toggle, so it paints once.
  faq.addEventListener('click', (event) => {
    const summary = event.target.closest?.('summary');
    if (!summary || summary.parentElement?.parentElement !== faq) return;

    const item = summary.parentElement;
    if (item.open) return; // closing this answer: leave the rest alone

    items.forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
}

// ─── Pricing view (funnel step) ─────────────────────────────────────────────

const pricing = document.getElementById('pricing');

if (pricing && 'IntersectionObserver' in window) {
  let seen = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (seen) return;
      if (entries.some((entry) => entry.isIntersecting)) {
        seen = true;
        track('pricing_viewed');
        observer.disconnect();
      }
    },
    { threshold: 0.35 }
  );
  observer.observe(pricing);
}
