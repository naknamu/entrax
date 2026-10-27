#!/usr/bin/env node
'use strict';

/**
 * Move exam answer keys out of `exams/{examId}.questions[].correctIndex` and
 * into the admin-only `examKeys/{examId}` document.
 *
 * Modes (mutually exclusive):
 *   (default)   write examKeys only
 *   --strip     write examKeys, then rewrite each exam's questions array
 *               without correctIndex (arrays cannot be field-deleted)
 *   --restore   write correctIndex back into the exam questions from examKeys
 *
 * Flags:
 *   --prod      use production (Application Default Credentials)
 *   --emulator  explicit local emulator (the default)
 *   --dry-run   print what would change without writing
 *   --help      show this help
 *
 * The local Firestore emulator (localhost:8081, project demo-test) is the
 * default so a forgotten flag can never touch production.
 *
 * Usage:
 *   node scripts/migrate-exam-keys.cjs
 *   node scripts/migrate-exam-keys.cjs --strip
 *   node scripts/migrate-exam-keys.cjs --restore
 *   node scripts/migrate-exam-keys.cjs --strip --prod
 *   node scripts/migrate-exam-keys.cjs --strip --dry-run
 */

const admin = require('firebase-admin');

const USAGE = `Move exam answer keys into the admin-only examKeys collection.

Usage:
  node scripts/migrate-exam-keys.cjs [mode] [--prod|--emulator] [--dry-run]

Modes (choose at most one):
  (default)   Write examKeys/{examId} from each question's correctIndex.
  --strip     Write examKeys, then remove correctIndex from exam questions.
  --restore   Copy correctIndex from examKeys back into exam questions.

Options:
  --prod      Use production (Application Default Credentials).
  --emulator  Use the local Firestore emulator (default: localhost:8081,
              project demo-test).
  --dry-run   Report what would change without writing anything.
  --help, -h  Show this help.

Notes:
  - Existing examKeys values are merged with inline correctIndex values, so
    re-running the script never discards keys that were already migrated.
  - --strip only affects exams whose questions still carry correctIndex.
  - --strip while config/features.serverGrading is not true prints a loud
    warning: clients would lose the answer key and grade everything as wrong.
  - --restore is required before turning serverGrading off, because client
    grading reads correctIndex from the exam document.
`;

