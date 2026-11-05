#!/usr/bin/env node
'use strict';

/**
 * Seed or edit the free-tier boundary (`config/freeTier`).
 *
 * The free tier is the promise on the landing page: one full-length diagnostic,
 * sample practice sets, and the score breakdown. Everything else needs a paid
 * plan. The boundary lives in one document so the exam page can check it with a
 * single small read:
 *
 *   config/freeTier { enabled: true, examIds: ['…'] }
 *
 * A missing document (or `enabled: false`, or an empty list) means "no gate":
 * the whole catalogue stays open. That is the safe default — this script is how
 * you turn the gate on.
 *
 * Usage:
 *   node scripts/mark-free-exams.cjs                  # preview the default picks
 *   node scripts/mark-free-exams.cjs --apply          # write them and enable the gate
 *   node scripts/mark-free-exams.cjs --add <examId> --apply
 *   node scripts/mark-free-exams.cjs --remove <examId> --apply
 *   node scripts/mark-free-exams.cjs --off --apply    # disable the gate
 *   node scripts/mark-free-exams.cjs --show           # print the current config
 *   node scripts/mark-free-exams.cjs --prod --apply   # production (ADC)
 *
 * Defaults to the local Firestore emulator (localhost:8081, project demo-test)
 * so a forgotten flag can never touch production.
 *
 * The default picks are derived from the exam titles the catalogue already
 * uses: the lowest-numbered "Mock Exam" plus the lowest-numbered
 * "<Section> Practice Set" for Reading, Math, Writing, and Science.
 */

const admin = require('firebase-admin');

const SECTIONS = ['Reading', 'Math', 'Writing', 'Science'];
const CONFIG_PATH = 'config/freeTier';

const USAGE = `Seed or edit the free-tier boundary.

Usage:
  node scripts/mark-free-exams.cjs [options]

Options:
  --apply            Write the change (without it the script only previews).
  --off              Disable the gate; the whole catalogue stays open.
  --add <examId>     Add one exam to the free list.
  --remove <examId>  Remove one exam from the free list.
  --show             Print the current config and exit.
  --prod             Use production (Application Default Credentials).
  --help, -h         Show this help.

Default target: emulator (localhost:8081, project demo-test).
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    help: args.includes('--help') || args.includes('-h'),
    apply: args.includes('--apply'),
    prod: args.includes('--prod'),
    off: args.includes('--off'),
    show: args.includes('--show'),
    add: valueOf('--add'),
    remove: valueOf('--remove'),
  };
}

function initDb(prod) {
  if (prod) {
    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    });
    return { db: app.firestore(), label: 'production (Application Default Credentials)' };
  }

  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
  const app = admin.initializeApp({ projectId: 'demo-test' });
  return { db: app.firestore(), label: 'emulator (localhost:8081, project demo-test)' };
}

function trailingNumber(title) {
  const match = /(\d+)\s*$/.exec(title || '');
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/** The first mock plus the first practice set for each section. */
async function defaultPicks(db) {
  const snap = await db.collection('exams').where('status', '==', 'published').get();
  const exams = snap.docs.map((doc) => ({ id: doc.id, title: doc.data().title || '' }));

  if (!exams.length) {
    throw new Error('No published exams found. Publish content before seeding the free tier.');
  }

  const picks = [];

  const mocks = exams
    .filter((exam) => /^mock exam\b/i.test(exam.title))
    .sort((a, b) => trailingNumber(a.title) - trailingNumber(b.title));
  if (mocks.length) picks.push(mocks[0]);

  for (const section of SECTIONS) {
    const pattern = new RegExp(`^${section}\\s+practice\\s+set\\b`, 'i');
    const sets = exams
      .filter((exam) => pattern.test(exam.title))
      .sort((a, b) => trailingNumber(a.title) - trailingNumber(b.title));
    if (sets.length) picks.push(sets[0]);
  }

  // Unexpected titles (renamed content): a small sample beats locking
  // everything behind a paywall by accident.
  if (!picks.length) picks.push(...exams.slice(0, 5));

  return picks.map((exam) => exam.id);
}

async function describeExams(db, examIds) {
  if (!examIds.length) return [];
  const docs = await db.getAll(...examIds.map((id) => db.collection('exams').doc(id)));
  return docs.map((doc) => ({
    id: doc.id,
    title: doc.exists ? doc.data().title || '(untitled)' : '(missing document)',
  }));
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const { db, label } = initDb(options.prod);
  const ref = db.doc(CONFIG_PATH);
  const snap = await ref.get();
  const current = snap.exists ? snap.data() : {};
  const currentIds = Array.isArray(current.examIds) ? current.examIds.filter(Boolean) : [];

  console.log(`Target:   ${label}`);
  console.log(`Document: ${CONFIG_PATH}`);
  console.log('');

  if (options.show) {
    console.log(`enabled: ${current.enabled === true}`);
    const exams = await describeExams(db, currentIds);
    if (!exams.length) console.log('examIds: (empty — gate is off)');
    for (const exam of exams) console.log(`  - ${exam.id}  ${exam.title}`);
    return 0;
  }

  if (options.off) {
    console.log('Action:   disable the free-tier gate (whole catalogue open)');
    if (options.apply) {
      await ref.set(
        { enabled: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      console.log('Written.');
    } else {
      console.log('Dry run — pass --apply to write.');
    }
    return 0;
  }

  let examIds;
  let source;

  if (options.add) {
    examIds = currentIds.includes(options.add) ? [...currentIds] : [...currentIds, options.add];
    source = `current list + ${options.add}`;
  } else if (options.remove) {
    examIds = currentIds.filter((id) => id !== options.remove);
    source = `current list − ${options.remove}`;
  } else if (currentIds.length) {
    examIds = [...currentIds];
    source = 'existing list';
  } else {
    examIds = await defaultPicks(db);
    source = 'derived from exam titles';
  }

  if (!examIds.length) {
    console.error('Refusing to enable the gate with an empty free list.');
    return 1;
  }

  console.log(`Action:   enable the gate (${source})`);
  const exams = await describeExams(db, examIds);
  for (const exam of exams) console.log(`  - ${exam.id}  ${exam.title}`);
  console.log('');

  if (!options.apply) {
    console.log('Dry run — pass --apply to write.');
    return 0;
  }

  await ref.set(
    {
      enabled: true,
      examIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`Written: ${examIds.length} free exam(s). Everything else needs a plan.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Failed to update the free-tier config:', error.message || error);
    process.exit(1);
  });
