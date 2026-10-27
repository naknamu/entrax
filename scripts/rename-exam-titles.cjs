#!/usr/bin/env node
/**
 * Remove "Kaplan" from exam titles so the student-facing list matches the
 * independent-content positioning (see ROADMAP.md → Positioning & legal).
 *
 * The question bank is programmatically generated, but the titles implied the
 * sets were Kaplan-authored ("Kaplan Math Questions - Set 5"). Descriptions are
 * left alone: they use "Kaplan Nursing Entrance Exam" descriptively, the same
 * way the landing page and disclaimer do. Titles are rewritten mechanically:
 *
 *   Kaplan Math Questions - Set 5      -> Math Practice Set 5
 *   Kaplan Reading Comprehension - Set 3 -> Reading Practice Set 3
 *   Kaplan Writing Skills - Set 8      -> Writing Practice Set 8
 *   Kaplan Science Questions - Set 7   -> Science Practice Set 7
 *   Kaplan Mock Exam 100               -> Mock Exam 100
 *   Kaplan Nursing Entrance Exam - X   -> Nursing Entrance Exam - X
 *   any other "Kaplan ..."             -> leading "Kaplan " stripped
 *   remaining mid-title "Kaplan"       -> "Nursing Entrance Exam"
 *
 * Only the `title` field is touched. Questions, sections, scores, keys, and
 * submission history are left alone. Safe to re-run: titles without "Kaplan"
 * are skipped.
 *
 * Usage:
 *   node scripts/rename-exam-titles.cjs              # dry run (default)
 *   node scripts/rename-exam-titles.cjs --apply      # write changes
 *   node scripts/rename-exam-titles.cjs --emulator   # local emulator
 *   node scripts/rename-exam-titles.cjs --prod       # production (ADC)
 *
 * Production requires Application Default Credentials and GOOGLE_CLOUD_PROJECT
 * (or a service account's project). Without --prod/--emulator the script runs
 * against the emulator.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const useProd = args.includes('--prod');
const apply = args.includes('--apply');

if (useProd && args.includes('--emulator')) {
  console.error('Choose one of --prod or --emulator, not both.');
  process.exit(1);
}

const SECTION_WORDS = ['Math', 'Reading', 'Writing', 'Science'];

/**
 * Propose a Kaplan-free title. Returns null when nothing needs changing.
 * @param {string} title
 * @returns {string|null}
 */
function proposeTitle(title) {
  if (typeof title !== 'string' || !/kaplan/i.test(title)) return null;

  const original = title.trim();

  // "Kaplan Math Questions - Set 5" / "Kaplan Reading Comprehension - Set 51"
  // / "Kaplan Writing Skills - Set 75" / "Kaplan Science Questions - Set 70"
  // -> "<Section> Practice Set <n>"
  const drill = original.match(
    /^kaplan\s+(math|reading|writing|science)\s+(?:questions|comprehension|skills)\s*[-–—:]\s*(set\s*\d+)$/i
  );
  if (drill) {
    const section = SECTION_WORDS.find(
      (word) => word.toLowerCase() === drill[1].toLowerCase()
    );
    const setNumber = drill[2].replace(/\D/g, '');
    return `${section} Practice Set ${setNumber}`;
  }

  // "Kaplan Mock Exam" / "Kaplan Mock Exam 100" -> "Mock Exam" / "Mock Exam 100"
  const mock = original.match(/^kaplan\s+(mock\s+exam(?:\s*\d+)?)$/i);
  if (mock) {
    return mock[1].replace(/\s+/g, ' ').replace(/^mock\s+exam/i, 'Mock Exam');
  }

  // Strip a leading "Kaplan " (also handles "Kaplan Nursing Entrance Exam …").
  let next = original.replace(/^kaplan\s+/i, '');

  // Anything left mid-title becomes the descriptive exam name.
  next = next.replace(/kaplan/gi, 'Nursing Entrance Exam');

  next = next.replace(/\s{2,}/g, ' ').trim();

  return next && next !== original ? next : null;
}

async function main() {
  let app;
  if (useProd) {
    app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    console.log('Production exams (Application Default Credentials)');
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
    app = admin.initializeApp({ projectId: 'demo-test' });
    console.log('Emulator exams (localhost:8081, project demo-test)');
  }

  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY RUN (pass --apply to write)');
  console.log('');

  const db = app.firestore();
  const snapshot = await db.collection('exams').get();

  let matched = 0;
  let updated = 0;
  const skipped = [];

  for (const doc of snapshot.docs) {
    const exam = doc.data() || {};
    const next = proposeTitle(exam.title);
    if (!next) continue;
    matched++;

    console.log(`  ${doc.id}`);
    console.log(`    - ${exam.title}`);
    console.log(`    + ${next}`);

    if (!apply) continue;

    try {
      await doc.ref.update({
        title: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updated++;
    } catch (error) {
      skipped.push(`${doc.id}: ${error.message || error}`);
    }
  }

  console.log('');
  console.log(`Exams scanned:        ${snapshot.size}`);
  console.log(`Titles containing Kaplan: ${matched}`);
  if (apply) {
    console.log(`Renamed:              ${updated}`);
    if (skipped.length) {
      console.log(`Failed:               ${skipped.length}`);
      skipped.forEach((line) => console.log(`  ✗ ${line}`));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Rename failed:', error.message || error);
    process.exit(1);
  });