const KNOWN_FLAGS = new Set([
  '--help',
  '-h',
  '--prod',
  '--emulator',
  '--dry-run',
  '--strip',
  '--restore',
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    help: args.includes('--help') || args.includes('-h'),
    prod: args.includes('--prod'),
    emulator: args.includes('--emulator'),
    dryRun: args.includes('--dry-run'),
    strip: args.includes('--strip'),
    restore: args.includes('--restore'),
    unknown: args.filter((arg) => !KNOWN_FLAGS.has(arg)),
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validIndex(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3;
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

async function warnIfServerGradingOff(db) {
  const features = await db.doc('config/features').get();
  const enabled = features.exists && features.data().serverGrading === true;
  if (enabled) return;

  console.warn('');
  console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.warn('!! WARNING: --strip while serverGrading is OFF breaks grading.     !!');
  console.warn('!! config/features.serverGrading is not true. Client-side grading  !!');
  console.warn('!! reads question.correctIndex, which this run is about to remove. !!');
  console.warn('!! Turn serverGrading on first (set-feature-flag.cjs) or run with  !!');
  console.warn('!! --dry-run to inspect the change.                                !!');
  console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.warn('');
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  if (options.unknown.length > 0) {
    console.error(`Unknown option(s): ${options.unknown.join(', ')}`);
    console.error('');
    console.error(USAGE);
    return 1;
  }

  if (options.prod && options.emulator) {
    console.error('Choose one of --prod or --emulator, not both.');
    return 1;
  }

  if (options.strip && options.restore) {
    console.error('Choose one mode: --strip or --restore, not both.');
    return 1;
  }

  const mode = options.strip ? 'strip' : options.restore ? 'restore' : 'keys';
  const { db, label } = initDb(options.prod);

  console.log(`Target: ${label}`);
  console.log(`Mode:   ${mode}${options.dryRun ? ' (dry run, no writes)' : ''}`);

  if (options.strip) {
    await warnIfServerGradingOff(db);
  }

  const snapshot = await db.collection('exams').get();

  let examsScanned = 0;
  let skipped = 0;
  const plans = [];

  for (const doc of snapshot.docs) {
    const exam = doc.data() || {};
    const examQuestions = Array.isArray(exam.questions) ? exam.questions : [];

    if (examQuestions.length === 0) {
      skipped += 1;
      continue;
    }

    examsScanned += 1;

    const inlineAnswers = {};
    for (const question of examQuestions) {
      if (!question) continue;
      const id =
        typeof question.id === 'string'
          ? question.id
          : typeof question.id === 'number' && Number.isFinite(question.id)
            ? String(question.id)
            : null;
      if (!id) continue;
      if (!validIndex(question.correctIndex)) continue;
      inlineAnswers[id] = question.correctIndex;
    }

    // Merge stored keys so a partially migrated exam keeps its answers.
    const keySnap = await db.collection('examKeys').doc(doc.id).get();
    const storedAnswers =
      keySnap.exists && isPlainObject(keySnap.data().answers) ? keySnap.data().answers : {};

    const answers = { ...storedAnswers, ...inlineAnswers };
    if (Object.keys(answers).length === 0) {
      skipped += 1;
      continue;
    }

    plans.push({
      examId: doc.id,
      ref: doc.ref,
      questions: examQuestions,
      answers,
    });
  }

  let keysWritten = 0;
  for (const plan of plans) {
    if (!options.dryRun) {
      await db
        .collection('examKeys')
        .doc(plan.examId)
        .set(
          {
            answers: plan.answers,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: 'migration',
          },
          { merge: true }
        );
    }
    keysWritten += 1;
  }

  let questionsChanged = 0;
  let writeFailures = 0;
  let batch = db.batch();
  let pending = 0;

  const commitBatch = async () => {
    if (pending === 0) return;
    try {
      await batch.commit();
    } catch (error) {
      writeFailures += pending;
      console.error(`Batch write failed: ${error.message || error}`);
    }
    batch = db.batch();
    pending = 0;
  };

  if (mode === 'strip' || mode === 'restore') {
    for (const plan of plans) {
      let changed = 0;
      const nextQuestions = plan.questions.map((question) => {
        if (!question || typeof question !== 'object') return question;

        if (mode === 'strip') {
          if (!Object.prototype.hasOwnProperty.call(question, 'correctIndex')) return question;
          changed += 1;
          const copy = { ...question };
          delete copy.correctIndex;
          return copy;
        }

        // restore
        const key = plan.answers[question.id];
        if (!validIndex(key)) {
          skipped += 1;
          return question;
        }
        if (question.correctIndex === key) return question;
        changed += 1;
        return { ...question, correctIndex: key };
      });

      if (changed === 0) {
        skipped += 1;
        continue;
      }

      questionsChanged += changed;

      if (options.dryRun) continue;

      batch.update(plan.ref, { questions: nextQuestions });
      pending += 1;
      if (pending >= 400) await commitBatch();
    }

    await commitBatch();
  }

  console.log('');
  const row = (label, value) => console.log(`${label.padEnd(20)} ${value}`);
  row('Exams scanned:', examsScanned);
  row(options.dryRun ? 'Keys to write:' : 'Keys written:', keysWritten);
  if (mode === 'strip') {
    row('Questions stripped:', questionsChanged);
  } else if (mode === 'restore') {
    row('Questions restored:', questionsChanged);
  }
  row('Skipped:', skipped);

  if (writeFailures > 0) {
    console.error(`\n${writeFailures} exam write(s) failed.`);
    return 1;
  }

  if (options.dryRun) {
    console.log('\nDry run: no writes were performed.');
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Migration failed:', error.message || error);
    process.exit(1);
  });
