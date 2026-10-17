#!/usr/bin/env node
/**
 * batch-create-exams.cjs — Generate and upload 100 Kaplan nursing entrance exams to production Firestore.
 *
 * Uses the OAuth access token from Firebase CLI config (firebase-tools.json).
 * Generates questions procedurally with templates for Math, and curated banks
 * for Reading (passages + questions), Writing, and Science.
 *
 * Usage: node scripts/batch-create-exams.cjs [--dry-run] [--start N] [--count N]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = 'entrax-878a1';
const COLLECTION = 'exams';
const ADMIN_UID = 'W0uB5Wa8F30CdPufmIB5tAZdHobN'; // from existing admin user

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const START_SET = parseInt(args.find((_, i, a) => a[i - 1] === '--start') || '5', 10);
const EXAM_COUNT = parseInt(args.find((_, i, a) => a[i - 1] === '--count') || '100', 10);

// ─── OAuth token from Firebase CLI ───────────────────────────────────────────
function getAccessToken() {
  const cfgPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config', 'configstore', 'firebase-tools.json'
  );
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return cfg.tokens.access_token;
}

// ─── Firestore REST API helper ───────────────────────────────────────────────
function toFirestoreFields(obj) {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj === 'number') {
    return Number.isInteger(obj)
      ? { integerValue: String(obj) }
      : { doubleValue: obj };
  }
  if (typeof obj === 'string') return { stringValue: obj };
  if (obj instanceof Date) return { timestampValue: obj.toISOString() };
  if (Array.isArray(obj)) {
    return { arrayValue: { values: obj.map(toFirestoreFields) } };
  }
  if (typeof obj === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) fields[k] = toFirestoreFields(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}

function createDocument(docId, data, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields: toFirestoreFields(data).mapValue.fields });
    const url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?documentId=${docId}`;
    const options = {
      hostname: 'firestore.googleapis.com',
      method: 'POST',
      path: url,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── ID generator (matches app's generateId format) ──────────────────────────
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function uid() {
  return generateId();
}

// ─── Section definitions ─────────────────────────────────────────────────────
const SECTIONS = {
  reading: { id: 'sec-reading', title: 'READING', description: 'Determining the logic of a passage, Comprehending details, Drawing basic inferences, Identifying the purpose of a passage' },
  math: { id: 'sec-math', title: 'MATH', description: 'Conversions, Operations, Ratios, Word problems' },
  writing: { id: 'sec-writing', title: 'WRITING', description: 'Assessing passage development, Assessing paragraph logic, Assessing mechanics of writing' },
  science: { id: 'sec-science', title: 'SCIENCE', description: 'Cardiovascular system, Electrolytes, GI, Immune, Neurology, Renal, Hematology, Homeostasis, Respiratory, Sensory' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATH QUESTION GENERATORS (template-based with random values)
// ═══════════════════════════════════════════════════════════════════════════════

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function genMathBasicArithmetic(count) {
  const qs = [];
  const ops = [
    { op: '+', fn: (a, b) => a + b, name: 'sum' },
    { op: '−', fn: (a, b) => a - b, name: 'difference' },
    { op: '×', fn: (a, b) => a * b, name: 'product' },
    { op: '÷', fn: (a, b) => a * b / b, name: 'quotient', setup: () => { const b = rand(2, 12); const a = b * rand(2, 15); return [a, b]; } },
  ];
  for (let i = 0; i < count; i++) {
    const { op, fn, name } = pick(ops);
    let a, b;
    if (op === '÷') {
      const setup = ops.find(o => o.setup).setup();
      a = setup[0]; b = setup[1];
    } else {
      a = rand(10, 200); b = rand(10, 200);
      if (op === '×') { a = rand(2, 25); b = rand(2, 25); }
    }
    const answer = op === '÷' ? a / b : fn(a, b);
    const wrong = [answer + rand(1, 5), answer - rand(1, 5), answer + rand(6, 10)].filter(w => w !== answer && w > 0);
    const choices = shuffle([answer, ...wrong.slice(0, 3)]);
    qs.push({
      text: `What is the ${name} of ${a} ${op} ${b}?`,
      category: 'Basic Arithmetic',
      choices: choices.map(String),
      correctIndex: choices.indexOf(answer),
      solution: `${a} ${op} ${b} = ${answer}`,
      sectionId: SECTIONS.math.id,
    });
  }
  return qs;
}

function genMathFractions(count) {
  const qs = [];
  const ops = ['+', '−', '×'];
  for (let i = 0; i < count; i++) {
    const op = pick(ops);
    const d1 = pick([2, 3, 4, 5, 6, 8, 10]);
    const d2 = pick([2, 3, 4, 5, 6, 8, 10]);
    const n1 = rand(1, d1 - 1);
    const n2 = rand(1, d2 - 1);
    let answerNum, answerDen;
    if (op === '+') {
      answerNum = n1 * d2 + n2 * d1; answerDen = d1 * d2;
    } else if (op === '−') {
      answerNum = n1 * d2 - n2 * d1; answerDen = d1 * d2;
      if (answerNum < 0) { answerNum = -answerNum; }
    } else {
      answerNum = n1 * n2; answerDen = d1 * d2;
    }
    // Simplify
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g = gcd(Math.abs(answerNum), answerDen);
    answerNum /= g; answerDen /= g;
    const answer = `${answerNum}/${answerDen}`;
    const wrong1 = `${answerNum + 1}/${answerDen}`;
    const wrong2 = `${answerNum}/${answerDen + 1}`;
    const wrong3 = `${answerNum + 2}/${answerDen + 1}`;
    const choices = shuffle([answer, wrong1, wrong2, wrong3].filter((v, i, a) => a.indexOf(v) === i));
    while (choices.length < 4) choices.push(`${rand(1, 10)}/${rand(2, 10)}`);
    qs.push({
      text: `Simplify: ${n1}/${d1} ${op} ${n2}/${d2}`,
      category: 'Fractions',
      choices: choices.slice(0, 4).map(String),
      correctIndex: choices.slice(0, 4).indexOf(answer),
      solution: `${n1}/${d1} ${op} ${n2}/${d2} = ${answer}`,
      sectionId: SECTIONS.math.id,
    });
  }
  return qs;
}

function genMathDecimals(count) {
  const qs = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.random() * 50 + 1).toFixed(2);
    const b = (Math.random() * 50 + 1).toFixed(2);
    const op = pick(['+', '−', '×']);
    let answer;
    if (op === '+') answer = (parseFloat(a) + parseFloat(b)).toFixed(2);
    else if (op === '−') answer = (parseFloat(a) - parseFloat(b)).toFixed(2);
    else answer = (parseFloat(a) * parseFloat(b)).toFixed(2);
    const wrong = [
      (parseFloat(answer) + 1.5).toFixed(2),
      (parseFloat(answer) - 1.2).toFixed(2),
      (parseFloat(answer) + 3.7).toFixed(2),
    ];
    const choices = shuffle([answer, ...wrong]);
    qs.push({
      text: `Calculate: ${a} ${op} ${b}`,
      category: 'Decimals',
      choices,
      correctIndex: choices.indexOf(answer),
      solution: `${a} ${op} ${b} = ${answer}`,
      sectionId: SECTIONS.math.id,
    });
  }
  return qs;
}

function genMathPercentages(count) {
  const qs = [];
  const templates = [
    () => {
      const whole = rand(50, 500);
      const pct = pick([10, 15, 20, 25, 30, 40, 50, 60, 75, 80]);
      const answer = (whole * pct / 100);
      return { text: `What is ${pct}% of ${whole}?`, answer, solution: `${pct}% of ${whole} = ${pct}/100 × ${whole} = ${answer}` };
    },
    () => {
      const part = rand(10, 90);
      const whole = rand(100, 500);
      const answer = ((part / whole) * 100).toFixed(1);
      return { text: `${part} is what percent of ${whole}?`, answer, solution: `(${part}/${whole}) × 100 = ${answer}%` };
    },
    () => {
      const original = rand(40, 200);
      const pct = pick([10, 20, 25, 30, 50]);
      const increased = original * (1 + pct / 100);
      return { text: `If a price of $${original} is increased by ${pct}%, what is the new price?`, answer: increased, solution: `$${original} × (1 + ${pct}/100) = $${increased}` };
    },
  ];
  for (let i = 0; i < count; i++) {
    const { text, answer, solution } = pick(templates)();
    const numAnswer = parseFloat(answer);
    const wrong = [numAnswer * 1.1, numAnswer * 0.9, numAnswer + 5].map(v => parseFloat(v.toFixed(1)));
    const choices = shuffle([numAnswer, ...wrong].map(v => String(v)));
    qs.push({ text, category: 'Percentages', choices, correctIndex: choices.indexOf(String(numAnswer)), solution, sectionId: SECTIONS.math.id });
  }
  return qs;
}

function genMathRatios(count) {
  const qs = [];
  for (let i = 0; i < count; i++) {
    const a = rand(2, 8); const b = rand(2, 8); const c = rand(10, 50);
    const x = (b * c) / a;
    const text = `If ${a} is to ${b} as ${c} is to x, what is x?`;
    const wrong = [x + 2, x - 2 > 0 ? x - 2 : x + 4, x * 1.5].map(v => Math.round(v));
    const choices = shuffle([Math.round(x), ...wrong]).map(String);
    qs.push({ text, category: 'Ratios', choices, correctIndex: choices.indexOf(String(Math.round(x))), solution: `${a}/${b} = ${c}/x → x = ${b}×${c}/${a} = ${Math.round(x)}`, sectionId: SECTIONS.math.id });
  }
  return qs;
}

function genMathConversions(count) {
  const qs = [];
  const conversions = [
    { q: 'How many milliliters are in {v} liters?', fn: v => v * 1000, unit: 'mL', sol: v => `${v} L × 1000 = ${v * 1000} mL` },
    { q: 'How many pounds is {v} kilograms? (1 kg ≈ 2.2 lb)', fn: v => parseFloat((v * 2.2).toFixed(1)), unit: 'lb', sol: v => `${v} kg × 2.2 = ${(v * 2.2).toFixed(1)} lb` },
    { q: 'Convert {v} inches to centimeters. (1 in = 2.54 cm)', fn: v => parseFloat((v * 2.54).toFixed(2)), unit: 'cm', sol: v => `${v} in × 2.54 = ${(v * 2.54).toFixed(2)} cm` },
    { q: 'How many grams are in {v} ounces? (1 oz ≈ 28.35 g)', fn: v => parseFloat((v * 28.35).toFixed(1)), unit: 'g', sol: v => `${v} oz × 28.35 = ${(v * 28.35).toFixed(1)} g` },
    { q: 'Convert {v} Fahrenheit to Celsius. C = (F − 32) × 5/9', fn: v => parseFloat(((v - 32) * 5 / 9).toFixed(1)), unit: '°C', sol: v => `(${v} − 32) × 5/9 = ${((v - 32) * 5 / 9).toFixed(1)}°C` },
    { q: 'How many teaspoons are in {v} tablespoons? (1 tbsp = 3 tsp)', fn: v => v * 3, unit: 'tsp', sol: v => `${v} tbsp × 3 = ${v * 3} tsp` },
    { q: 'How many hours are in {v} minutes?', fn: v => parseFloat((v / 60).toFixed(2)), unit: 'hours', sol: v => `${v} min ÷ 60 = ${(v / 60).toFixed(2)} hours` },
    { q: 'Convert {v} meters to feet. (1 m ≈ 3.281 ft)', fn: v => parseFloat((v * 3.281).toFixed(1)), unit: 'ft', sol: v => `${v} m × 3.281 = ${(v * 3.281).toFixed(1)} ft` },
  ];
  for (let i = 0; i < count; i++) {
    const c = pick(conversions);
    const v = rand(2, 30);
    const answer = c.fn(v);
    const wrong = [answer * 1.2, answer * 0.8, answer + 5].map(x => parseFloat(x.toFixed(1)));
    const choices = shuffle([answer, ...wrong].slice(0, 4)).map(String);
    qs.push({
      text: c.q.replace('{v}', v),
      category: 'Conversions',
      choices,
      correctIndex: choices.indexOf(String(answer)),
      solution: c.sol(v),
      sectionId: SECTIONS.math.id,
    });
  }
  return qs;
}

function genMathAlgebra(count) {
  const qs = [];
  for (let i = 0; i < count; i++) {
    const type = pick(['linear', 'expression', 'inequality']);
    if (type === 'linear') {
      const a = rand(2, 8); const b = rand(1, 20); const result = rand(10, 50);
      const x = (result - b) / a;
      if (x !== Math.floor(x)) continue;
      const wrong = [x + 1, x - 1 > 0 ? x - 1 : x + 2, x + 3].map(Math.round);
      const choices = shuffle([x, ...wrong]).map(String);
      qs.push({ text: `Solve for x: ${a}x + ${b} = ${result}`, category: 'Algebra', choices, correctIndex: choices.indexOf(String(x)), solution: `${a}x = ${result} - ${b} = ${result - b}; x = ${x}`, sectionId: SECTIONS.math.id });
    } else if (type === 'expression') {
      const a = rand(2, 6); const b = rand(1, 10); const x = rand(1, 8);
      const result = a * x + b;
      const wrong = [result + 2, result - 2 > 0 ? result - 2 : result + 3, result * 2].map(Math.round);
      const choices = shuffle([result, ...wrong]).map(String);
      qs.push({ text: `If f(x) = ${a}x + ${b}, what is f(${x})?`, category: 'Algebra', choices, correctIndex: choices.indexOf(String(result)), solution: `f(${x}) = ${a}(${x}) + ${b} = ${a * x} + ${b} = ${result}`, sectionId: SECTIONS.math.id });
    } else {
      const a = rand(2, 6); const b = rand(1, 15);
      const threshold = b / a;
      const ans = rand(Math.ceil(threshold) + 1, Math.ceil(threshold) + 10);
      const wrong = [Math.floor(threshold) > 0 ? Math.floor(threshold) : 1, ans + 3, ans - 2 > 0 ? ans - 2 : ans + 1];
      const choices = shuffle([ans, ...wrong]).map(String);
      qs.push({ text: `Solve: ${a}x > ${b}. Which value of x satisfies the inequality?`, category: 'Algebra', choices, correctIndex: choices.indexOf(String(ans)), solution: `x > ${b}/${a} = ${threshold.toFixed(1)}, so x = ${ans} works`, sectionId: SECTIONS.math.id });
    }
  }
  return qs;
}

function genMathWordProblems(count) {
  const qs = [];
  const templates = [
    () => {
      const rate = rand(3, 8); const hours = rand(2, 6); const pay = rate * hours;
      return { text: `A nurse earns $${rate} per hour. How much does she earn for a ${hours}-hour shift?`, answer: pay, solution: `$${rate} × ${hours} = $${pay}` };
    },
    () => {
      const pills = rand(3, 8); const times = rand(2, 4); const days = rand(3, 7);
      const total = pills * times * days;
      return { text: `A patient takes ${pills} pills ${times} times per day. How many pills are needed for ${days} days?`, answer: total, solution: `${pills} × ${times} × ${days} = ${total} pills` };
    },
    () => {
      const dose = rand(5, 20); const concentration = rand(2, 10); const volume = dose / concentration;
      return { text: `A doctor orders ${dose} mg of a medication. The available concentration is ${concentration} mg/mL. How many mL should be administered?`, answer: volume, solution: `${dose} mg ÷ ${concentration} mg/mL = ${volume} mL` };
    },
    () => {
      const total = rand(100, 500); const pct = pick([15, 20, 25, 30, 40]);
      const result = total * (1 - pct / 100);
      return { text: `A hospital has ${total} beds. If ${pct}% are currently unoccupied, how many beds are in use?`, answer: result, solution: `${total} × (1 - ${pct}/100) = ${total} × ${(1 - pct / 100).toFixed(2)} = ${result}` };
    },
    () => {
      const a = rand(30, 80); const b = rand(30, 80);
      const avg = (a + b) / 2;
      return { text: `A student scored ${a} on Test 1 and ${b} on Test 2. What is the average score?`, answer: avg, solution: `(${a} + ${b}) / 2 = ${avg}` };
    },
    () => {
      const speed = rand(40, 70); const time = rand(2, 5); const dist = speed * time;
      return { text: `An ambulance travels at ${speed} mph for ${time} hours. How far does it travel?`, answer: dist, solution: `Distance = Speed × Time = ${speed} × ${time} = ${dist} miles` };
    },
  ];
  for (let i = 0; i < count; i++) {
    const { text, answer, solution } = pick(templates)();
    const wrong = [answer + rand(1, 10), answer - rand(1, 10) > 0 ? answer - rand(1, 10) : answer + 15, answer * 1.5].map(Math.round);
    const choices = shuffle([answer, ...wrong].map(v => String(Math.round(v))));
    qs.push({ text, category: 'Word Problems', choices, correctIndex: choices.indexOf(String(Math.round(answer))), solution, sectionId: SECTIONS.math.id });
  }
  return qs;
}

function generateMathQuestions(count) {
  // Distribute across topics
  const perTopic = Math.ceil(count / 8);
  let all = [
    ...genMathBasicArithmetic(perTopic),
    ...genMathFractions(perTopic),
    ...genMathDecimals(perTopic),
    ...genMathPercentages(perTopic),
    ...genMathRatios(perTopic),
    ...genMathConversions(perTopic),
    ...genMathAlgebra(perTopic),
    ...genMathWordProblems(perTopic),
  ];
  shuffle(all);
  return all.slice(0, count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// READING PASSAGES + QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const READING_PASSAGES = [
  {
    title: 'The History of Vaccination',
    text: `Edward Jenner's development of the smallpox vaccine in 1796 marked a turning point in medical history. By observing that milkmaids who had contracted cowpox seemed immune to smallpox, Jenner hypothesized that exposure to a milder disease could protect against a more deadly one. He tested this by inoculating a young boy with cowpox material and later exposing him to smallpox; the boy did not develop the disease.

Jenner's work laid the foundation for modern immunology. Over the following centuries, vaccines were developed for diseases including polio, measles, and tetanus. The World Health Organization declared smallpox eradicated in 1980, a testament to the power of widespread vaccination programs.

Today, vaccine development continues to evolve. mRNA technology, initially developed for COVID-19 vaccines, is being explored for influenza, HIV, and even certain cancers. The principles Jenner established — using a weakened or modified agent to stimulate immunity — remain central to vaccine science.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main idea of this passage?', correct: 'Jenner\'s discovery of vaccination transformed medicine and continues to influence modern science.', distractors: ['Smallpox was the most dangerous disease in history.', 'Milkmaids were immune to all diseases.', 'mRNA technology was invented during COVID-19.'] },
      { skill: 'detail', text: 'According to the passage, when did the WHO declare smallpox eradicated?', correct: '1980', distractors: ['1796', '1950', '2020'] },
      { skill: 'inference', text: 'What can be inferred about Jenner\'s approach to medicine?', correct: 'He relied on careful observation and systematic experimentation.', distractors: ['He was primarily motivated by financial gain.', 'He had access to advanced laboratory equipment.', 'He rejected the scientific method.'] },
      { skill: 'purpose', text: 'Why does the author mention mRNA technology in the final paragraph?', correct: 'To show that Jenner\'s foundational principles continue to drive new medical advances.', distractors: ['To argue that COVID-19 was the most important disease.', 'To suggest that old vaccines are no longer effective.', 'To explain why smallpox returned.'] },
      { skill: 'pov', text: 'What is the author\'s tone toward vaccination?', correct: 'Strongly positive and supportive of its historical impact.', distractors: ['Neutral and disinterested.', 'Critical and skeptical.', 'Nostalgic for pre-vaccine times.'] },
      { skill: 'organization', text: 'How is the passage primarily organized?', correct: 'Chronologically, from Jenner\'s discovery to modern vaccine science.', distractors: ['By comparing different diseases.', 'By presenting a problem and multiple solutions.', 'In order of importance of different vaccines.'] },
      { skill: 'logic', text: 'Which statement best supports the passage\'s claim that vaccination is powerful?', correct: 'The complete eradication of smallpox worldwide.', distractors: ['Jenner was a respected doctor.', 'Milkmaids were healthy.', 'COVID-19 vaccines were developed quickly.'] },
    ]
  },
  {
    title: 'Sleep and Memory Consolidation',
    text: `Recent neuroscience research has revealed that sleep plays a critical role in memory consolidation — the process by which short-term memories are transformed into long-term ones. During deep sleep stages, the brain replays neural patterns that were active during waking experiences, strengthening synaptic connections and transferring information from the hippocampus to the cortex.

Studies have shown that students who sleep after studying retain significantly more information than those who stay awake for the same period. One landmark experiment found that participants who slept between learning sessions improved their performance by 10-40%, while those who remained awake showed no improvement. Sleep deprivation, conversely, impairs the hippocampus's ability to encode new memories.

The implications extend beyond academic performance. Healthcare professionals working long shifts may be at risk for memory-related errors. Research suggests that even a short 20-minute nap can partially restore cognitive function, supporting the case for structured rest periods in high-stakes environments like hospitals.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central idea of this passage?', correct: 'Sleep is essential for converting short-term memories into long-term ones and has practical implications.', distractors: ['Naps are better than full nights of sleep.', 'The hippocampus stores all human memories.', 'Students should never study at night.'] },
      { skill: 'detail', text: 'According to the passage, what happens to neural patterns during deep sleep?', correct: 'The brain replays them, strengthening synaptic connections.', distractors: ['They are permanently erased.', 'They become random and disorganized.', 'They are converted into dreams.'] },
      { skill: 'inference', text: 'What can be inferred about shift workers based on this passage?', correct: 'They may be more prone to making memory-related errors due to sleep disruption.', distractors: ['They have better memories than day workers.', 'They do not need to consolidate memories.', 'Their brains function differently.'] },
      { skill: 'purpose', text: 'Why does the author mention the experiment with learning sessions?', correct: 'To provide scientific evidence that sleep improves memory retention.', distractors: ['To prove that studying is pointless.', 'To compare different learning methods.', 'To criticize students who study late.'] },
      { skill: 'pov', text: 'The author\'s perspective on sleep is best described as:', correct: 'Evidence-based and advocacy-oriented.', distractors: ['Skeptical and questioning.', 'Neutral and detached.', 'Emotional and personal.'] },
      { skill: 'organization', text: 'What organizational pattern does this passage follow?', correct: 'Research findings followed by practical implications.', distractors: ['Chronological narrative.', 'Compare and contrast.', 'Problem-solution.'] },
      { skill: 'logic', text: 'Which evidence would most weaken the passage\'s argument?', correct: 'A study showing no difference in memory between sleepers and non-sleepers.', distractors: ['A study about dream content.', 'An article about sleep disorders.', 'Research on exercise and memory.'] },
    ]
  },
  {
    title: 'The Water Cycle and Climate Change',
    text: `The water cycle — the continuous movement of water through evaporation, condensation, and precipitation — is fundamental to life on Earth. Solar energy drives evaporation from oceans, lakes, and rivers, converting liquid water into vapor that rises into the atmosphere. As this vapor cools, it condenses into clouds and eventually falls as precipitation, replenishing water sources on land.

Climate change is disrupting this delicate cycle in measurable ways. Rising global temperatures increase evaporation rates, leading to more moisture in the atmosphere. This intensifies precipitation events, causing more severe flooding in some regions while paradoxically contributing to drought in others. Warmer air holds more moisture — for every 1°C increase in temperature, the atmosphere can hold approximately 7% more water vapor.

These changes have profound implications for agriculture and water management. Regions dependent on glacial meltwater face a double threat: glaciers are retreating, reducing long-term water storage, while changing rainfall patterns make water availability less predictable. Farmers must adapt to these shifting conditions through improved irrigation techniques and drought-resistant crop varieties.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the primary focus of this passage?', correct: 'Climate change is significantly disrupting the natural water cycle with far-reaching consequences.', distractors: ['The water cycle has always been unpredictable.', 'Agriculture is the main cause of climate change.', 'Glaciers are the most important water source.'] },
      { skill: 'detail', text: 'According to the passage, how much more water vapor can the atmosphere hold per 1°C increase?', correct: 'Approximately 7%', distractors: ['Approximately 1%', 'Approximately 15%', 'Approximately 20%'] },
      { skill: 'inference', text: 'What can be inferred about regions dependent on glacial meltwater?', correct: 'They face increasing water insecurity as temperatures rise.', distractors: ['Their water supply is increasing.', 'They are unaffected by climate change.', 'They have found permanent solutions.'] },
      { skill: 'purpose', text: 'What is the purpose of the second paragraph?', correct: 'To explain how rising temperatures alter the water cycle\'s balance.', distractors: ['To argue against climate science.', 'To describe the water cycle in detail.', 'To promote specific farming practices.'] },
      { skill: 'pov', text: 'The author views climate change\'s impact on the water cycle as:', correct: 'A serious and well-documented disruption.', distractors: ['An exaggeration by scientists.', 'A natural and harmless variation.', 'An unsolvable problem.'] },
      { skill: 'organization', text: 'How does the passage develop its argument?', correct: 'It introduces the water cycle, explains disruptions, then discusses consequences.', distractors: ['It presents opposing viewpoints equally.', 'It uses only personal anecdotes.', 'It moves from solutions to problems.'] },
      { skill: 'logic', text: 'Which statement is best supported by the information in the passage?', correct: 'Intensified precipitation and drought can occur simultaneously in different regions.', distractors: ['All regions will experience more rainfall.', 'Water management is not affected by climate change.', 'Farmers have no way to adapt.'] },
    ]
  },
  {
    title: 'Antibiotic Resistance',
    text: `Antibiotic resistance occurs when bacteria evolve mechanisms to survive exposure to drugs that once killed them. This natural evolutionary process has been dramatically accelerated by the overuse and misuse of antibiotics in both human medicine and agriculture. When antibiotics are prescribed unnecessarily — often for viral infections like the common cold — or when patients fail to complete their full course of treatment, bacteria have more opportunities to develop resistance.

The consequences are already being felt worldwide. The World Health Organization has identified antibiotic resistance as one of the greatest threats to global health. Infections caused by resistant bacteria, such as methicillin-resistant Staphylococcus aureus (MRSA), are more difficult and expensive to treat. Some patients face infections that respond to no available antibiotics.

Addressing this crisis requires a multifaceted approach. Healthcare providers must prescribe antibiotics more judiciously. Patients need education about the importance of completing prescribed courses. Agricultural use of antibiotics must be reduced. Investment in research for new antibiotics and alternative treatments, such as bacteriophage therapy, is urgently needed to stay ahead of evolving bacteria.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main argument of this passage?', correct: 'Antibiotic resistance is a serious global threat driven by misuse that requires urgent, multifaceted solutions.', distractors: ['Antibiotics should never be used.', 'Bacteria are becoming extinct.', 'Viral infections can be treated with antibiotics.'] },
      { skill: 'detail', text: 'According to the passage, what does MRSA stand for?', correct: 'Methicillin-resistant Staphylococcus aureus', distractors: ['Multiple-resistant Staphylococcus aureus', 'Medical-resistant Staphylococcus aureus', 'Methicillin-responsive Staphylococcus aureus'] },
      { skill: 'inference', text: 'What can be inferred about the future if antibiotic resistance continues unchecked?', correct: 'Common infections could once again become life-threatening.', distractors: ['All bacteria will eventually die.', 'New antibiotics will automatically be developed.', 'Only hospitals will be affected.'] },
      { skill: 'purpose', text: 'Why does the author mention bacteriophage therapy?', correct: 'To highlight that alternative research avenues are being explored.', distractors: ['To recommend it as the only solution.', 'To suggest antibiotics are unnecessary.', 'To explain how bacteria reproduce.'] },
      { skill: 'pov', text: 'The author\'s attitude toward current antibiotic practices is:', correct: 'Concerned and calling for reform.', distractors: ['Satisfied with the status quo.', 'Indifferent to the outcome.', 'Optimistic without reservation.'] },
      { skill: 'organization', text: 'Which best describes the structure of this passage?', correct: 'Problem identification → current consequences → proposed solutions.', distractors: ['Historical overview → personal story → conclusion.', 'Definition → comparison → prediction.', 'Hypothesis → experiment → results.'] },
      { skill: 'logic', text: 'Which action would most directly address the cause of antibiotic resistance mentioned in the passage?', correct: 'Reducing unnecessary prescriptions of antibiotics for viral infections.', distractors: ['Developing stronger cleaning products.', 'Vaccinating all patients against bacteria.', 'Closing hospitals during outbreaks.'] },
    ]
  },
  {
    title: 'The Gut-Brain Connection',
    text: `The human gut contains approximately 100 trillion microorganisms — collectively known as the gut microbiome — that play a far more significant role in overall health than previously understood. Research over the past two decades has revealed a bidirectional communication pathway between the gut and the brain, often called the "gut-brain axis." This connection operates through the vagus nerve, immune signaling molecules, and neurotransmitter production.

Remarkably, about 95% of the body's serotonin — a neurotransmitter crucial for mood regulation — is produced in the gut. Studies in mice have shown that altering the gut microbiome can change behavior, reducing anxiety-like responses. In humans, correlations have been found between gut microbiome composition and conditions including depression, anxiety, and even autism spectrum disorder.

These findings are reshaping medical approaches to mental health. Probiotics and dietary interventions are being studied as complementary treatments for depression and anxiety. While the field is still young, the gut-brain axis represents a promising frontier in understanding the complex relationship between physical and mental health.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central theme of this passage?', correct: 'The gut microbiome communicates bidirectionally with the brain, influencing mental health in significant ways.', distractors: ['Serotonin is only produced in the brain.', 'Probiotics can cure all mental illnesses.', 'Mouse studies are unreliable for human medicine.'] },
      { skill: 'detail', text: 'What percentage of the body\'s serotonin is produced in the gut?', correct: 'About 95%', distractors: ['About 50%', 'About 75%', 'About 10%'] },
      { skill: 'inference', text: 'What can be inferred about the future of mental health treatment?', correct: 'Dietary and gut-based interventions may become standard complementary therapies.', distractors: ['Traditional therapy will become obsolete.', 'Medications will no longer be needed.', 'Mental health is purely a gut issue.'] },
      { skill: 'purpose', text: 'Why does the author mention studies in mice?', correct: 'To provide experimental evidence that gut changes can influence behavior.', distractors: ['To argue that animal studies are more important than human studies.', 'To show that mice and humans are identical.', 'To criticize animal research.'] },
      { skill: 'pov', text: 'The author\'s perspective on gut-brain research is best described as:', correct: 'Cautiously optimistic about its potential.', distractors: ['Deeply skeptical.', 'Enthusiastically certain.', 'Completely dismissive.'] },
      { skill: 'organization', text: 'How does the author structure the information?', correct: 'From establishing the gut-brain connection to evidence to medical implications.', distractors: ['By comparing past and present research.', 'Through a series of unrelated facts.', 'By presenting only counterarguments.'] },
      { skill: 'logic', text: 'Which finding would strengthen the passage\'s argument about the gut-brain axis?', correct: 'A clinical trial showing probiotics reduce depression symptoms.', distractors: ['A study showing the gut has no nerves.', 'Research proving serotonin is only in the brain.', 'Evidence that diet has no effect on mood.'] },
    ]
  },
  {
    title: 'Telemedicine and Healthcare Access',
    text: `The COVID-19 pandemic catalyzed a rapid expansion of telemedicine, transforming how patients access healthcare. Before 2020, telehealth visits accounted for less than 1% of outpatient care in the United States. By April 2020, that figure had surged to over 40% of all visits, as both providers and patients adapted to virtual consultations.

Telemedicine offers significant advantages for rural and underserved communities. Patients who previously traveled hours for specialist appointments can now consult with providers from home. Follow-up visits, medication management, and mental health counseling have proven particularly well-suited to virtual formats. Studies have shown comparable outcomes for many conditions managed via telehealth versus in-person visits.

However, challenges remain. The "digital divide" — disparities in internet access and technology literacy — threatens to exacerbate existing health inequities. Elderly patients and those in low-income communities may struggle to access virtual care. Additionally, certain examinations and procedures inherently require physical presence. Policymakers must balance the convenience of telemedicine with ensuring equitable access and maintaining quality of care.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main idea of this passage?', correct: 'Telemedicine expanded rapidly during the pandemic and offers benefits but faces equity and quality challenges.', distractors: ['Telemedicine has completely replaced in-person care.', 'COVID-19 made healthcare more accessible.', 'Only rural patients benefit from telemedicine.'] },
      { skill: 'detail', text: 'What percentage of outpatient care did telehealth represent before 2020?', correct: 'Less than 1%', distractors: ['About 10%', 'About 25%', 'About 40%'] },
      { skill: 'inference', text: 'What can be inferred about elderly patients and telemedicine?', correct: 'They may face barriers to using virtual healthcare services.', distractors: ['They prefer telemedicine over all other options.', 'They have the best internet access.', 'They do not need healthcare.'] },
      { skill: 'purpose', text: 'Why does the author discuss the "digital divide"?', correct: 'To highlight a significant equity concern with telemedicine expansion.', distractors: ['To argue against internet access.', 'To suggest telemedicine is only for wealthy patients.', 'To promote a specific technology company.'] },
      { skill: 'pov', text: 'The author\'s stance on telemedicine is best characterized as:', correct: 'Balanced — acknowledging benefits while noting important limitations.', distractors: ['Completely supportive without reservations.', 'Strongly opposed to virtual healthcare.', 'Indifferent to healthcare delivery methods.'] },
      { skill: 'organization', text: 'What approach does the passage use to present information?', correct: 'It presents the growth, benefits, and then challenges of telemedicine.', distractors: ['It argues only one perspective.', 'It uses a question-and-answer format.', 'It tells a personal story.'] },
      { skill: 'logic', text: 'Based on the passage, which group would benefit LEAST from telemedicine?', correct: 'Elderly patients with limited technology access in low-income areas.', distractors: ['Rural patients with good internet access.', 'Patients needing medication management.', 'Patients seeking mental health counseling.'] },
    ]
  },
  {
    title: 'The Placebo Effect in Medicine',
    text: `The placebo effect — the phenomenon in which patients experience real improvements in their condition after receiving an inactive treatment — has long fascinated researchers. Far from being merely "in their heads," placebo responses involve measurable physiological changes. Brain imaging studies have shown that placebos can trigger the release of endorphins and dopamine, reduce activity in pain-processing regions, and even alter immune responses.

The placebo effect poses both challenges and opportunities for medicine. In clinical trials, new drugs must demonstrate effectiveness beyond placebo responses, which can be surprisingly strong. Placebos have been shown to relieve pain, reduce inflammation, improve symptoms of Parkinson's disease, and alleviate depression — all through the power of expectation and belief.

Ethical considerations complicate the clinical use of placebos. Deceiving patients into believing they are receiving active treatment raises serious concerns about informed consent. However, some researchers argue that "open-label" placebos — given with full disclosure that they contain no active ingredients — can still produce meaningful benefits. This emerging field suggests that the healing relationship between patient and provider may be therapeutic in itself.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the primary focus of this passage?', correct: 'The placebo effect produces real physiological changes and presents both challenges and opportunities for medicine.', distractors: ['All medicine is just placebo.', 'Patients should be deceived for their own good.', 'Placebos have no measurable effects.'] },
      { skill: 'detail', text: 'According to the passage, what chemicals can placebos trigger the release of?', correct: 'Endorphins and dopamine', distractors: ['Serotonin and cortisol', 'Adrenaline and insulin', 'Melatonin and histamine'] },
      { skill: 'inference', text: 'What does the passage suggest about the mind-body relationship?', correct: 'Mental states and expectations can produce measurable physical changes.', distractors: ['The mind and body are completely separate.', 'Physical health has no connection to mental states.', 'Only drugs can cause physical changes.'] },
      { skill: 'purpose', text: 'Why does the author discuss "open-label" placebos?', correct: 'To show that even without deception, placebos may offer benefits.', distractors: ['To recommend them as a replacement for all drugs.', 'To argue that all placebos are unethical.', 'To explain why placebos are no longer used.'] },
      { skill: 'pov', text: 'The author\'s view of the placebo effect is:', correct: 'Respectful of its real impact while acknowledging complexities.', distractors: ['Dismissive and skeptical.', 'Suggesting placebos replace medicine.', 'Uncritical enthusiasm.'] },
      { skill: 'organization', text: 'How is the passage structured?', correct: 'Explanation of the phenomenon → clinical implications → ethical considerations.', distractors: ['Personal narrative → conclusion.', 'Question → answer → new question.', 'Chronological history of medicine.'] },
      { skill: 'logic', text: 'Which evidence would most challenge the idea that placebos are "just in the mind"?', correct: 'Brain scans showing measurable neurotransmitter changes after placebo administration.', distractors: ['Patients reporting they feel better.', 'Doctors prescribing sugar pills.', 'A survey about patient preferences.'] },
    ]
  },
  {
    title: 'Nursing Shortage Crisis',
    text: `The United States faces a nursing shortage that is projected to worsen significantly over the next decade. The Bureau of Labor Statistics estimates that the country will need an additional 275,000 nurses by 2030, driven by an aging population, increased chronic disease prevalence, and the retirement of current nurses. The COVID-19 pandemic accelerated this trend, as burnout, trauma, and inadequate support drove many experienced nurses from the profession.

Multiple factors contribute to the shortage. Nursing education programs face capacity constraints — insufficient faculty, limited clinical placement sites, and budget limitations prevent schools from accepting all qualified applicants. In 2021, nursing schools turned away over 80,000 qualified applicants. Meanwhile, the demanding nature of the profession, including long hours, emotional strain, and exposure to workplace violence, creates high turnover rates.

Solutions require coordinated action across multiple sectors. Increasing funding for nursing education, improving working conditions, offering competitive compensation, and creating mentorship programs for new nurses are all critical. Technology, including electronic health records and AI-assisted clinical decision support, may also help by reducing administrative burden and allowing nurses to focus more on direct patient care.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the passage primarily about?', correct: 'The growing U.S. nursing shortage, its causes, and potential solutions.', distractors: ['Nurses are overpaid.', 'Technology will replace all nurses.', 'The pandemic had no effect on nursing.'] },
      { skill: 'detail', text: 'According to the passage, how many additional nurses will be needed by 2030?', correct: '275,000', distractors: ['80,000', '100,000', '500,000'] },
      { skill: 'inference', text: 'What can be inferred about nursing education programs?', correct: 'They are unable to meet the demand for new nurses due to resource constraints.', distractors: ['They have unlimited capacity.', 'They reject all applicants.', 'They are fully funded by the government.'] },
      { skill: 'purpose', text: 'Why does the author mention the number of rejected applicants?', correct: 'To quantify the gap between demand for nursing education and available capacity.', distractors: ['To criticize nursing schools.', 'To show that too many people want to be nurses.', 'To recommend closing some programs.'] },
      { skill: 'pov', text: 'The author\'s perspective on addressing the nursing shortage is:', correct: 'Pragmatic, calling for action across education, policy, and technology.', distractors: ['Pessimistic — nothing can be done.', 'Focusing only on technology as the answer.', 'Blaming individual nurses.'] },
      { skill: 'organization', text: 'What is the overall structure of the passage?', correct: 'Problem identification → contributing factors → proposed solutions.', distractors: ['Historical overview → personal stories.', 'Definition → examples → unrelated topic.', 'Cause → cause → cause (no solutions).'] },
      { skill: 'logic', text: 'Which intervention would most directly address the cause mentioned about nursing education?', correct: 'Increasing funding for nursing faculty and clinical placement sites.', distractors: ['Building more hospitals.', 'Increasing patient-to-nurse ratios.', 'Reducing the number of nursing specializations.'] },
    ]
  },
  {
    title: 'Social Media and Adolescent Mental Health',
    text: `A growing body of research links heavy social media use to mental health concerns among adolescents. Studies have found that teenagers who spend more than three hours daily on social media face double the risk of depression and anxiety compared to those who use it minimally. The mechanisms are thought to include social comparison, cyberbullying, sleep disruption, and the addictive design of notification systems.

However, the relationship between social media and mental health is not straightforwardly negative. For some adolescents — particularly those who are marginalized or geographically isolated — online communities provide vital social support and a sense of belonging. LGBTQ+ youth, for example, report that online spaces help them connect with peers who share their experiences and find acceptance they may lack in their immediate environment.

Parents, educators, and policymakers are grappling with how to mitigate risks while preserving benefits. Proposed approaches include digital literacy education, age-appropriate platform design, screen time limits, and requiring social media companies to be more transparent about their algorithms. The challenge lies in implementing these measures without restricting the positive connections that vulnerable young people find online.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main idea of this passage?', correct: 'Social media has complex effects on adolescent mental health, with both risks and benefits that require balanced approaches.', distractors: ['Social media is entirely harmful to teenagers.', 'Social media has no effect on mental health.', 'Parents should ban all social media.'] },
      { skill: 'detail', text: 'According to the passage, what is the increased risk for teens using social media over three hours daily?', correct: 'Double the risk of depression and anxiety', distractors: ['Triple the risk of obesity.', 'No increased risk.', 'Half the risk of social isolation.'] },
      { skill: 'inference', text: 'What can be inferred about LGBTQ+ youth and social media?', correct: 'It can serve as an important source of community and acceptance they may lack offline.', distractors: ['They should be banned from social media.', 'They only use social media for entertainment.', 'They are unaffected by online interactions.'] },
      { skill: 'purpose', text: 'Why does the author mention LGBTQ+ youth specifically?', correct: 'To provide a concrete example of how social media can benefit marginalized adolescents.', distractors: ['To argue that only LGBTQ+ youth use social media.', 'To suggest they are more vulnerable than others.', 'To recommend specific platforms for them.'] },
      { skill: 'pov', text: 'The author\'s stance on social media and adolescents is:', correct: 'Nuanced, acknowledging both harms and benefits.', distractors: ['Completely against social media for youth.', 'Uncritically positive about social media.', 'Uninterested in the outcome.'] },
      { skill: 'organization', text: 'How does the author organize the discussion?', correct: 'Risks → benefits → proposed solutions.', distractors: ['Only negative effects.', 'Chronological history of social media.', 'Personal anecdotes only.'] },
      { skill: 'logic', text: 'Which approach would best address the passage\'s concern about addictive design?', correct: 'Requiring platforms to be transparent about their algorithms and notification systems.', distractors: ['Banning all teenagers from social media.', 'Encouraging more screen time.', 'Removing all content moderation.'] },
    ]
  },
  {
    title: 'Deforestation and Biodiversity',
    text: `Tropical deforestation destroys approximately 10 million hectares of forest annually — an area roughly the size of South Korea. This loss threatens biodiversity on an unprecedented scale. Tropical forests, which cover less than 7% of Earth's land surface, harbor more than half of the world's species. When these forests are cleared, countless organisms lose their habitats, pushing many toward extinction.

The primary drivers of tropical deforestation are agriculture (particularly cattle ranching, soy cultivation, and palm oil production), logging, and infrastructure development. In the Amazon, cattle ranching accounts for approximately 80% of deforestation. Small-scale subsistence farming also contributes, though its impact is generally less than commercial agriculture.

Conservation strategies must address both the ecological and economic dimensions of the problem. Protected areas, sustainable forestry certifications, and payments for ecosystem services have shown promise. Consumer awareness campaigns targeting products linked to deforestation — such as palm oil and beef — can shift market demand. Ultimately, solutions must provide viable economic alternatives for communities that currently depend on forest clearing for their livelihoods.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central argument of this passage?', correct: 'Tropical deforestation threatens biodiversity and requires solutions that balance ecological and economic needs.', distractors: ['Deforestation is not a serious problem.', 'Only the Amazon rainforest matters.', 'Conservation is impossible.'] },
      { skill: 'detail', text: 'How much tropical forest is destroyed annually, according to the passage?', correct: 'Approximately 10 million hectares', distractors: ['1 million hectares', '50 million hectares', '100 million hectares'] },
      { skill: 'inference', text: 'What can be inferred about the relationship between deforestation and poverty?', correct: 'Economic desperation drives some deforestation, so solutions must address livelihood needs.', distractors: ['Deforestation has no economic causes.', 'All deforestation is caused by corporations.', 'Poverty and deforestation are unrelated.'] },
      { skill: 'purpose', text: 'Why does the author compare the deforested area to the size of South Korea?', correct: 'To help readers visualize the enormous scale of annual forest loss.', distractors: ['To suggest South Korea causes deforestation.', 'To recommend South Korea as a model for conservation.', 'To show forests only exist in Asia.'] },
      { skill: 'pov', text: 'The author\'s perspective on addressing deforestation is:', correct: 'Practical and multi-pronged, combining ecological and economic approaches.', distractors: ['Radical — all human activity must stop.', 'Indifferent to the outcome.', 'Focused only on banning agriculture.'] },
      { skill: 'organization', text: 'What structure does the passage follow?', correct: 'Scale of problem → causes → solutions.', distractors: ['Personal narrative → opinion.', 'Problem → unrelated problem → conclusion.', 'Definition → etymology → examples.'] },
      { skill: 'logic', text: 'Which strategy would most directly address the primary driver of Amazon deforestation?', correct: 'Promoting sustainable cattle ranching practices and reducing beef demand.', distractors: ['Building more roads in the Amazon.', 'Increasing palm oil production elsewhere.', 'Encouraging more logging.'] },
    ]
  },
];

// Generate reading questions from passages
function generateReadingQuestions(count, excludeTitles = []) {
  const available = READING_PASSAGES.filter(p => !excludeTitles.includes(p.title));
  if (available.length === 0) return [];

  const skills = ['mainIdea', 'detail', 'inference', 'purpose', 'pov', 'organization', 'logic'];
  const questions = [];
  let passageIdx = 0;

  while (questions.length < count) {
    const passage = available[passageIdx % available.length];
    const shuffledQs = shuffle(passage.questions);
    for (const q of shuffledQs) {
      if (questions.length >= count) break;
      const allChoices = shuffle([q.correct, ...q.distractors]);
      questions.push({
        text: q.text,
        category: 'Reading',
        choices: allChoices,
        correctIndex: allChoices.indexOf(q.correct),
        solution: q.correct,
        sectionId: SECTIONS.reading.id,
        passage: passage.text,
        passageTitle: passage.title,
      });
    }
    passageIdx++;
    if (passageIdx > available.length * 3) break; // safety
  }
  return questions.slice(0, count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRITING QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateWritingQuestions(count) {
  const bank = [
    // Mechanics
    { cat: 'Mechanics', text: 'Which sentence uses commas correctly?', correct: 'After the surgery, the patient was moved to recovery.', distractors: ['After the surgery the patient, was moved to recovery.', 'After, the surgery the patient was moved to recovery.', 'After the surgery the patient was moved, to recovery.'] },
    { cat: 'Mechanics', text: 'Which sentence contains a subject-verb agreement error?', correct: 'The group of nurses were tired after the shift.', distractors: ['The team of doctors is experienced.', 'Each patient receives individual attention.', 'The staff meets every Monday.'] },
    { cat: 'Mechanics', text: 'Which sentence is punctuated correctly?', correct: 'The patient reported pain; however, vital signs were stable.', distractors: ['The patient reported pain however, vital signs were stable.', 'The patient reported pain, however vital signs were stable.', 'The patient reported pain; however vital signs were stable.'] },
    { cat: 'Mechanics', text: 'Which word is spelled correctly?', correct: 'accommodate', distractors: ['accomodate', 'acommodate', 'accomadate'] },
    { cat: 'Mechanics', text: 'Which sentence uses an apostrophe correctly?', correct: 'The patient\'s chart was updated by the nurse.', distractors: ['The patients\' chart was updated by the nurse\'s.', 'The patient chart\'s was updated by the nurses.', 'The patients chart was\' updated.'] },
    { cat: 'Mechanics', text: 'Select the correctly punctuated sentence.', correct: 'Dr. Smith, the attending physician, ordered the lab work.', distractors: ['Dr. Smith the attending physician ordered the lab work.', 'Dr. Smith, the attending physician ordered, the lab work.', 'Dr. Smith the attending, physician, ordered the lab work.'] },
    { cat: 'Mechanics', text: 'Which sentence avoids the dangling modifier?', correct: 'Walking into the room, the nurse noticed the patient was restless.', distractors: ['Walking into the room, the patient was restless.', 'Walking into the room, restless was the patient.', 'The patient was restless walking, into the room.'] },
    { cat: 'Mechanics', text: 'Which sentence uses a semicolon correctly?', correct: 'The lab results were abnormal; the doctor ordered additional tests.', distractors: ['The lab results were abnormal; and the doctor ordered tests.', 'The lab results were abnormal, the doctor ordered; additional tests.', 'The lab; results were abnormal the doctor ordered tests.'] },
    { cat: 'Mechanics', text: 'Which sentence demonstrates correct parallel structure?', correct: 'The nurse administered medication, monitored vitals, and documented the findings.', distractors: ['The nurse administered medication, was monitoring vitals, and documented the findings.', 'The nurse administering medication, monitored vitals, and documented the findings.', 'The nurse administered medication, monitoring vitals, and was documenting findings.'] },
    { cat: 'Mechanics', text: 'Which sentence uses who/whom correctly?', correct: 'The patient whom the doctor treated was discharged.', distractors: ['The patient who the doctor treated was discharged.', 'The patient whom the doctor was treated by.', 'The patient who the doctor was treating by.'] },
    { cat: 'Mechanics', text: 'Which sentence contains a run-on error?', correct: 'The patient was stable the nurse documented the status.', distractors: ['The patient was stable, and the nurse documented the status.', 'The patient was stable. The nurse documented the status.', 'The patient was stable; the nurse documented the status.'] },
    { cat: 'Mechanics', text: 'Which sentence uses a colon correctly?', correct: 'The patient had one complaint: persistent headaches.', distractors: ['The patient had: one complaint persistent headaches.', 'The patient: had one complaint persistent headaches.', 'The patient had one complaint persistent: headaches.'] },
    { cat: 'Mechanics', text: 'Which word fits correctly: "The nurse ___ the patient\'s chart."', correct: 'updated', distractors: ['update', 'updating', 'updates'] },
    { cat: 'Mechanics', text: 'Which sentence is a fragment?', correct: 'Running down the hallway to the emergency room.', distractors: ['The nurse ran down the hallway to the emergency room.', 'She ran to help the patient in the emergency room.', 'Down the hallway, the nurse ran quickly.'] },
    { cat: 'Mechanics', text: 'Which sentence uses affect/effect correctly?', correct: 'The medication had a positive effect on the patient\'s symptoms.', distractors: ['The medication had a positive affect on the symptoms.', 'The medication effect the patient positively.', 'The medication was effected by the symptoms.'] },
    // Transitions
    { cat: 'Transitions', text: 'Which transition best shows contrast?', correct: 'However', distractors: ['Furthermore', 'Similarly', 'Additionally'] },
    { cat: 'Transitions', text: 'Which transition best shows cause and effect?', correct: 'Consequently', distractors: ['Nevertheless', 'Meanwhile', 'Similarly'] },
    { cat: 'Transitions', text: '"The patient\'s condition improved. ___, the doctor decided to continue the current treatment."', correct: 'Therefore', distractors: ['On the other hand', 'Despite this', 'In contrast'] },
    { cat: 'Transitions', text: '"The first study showed positive results. ___, the second study contradicted those findings."', correct: 'However', distractors: ['Moreover', 'Similarly', 'For example'] },
    { cat: 'Transitions', text: 'Which transition is best for adding a supporting point?', correct: 'Furthermore', distractors: ['Conversely', 'Nevertheless', 'Instead'] },
    { cat: 'Transitions', text: '"Nurses must document patient care. ___, they must communicate changes to the attending physician."', correct: 'Additionally', distractors: ['Rather', 'In contrast', 'On the contrary'] },
    { cat: 'Transitions', text: '"Exercise has many health benefits. ___, regular physical activity reduces the risk of heart disease."', correct: 'For example', distractors: ['In contrast', 'On the other hand', 'Despite this'] },
    { cat: 'Transitions', text: 'Which transition signals a conclusion?', correct: 'In summary', distractors: ['First', 'Moreover', 'For instance'] },
    { cat: 'Transitions', text: '"The treatment was expensive. ___, it was the most effective option available."', correct: 'Nevertheless', distractors: ['Therefore', 'Similarly', 'As a result'] },
    { cat: 'Transitions', text: 'Which transition best introduces an alternative viewpoint?', correct: 'Conversely', distractors: ['Indeed', 'Specifically', 'Likewise'] },
    // Paragraph Logic
    { cat: 'Paragraph Logic', text: 'A paragraph about hospital infection control begins with "Hand hygiene is the most effective way to prevent infections." Which sentence best supports this topic sentence?', correct: 'Studies show that proper hand washing reduces hospital-acquired infections by up to 40%.', distractors: ['Many hospitals have cafeterias for staff.', 'Nurses often work 12-hour shifts.', 'Medical equipment is becoming more expensive.'] },
    { cat: 'Paragraph Logic', text: 'Which sentence should be REMOVED from a paragraph about the benefits of breastfeeding?\n1. Breast milk provides essential nutrients.\n2. Breastfeeding reduces infection risk in infants.\n3. The first baby formula was invented in 1867.\n4. Breastfeeding promotes mother-infant bonding.', correct: 'Sentence 3 — it is about formula history, not breastfeeding benefits.', distractors: ['Sentence 1 — it is too general.', 'Sentence 2 — it is unrelated.', 'Sentence 4 — it is not well supported.'] },
    { cat: 'Paragraph Logic', text: 'In an essay about nursing education, which sentence is the most effective thesis statement?', correct: 'Nursing programs should incorporate more simulation-based training to better prepare students for clinical practice.', distractors: ['Nursing is a popular career choice.', 'Nurses work in hospitals.', 'I want to become a nurse.'] },
    { cat: 'Paragraph Logic', text: 'A paragraph about patient-centered care includes the topic sentence: "Effective communication improves patient outcomes." Which sentence does NOT belong?', correct: 'The hospital was built in 1965.', distractors: ['Active listening helps nurses understand patient concerns.', 'Clear discharge instructions reduce readmission rates.', 'Teach-back methods ensure patients understand their care plans.'] },
    { cat: 'Paragraph Logic', text: 'Which sentence best serves as a concluding sentence for a paragraph about vaccination benefits?', correct: 'Given these wide-ranging benefits, vaccination remains one of the most important public health interventions available.', distractors: ['Some people are afraid of needles.', 'Vaccines were first developed centuries ago.', 'There are many types of vaccines.'] },
    { cat: 'Paragraph Logic', text: 'In a paragraph about the nursing shortage, the sentences are:\n1. The nursing shortage is a growing crisis.\n2. Burnout contributes significantly to nurse turnover.\n3. Competitive salaries can help retain experienced nurses.\n4. Inadequate staffing compromises patient safety.\nWhat is the best order?', correct: '1, 4, 2, 3 — problem statement, consequence, cause, solution.', distractors: ['2, 3, 1, 4', '4, 1, 3, 2', '3, 2, 4, 1'] },
    { cat: 'Paragraph Logic', text: 'Which transition sentence best connects a paragraph about causes of obesity to a paragraph about solutions?', correct: 'While the causes of obesity are complex, several evidence-based strategies have proven effective in combating this epidemic.', distractors: ['Obesity is a serious problem.', 'There are many causes of obesity.', 'Exercise is important.'] },
    { cat: 'Paragraph Logic', text: 'A paragraph argues that technology improves patient safety. Which is the strongest supporting evidence?', correct: 'Electronic medication administration records reduce medication errors by 55%.', distractors: ['Technology is popular in hospitals.', 'Many nurses own smartphones.', 'Computers are becoming faster.'] },
    // Passage Development
    { cat: 'Passage Development', text: 'An essay argues for mandatory nurse-to-patient ratios. Which introduction strategy is most effective?', correct: 'Start with a striking statistic about patient outcomes linked to nurse staffing levels.', distractors: ['Start with a dictionary definition of "nurse."', 'Start with the author\'s personal biography.', 'Start with an unrelated anecdote.'] },
    { cat: 'Passage Development', text: 'In a research paper on mental health in healthcare workers, which section should come first after the introduction?', correct: 'A literature review of existing research on healthcare worker mental health.', distractors: ['Personal opinions about mental health.', 'A section on unrelated medical topics.', 'The conclusion.'] },
    { cat: 'Passage Development', text: 'An essay compares two approaches to pain management. Which organizational strategy is most appropriate?', correct: 'Point-by-point comparison, alternating between the two approaches for each criterion.', distractors: ['Random order without structure.', 'Only discussing one approach.', 'Using no evidence or examples.'] },
    { cat: 'Passage Development', text: 'Which revision most improves the sentence: "The thing about nursing is that it is a very important job and people should do it."', correct: 'Nursing is a vital profession that requires dedication, compassion, and extensive training.', distractors: ['Nursing is important.', 'The thing about nursing is very good.', 'People should be nurses because it is important.'] },
    { cat: 'Passage Development', text: 'In an argumentative essay about healthcare policy, which element is most essential for a strong argument?', correct: 'Counter-argument with rebuttal to address opposing viewpoints.', distractors: ['Emotional appeals without evidence.', 'Personal attacks on opponents.', 'Repeating the thesis multiple times.'] },
    { cat: 'Passage Development', text: 'A student is writing about the benefits of exercise. Which approach best develops the topic?', correct: 'Present specific research findings with examples and explain their significance.', distractors: ['List benefits without explanation.', 'Only mention opinions.', 'Copy text from an encyclopedia.'] },
    { cat: 'Passage Development', text: 'Which concluding strategy is most effective for a persuasive essay?', correct: 'Restate the thesis with conviction, summarize key evidence, and end with a call to action.', distractors: ['Introduce entirely new arguments.', 'Simply repeat the introduction word for word.', 'End with "In conclusion, that is my essay."'] },
    { cat: 'Passage Development', text: 'In a narrative essay about a clinical experience, which detail makes the writing most vivid?', correct: 'The sharp beep of the cardiac monitor punctuated the silence as the nurse checked the patient\'s IV line.', distractors: ['A nurse went into a room.', 'Something happened in the hospital.', 'The event was important.'] },
  ];

  shuffle(bank);
  const selected = [];
  for (let i = 0; i < count && i < bank.length; i++) {
    const q = bank[i];
    const allChoices = shuffle([q.correct, ...q.distractors]);
    selected.push({
      text: q.text,
      category: q.cat,
      choices: allChoices,
      correctIndex: allChoices.indexOf(q.correct),
      solution: q.correct,
      sectionId: SECTIONS.writing.id,
    });
  }
  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCIENCE QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateScienceQuestions(count) {
  const bank = [
    // Cardiovascular
    { t: 'Cardiovascular', q: 'Which chamber of the heart receives deoxygenated blood from the body?', c: 'Right atrium', d: ['Left atrium', 'Right ventricle', 'Left ventricle'], s: 'The right atrium receives deoxygenated blood via the superior and inferior vena cava.' },
    { t: 'Cardiovascular', q: 'What is the normal resting heart rate for an adult?', c: '60-100 bpm', d: ['40-50 bpm', '100-120 bpm', '120-150 bpm'], s: 'Normal adult resting heart rate ranges from 60 to 100 beats per minute.' },
    { t: 'Cardiovascular', q: 'Which valve separates the left atrium from the left ventricle?', c: 'Mitral (bicuspid) valve', d: ['Tricuspid valve', 'Aortic valve', 'Pulmonary valve'], s: 'The mitral valve, also called the bicuspid valve, is between the left atrium and left ventricle.' },
    { t: 'Cardiovascular', q: 'What is the primary function of red blood cells?', c: 'Transport oxygen to tissues', d: ['Fight infection', 'Clot blood', 'Produce antibodies'], s: 'Red blood cells contain hemoglobin, which binds and transports oxygen throughout the body.' },
    { t: 'Cardiovascular', q: 'Which artery carries oxygenated blood from the lungs to the heart?', c: 'Pulmonary vein', d: ['Pulmonary artery', 'Aorta', 'Vena cava'], s: 'Pulmonary veins carry oxygenated blood from the lungs to the left atrium of the heart.' },
    { t: 'Cardiovascular', q: 'What is the pacemaker of the heart?', c: 'SA (sinoatrial) node', d: ['AV (atrioventricular) node', 'Bundle of His', 'Purkinje fibers'], s: 'The SA node in the right atrium initiates the electrical impulse that sets the heart rate.' },
    { t: 'Cardiovascular', q: 'Which condition is characterized by narrowing of the coronary arteries?', c: 'Coronary artery disease (CAD)', d: ['Heart failure', 'Arrhythmia', 'Pericarditis'], s: 'CAD involves plaque buildup in the coronary arteries, reducing blood flow to the heart muscle.' },
    { t: 'Cardiovascular', q: 'What is the normal blood pressure range for adults?', c: 'Less than 120/80 mmHg', d: ['140/90 mmHg or higher', '90/60 mmHg or lower', 'Exactly 120/80 mmHg'], s: 'Normal blood pressure is defined as systolic less than 120 and diastolic less than 80 mmHg.' },
    { t: 'Cardiovascular', q: 'What is the function of platelets?', c: 'Blood clotting', d: ['Oxygen transport', 'Immune defense', 'Hormone production'], s: 'Platelets aggregate at wound sites to form clots and prevent excessive bleeding.' },
    { t: 'Cardiovascular', q: 'Which layer of the heart is the thickest and responsible for contraction?', c: 'Myocardium', d: ['Epicardium', 'Endocardium', 'Pericardium'], s: 'The myocardium is the muscular layer of the heart responsible for pumping blood.' },
    { t: 'Cardiovascular', q: 'What is cardiac output?', c: 'Heart rate × stroke volume', d: ['Blood pressure × heart rate', 'Stroke volume ÷ heart rate', 'Heart rate + blood pressure'], s: 'Cardiac output (CO) = Heart Rate (HR) × Stroke Volume (SV), typically 4-8 L/min at rest.' },
    { t: 'Cardiovascular', q: 'Which condition involves inflammation of the pericardium?', c: 'Pericarditis', d: ['Myocarditis', 'Endocarditis', 'Cardiomyopathy'], s: 'Pericarditis is inflammation of the pericardium, the sac surrounding the heart.' },
    // Electrolytes
    { t: 'Electrolytes', q: 'What is the normal serum potassium range?', c: '3.5-5.0 mEq/L', d: ['2.0-3.0 mEq/L', '5.5-7.0 mEq/L', '1.0-2.0 mEq/L'], s: 'Normal serum potassium is 3.5-5.0 mEq/L. Values outside this range can cause cardiac arrhythmias.' },
    { t: 'Electrolytes', q: 'Hypernatremia indicates an excess of which electrolyte?', c: 'Sodium (Na+)', d: ['Potassium (K+)', 'Calcium (Ca2+)', 'Magnesium (Mg2+)'], s: 'Hypernatremia = elevated sodium. Prefix "hyper-" means excess, "-natremia" refers to sodium.' },
    { t: 'Electrolytes', q: 'Which electrolyte is critical for muscle contraction and nerve impulse transmission?', c: 'Calcium (Ca2+)', d: ['Chloride (Cl-)', 'Phosphate (PO4³-)', 'Bicarbonate (HCO3-)'], s: 'Calcium is essential for muscle contraction, nerve signaling, blood clotting, and bone health.' },
    { t: 'Electrolytes', q: 'What is the primary intracellular cation?', c: 'Potassium (K+)', d: ['Sodium (Na+)', 'Calcium (Ca2+)', 'Magnesium (Mg2+)'], s: 'Potassium is the primary cation inside cells, while sodium is the primary extracellular cation.' },
    { t: 'Electrolytes', q: 'Hypokalemia can cause which cardiac complication?', c: 'Arrhythmias', d: ['Hypertension', 'Tachycardia only', 'Bradycardia only'], s: 'Low potassium levels disrupt cardiac cell repolarization, potentially causing dangerous arrhythmias.' },
    { t: 'Electrolytes', q: 'Which hormone regulates calcium levels by increasing reabsorption in the kidneys?', c: 'Parathyroid hormone (PTH)', d: ['Calcitonin', 'Aldosterone', 'ADH'], s: 'PTH increases blood calcium by promoting renal reabsorption, bone resorption, and vitamin D activation.' },
    { t: 'Electrolytes', q: 'What causes the shift of potassium into cells (hypokalemia without loss)?', c: 'Insulin administration', d: ['Acidosis', 'Tissue damage', 'Kidney failure'], s: 'Insulin drives potassium into cells along with glucose, which can lower serum potassium levels.' },
    { t: 'Electrolytes', q: 'Normal serum sodium range is:', c: '135-145 mEq/L', d: ['120-130 mEq/L', '150-160 mEq/L', '100-110 mEq/L'], s: 'Normal serum sodium is 135-145 mEq/L. Hyponatremia is <135, hypernatremia is >145.' },
    // GI
    { t: 'GI', q: 'Where does most nutrient absorption occur?', c: 'Small intestine', d: ['Stomach', 'Large intestine', 'Esophagus'], s: 'The small intestine, especially the jejunum, is where most nutrients are absorbed into the bloodstream.' },
    { t: 'GI', q: 'What enzyme in saliva begins the digestion of starches?', c: 'Amylase (ptyalin)', d: ['Pepsin', 'Lipase', 'Trypsin'], s: 'Salivary amylase (ptyalin) begins starch digestion in the mouth by breaking down complex carbohydrates.' },
    { t: 'GI', q: 'Which organ produces bile?', c: 'Liver', d: ['Gallbladder', 'Pancreas', 'Stomach'], s: 'The liver produces bile, which is stored in the gallbladder and released into the duodenum to emulsify fats.' },
    { t: 'GI', q: 'What is the primary function of the large intestine?', c: 'Water absorption and feces formation', d: ['Protein digestion', 'Bile production', 'Enzyme secretion'], s: 'The large intestine absorbs water and electrolytes, forming and storing feces until elimination.' },
    { t: 'GI', q: 'Which sphincter controls the passage of food from the stomach to the duodenum?', c: 'Pyloric sphincter', d: ['Lower esophageal sphincter', 'Ileocecal valve', 'Internal anal sphincter'], s: 'The pyloric sphincter regulates the movement of chyme from the stomach into the duodenum.' },
    { t: 'GI', q: 'What is peristalsis?', c: 'Wave-like muscular contractions that move food through the GI tract', d: ['Chemical breakdown of food', 'Absorption of nutrients', 'Production of digestive enzymes'], s: 'Peristalsis is involuntary smooth muscle contraction that propels food through the digestive system.' },
    { t: 'GI', q: 'Which vitamin is produced by bacteria in the large intestine?', c: 'Vitamin K', d: ['Vitamin C', 'Vitamin D', 'Vitamin B12'], s: 'Gut bacteria synthesize vitamin K, which is essential for blood clotting factor production.' },
    { t: 'GI', q: 'Crohn\'s disease is characterized by:', c: 'Chronic inflammation that can affect any part of the GI tract', d: ['Only stomach inflammation', 'Infection of the appendix', 'Acid reflux only'], s: 'Crohn\'s disease is an inflammatory bowel disease causing transmural inflammation anywhere from mouth to anus.' },
    // Immune
    { t: 'Immune', q: 'Which type of white blood cell is the first responder to bacterial infection?', c: 'Neutrophil', d: ['Lymphocyte', 'Monocyte', 'Eosinophil'], s: 'Neutrophils are the most abundant WBCs and the first to arrive at sites of bacterial infection.' },
    { t: 'Immune', q: 'What is the role of T-helper cells (CD4+)?', c: 'Coordinate the immune response by activating other immune cells', d: ['Produce antibodies directly', 'Destroy parasites', 'Carry oxygen'], s: 'CD4+ T-helper cells release cytokines that activate B cells, cytotoxic T cells, and macrophages.' },
    { t: 'Immune', q: 'Which immunoglobulin is associated with allergic reactions?', c: 'IgE', d: ['IgG', 'IgA', 'IgM'], s: 'IgE binds to mast cells and basophils, triggering histamine release during allergic responses.' },
    { t: 'Immune', q: 'What is the function of the spleen in the immune system?', c: 'Filter blood and remove old red blood cells', d: ['Produce stomach acid', 'Store bile', 'Regulate blood sugar'], s: 'The spleen filters blood, removes damaged RBCs, and houses immune cells that fight blood-borne pathogens.' },
    { t: 'Immune', q: 'Which cells are responsible for producing antibodies?', c: 'B lymphocytes (plasma cells)', d: ['T lymphocytes', 'Natural killer cells', 'Macrophages'], s: 'B cells differentiate into plasma cells that secrete antibodies specific to encountered antigens.' },
    { t: 'Immune', q: 'What is anaphylaxis?', c: 'A severe, life-threatening systemic allergic reaction', d: ['A mild skin rash', 'A type of autoimmune disease', 'A bacterial infection'], s: 'Anaphylaxis involves widespread mast cell degranulation causing airway compromise, hypotension, and potentially death.' },
    { t: 'Immune', q: 'Which type of immunity results from vaccination?', c: 'Active artificial immunity', d: ['Passive natural immunity', 'Active natural immunity', 'Passive artificial immunity'], s: 'Vaccines provide active artificial immunity by stimulating the immune system to produce antibodies without causing disease.' },
    // Neurology
    { t: 'Neurology', q: 'What is the basic functional unit of the nervous system?', c: 'Neuron', d: ['Glial cell', 'Synapse', 'Dendrite'], s: 'The neuron is the fundamental unit that transmits electrical and chemical signals throughout the nervous system.' },
    { t: 'Neurology', q: 'Which neurotransmitter is primarily involved in muscle contraction at the neuromuscular junction?', c: 'Acetylcholine', d: ['Dopamine', 'Serotonin', 'GABA'], s: 'Acetylcholine is released at motor end plates, triggering skeletal muscle contraction.' },
    { t: 'Neurology', q: 'The blood-brain barrier is formed primarily by:', c: 'Tight junctions between capillary endothelial cells', d: ['Skull bones', 'Meninges', 'CSF pressure'], s: 'The BBB consists of tight junctions between brain capillary endothelial cells, restricting substance passage.' },
    { t: 'Neurology', q: 'Which cranial nerve is responsible for facial sensation?', c: 'Trigeminal nerve (CN V)', d: ['Facial nerve (CN VII)', 'Optic nerve (CN II)', 'Vagus nerve (CN X)'], s: 'The trigeminal nerve provides sensory innervation to the face and motor innervation to mastication muscles.' },
    { t: 'Neurology', q: 'What condition results from insufficient dopamine production in the substantia nigra?', c: 'Parkinson\'s disease', d: ['Alzheimer\'s disease', 'Multiple sclerosis', 'Epilepsy'], s: 'Parkinson\'s disease involves degeneration of dopamine-producing neurons, causing tremor, rigidity, and bradykinesia.' },
    { t: 'Neurology', q: 'The Glasgow Coma Scale assesses which three responses?', c: 'Eye opening, verbal response, motor response', d: ['Heart rate, blood pressure, temperature', 'Breathing, circulation, airway', 'Vision, hearing, touch'], s: 'GCS evaluates eye opening (1-4), verbal (1-5), and motor (1-6) responses for a total of 3-15.' },
    { t: 'Neurology', q: 'Which part of the brain regulates body temperature, hunger, and thirst?', c: 'Hypothalamus', d: ['Cerebellum', 'Medulla oblongata', 'Thalamus'], s: 'The hypothalamus maintains homeostasis by regulating temperature, hunger, thirst, sleep, and hormonal function.' },
    { t: 'Neurology', q: 'A stroke caused by a blood clot is classified as:', c: 'Ischemic stroke', d: ['Hemorrhagic stroke', 'Transient ischemic attack', 'Aneurysm'], s: 'Ischemic strokes (87% of all strokes) result from arterial occlusion by a thrombus or embolus.' },
    // Renal
    { t: 'Renal', q: 'What is the functional unit of the kidney?', c: 'Nephron', d: ['Glomerulus', 'Ureter', 'Renal pelvis'], s: 'Each kidney contains approximately 1 million nephrons, which filter blood and produce urine.' },
    { t: 'Renal', q: 'Which hormone stimulates red blood cell production in response to low oxygen?', c: 'Erythropoietin (EPO)', d: ['Aldosterone', 'ADH (vasopressin)', 'Renin'], s: 'The kidneys produce EPO when oxygen levels are low, stimulating bone marrow to produce red blood cells.' },
    { t: 'Renal', q: 'What is the normal glomerular filtration rate (GFR)?', c: '90-120 mL/min', d: ['10-30 mL/min', '200-300 mL/min', '10-15 mL/min'], s: 'Normal GFR is approximately 90-120 mL/min/1.73m² and indicates healthy kidney filtration.' },
    { t: 'Renal', q: 'ADH (antidiuretic hormone) acts on which part of the nephron?', c: 'Collecting duct', d: ['Proximal convoluted tubule', 'Loop of Henle', 'Glomerulus'], s: 'ADH increases water permeability in the collecting ducts, concentrating urine when the body is dehydrated.' },
    { t: 'Renal', q: 'What does the renin-angiotensin-aldosterone system (RAAS) regulate?', c: 'Blood pressure and fluid balance', d: ['Blood sugar levels', 'Thyroid function', 'Bone density'], s: 'RAAS increases blood pressure through vasoconstriction (angiotensin II) and sodium/water retention (aldosterone).' },
    { t: 'Renal', q: 'Which substance is NOT normally found in urine?', c: 'Glucose', d: ['Urea', 'Creatinine', 'Uric acid'], s: 'Glucose is normally completely reabsorbed in the proximal tubule; its presence indicates diabetes or renal disease.' },
    { t: 'Renal', q: 'The kidneys regulate blood pH primarily by:', c: 'Excreting or retaining hydrogen ions and reabsorbing bicarbonate', d: ['Producing insulin', 'Filtering red blood cells', 'Secreting digestive enzymes'], s: 'Kidneys maintain acid-base balance by excreting H+ ions and reabsorbing/producing HCO3-.' },
    // Hematology
    { t: 'Hematology', q: 'What is the most abundant type of white blood cell?', c: 'Neutrophils', d: ['Lymphocytes', 'Monocytes', 'Eosinophils'], s: 'Neutrophils comprise 50-70% of all white blood cells and are the first responders to infection.' },
    { t: 'Hematology', q: 'Hemoglobin is composed of how many protein chains?', c: 'Four (2 alpha, 2 beta)', d: ['Two', 'Six', 'Eight'], s: 'Hemoglobin is a tetramer with 4 protein globin chains, each carrying an iron-containing heme group.' },
    { t: 'Hematology', q: 'What is the normal hemoglobin range for adult males?', c: '13.5-17.5 g/dL', d: ['10-12 g/dL', '18-22 g/dL', '8-10 g/dL'], s: 'Normal adult male hemoglobin: 13.5-17.5 g/dL; female: 12.0-16.0 g/dL.' },
    { t: 'Hematology', q: 'Which condition is characterized by sickle-shaped red blood cells?', c: 'Sickle cell disease', d: ['Thalassemia', 'Hemophilia', 'Leukemia'], s: 'Sickle cell disease is caused by a mutation in the hemoglobin gene, causing RBCs to become rigid and sickle-shaped.' },
    { t: 'Hematology', q: 'What is the role of vitamin K in blood clotting?', c: 'It is required for the synthesis of clotting factors II, VII, IX, and X', d: ['It dissolves clots', 'It increases platelet count', 'It prevents platelet aggregation'], s: 'Vitamin K is essential for hepatic production of clotting factors; deficiency leads to prolonged clotting time.' },
    { t: 'Hematology', q: 'What does a hematocrit test measure?', c: 'The percentage of blood volume occupied by red blood cells', d: ['White blood cell count', 'Platelet count', 'Hemoglobin type'], s: 'Hematocrit is the packed RBC volume as a percentage of total blood volume; normal is ~40-54% for males.' },
    { t: 'Hematology', q: 'Which type of anemia is caused by vitamin B12 deficiency?', c: 'Pernicious anemia (megaloblastic)', d: ['Iron-deficiency anemia', 'Sickle cell anemia', 'Aplastic anemia'], s: 'B12 deficiency causes megaloblastic anemia with abnormally large, immature red blood cells.' },
    // Homeostasis
    { t: 'Homeostasis', q: 'What is the normal body temperature range?', c: '36.1-37.2°C (97-99°F)', d: ['34-35°C', '39-40°C', '33-34°C'], s: 'Normal core body temperature is approximately 36.1-37.2°C, regulated by the hypothalamus.' },
    { t: 'Homeostasis', q: 'Negative feedback mechanisms work by:', c: 'Counteracting a change to restore the set point', d: ['Amplifying a change away from the set point', 'Having no effect on the variable', 'Only working in the nervous system'], s: 'Negative feedback reverses a deviation from normal, bringing the variable back to its set point.' },
    { t: 'Homeostasis', q: 'Shivering is an example of homeostasis because it:', c: 'Generates heat to raise body temperature when cold', d: ['Cools the body when too hot', 'Increases heart rate', 'Reduces blood pressure'], s: 'Shivering is rapid muscle contraction that produces heat, helping restore normal body temperature.' },
    { t: 'Homeostasis', q: 'Which organ is the primary regulator of blood glucose?', c: 'Pancreas', d: ['Liver', 'Thyroid', 'Adrenal gland'], s: 'The pancreas secretes insulin (to lower glucose) and glucagon (to raise glucose), maintaining blood sugar balance.' },
    { t: 'Homeostasis', q: 'Osmoreceptors in the hypothalamus detect changes in:', c: 'Blood osmolarity (water concentration)', d: ['Blood glucose', 'Blood oxygen', 'Blood pH'], s: 'Osmoreceptors sense blood concentration; high osmolarity triggers ADH release and thirst.' },
    { t: 'Homeostasis', q: 'What happens when blood glucose rises above normal?', c: 'Pancreatic beta cells release insulin to promote glucose uptake', d: ['Alpha cells release glucagon', 'The liver releases glucose', 'Kidneys excrete all glucose'], s: 'Insulin from beta cells signals cells to absorb glucose, lowering blood sugar to the normal range.' },
    // Respiratory
    { t: 'Respiratory', q: 'What is the primary muscle of respiration?', c: 'Diaphragm', d: ['Intercostal muscles', 'Sternocleidomastoid', 'Abdominal muscles'], s: 'The diaphragm contracts and flattens during inhalation, creating negative pressure that draws air into the lungs.' },
    { t: 'Respiratory', q: 'Where does gas exchange occur in the lungs?', c: 'Alveoli', d: ['Bronchi', 'Trachea', 'Bronchioles'], s: 'Alveoli are tiny air sacs surrounded by capillaries where O2 and CO2 are exchanged across thin membranes.' },
    { t: 'Respiratory', q: 'What is the normal respiratory rate for adults?', c: '12-20 breaths per minute', d: ['6-8 breaths per minute', '25-30 breaths per minute', '30-40 breaths per minute'], s: 'Normal adult respiratory rate is 12-20 breaths per minute at rest.' },
    { t: 'Respiratory', q: 'Surfactant is produced by which cells in the lungs?', c: 'Type II alveolar cells (pneumocytes)', d: ['Type I alveolar cells', 'Goblet cells', 'Ciliated epithelial cells'], s: 'Type II pneumocytes produce surfactant, which reduces surface tension and prevents alveolar collapse.' },
    { t: 'Respiratory', q: 'What is the primary stimulus for breathing in healthy adults?', c: 'Rising CO2 levels (hypercapnia)', d: ['Low oxygen levels', 'High blood pressure', 'Low heart rate'], s: 'Chemoreceptors in the medulla detect rising CO2/H+ and stimulate increased ventilation rate.' },
    { t: 'Respiratory', q: 'COPD includes which two main conditions?', c: 'Chronic bronchitis and emphysema', d: ['Asthma and pneumonia', 'Pulmonary embolism and fibrosis', 'Pneumothorax and pleurisy'], s: 'COPD encompasses chronic bronchitis (airway inflammation) and emphysema (alveolar destruction).' },
    { t: 'Respiratory', q: 'What is the V/Q ratio?', c: 'The ratio of ventilation to perfusion in the lungs', d: ['The ratio of oxygen to carbon dioxide', 'Vital capacity divided by tidal volume', 'Venous blood flow divided by arterial flow'], s: 'V/Q ratio compares air flow (ventilation) to blood flow (perfusion); normal ratio is approximately 0.8.' },
    { t: 'Respiratory', q: 'Pneumonia is best described as:', c: 'Infection and inflammation of the alveoli in one or both lungs', d: ['Collapse of a lung', 'Cancer of the lung tissue', 'Chronic airway narrowing'], s: 'Pneumonia causes alveoli to fill with fluid or pus, impairing gas exchange.' },
    // Sensory
    { t: 'Sensory', q: 'Which part of the eye focuses light onto the retina?', c: 'Lens', d: ['Cornea', 'Iris', 'Pupil'], s: 'The lens changes shape (accommodation) to focus light precisely on the retina for clear vision.' },
    { t: 'Sensory', q: 'Sound vibrations are converted to electrical signals in which structure?', c: 'Cochlea', d: ['Ossicles', 'Tympanic membrane', 'Eustachian tube'], s: 'Hair cells in the cochlea convert mechanical vibrations into neural signals sent via the auditory nerve.' },
    { t: 'Sensory', q: 'Which receptor type detects changes in skin temperature?', c: 'Thermoreceptors', d: ['Mechanoreceptors', 'Nociceptors', 'Proprioceptors'], s: 'Thermoreceptors in the skin detect temperature changes and relay information to the hypothalamus.' },
    { t: 'Sensory', q: 'Rods and cones are photoreceptor cells found in the:', c: 'Retina', d: ['Cornea', 'Iris', 'Optic nerve'], s: 'Rods detect dim light and movement; cones detect color and detail. Both are in the retina.' },
    { t: 'Sensory', q: 'The vestibular system is responsible for:', c: 'Balance and spatial orientation', d: ['Hearing high frequencies', 'Detecting light', 'Taste perception'], s: 'The vestibular apparatus in the inner ear detects head position and motion for balance.' },
    { t: 'Sensory', q: 'Which cranial nerve carries visual information from the retina to the brain?', c: 'Optic nerve (CN II)', d: ['Oculomotor nerve (CN III)', 'Trochlear nerve (CN IV)', 'Abducens nerve (CN VI)'], s: 'The optic nerve transmits visual signals from the retina to the visual cortex in the occipital lobe.' },
    { t: 'Sensory', q: 'Taste buds on the tongue can detect which basic tastes?', c: 'Sweet, sour, salty, bitter, and umami', d: ['Only sweet and sour', 'Sweet, sour, and spicy', 'Sweet, sour, salty, and bitter'], s: 'Five basic tastes are recognized: sweet, sour, salty, bitter, and umami (savory). Spicy is a pain sensation.' },
    { t: 'Sensory', q: 'Proprioceptors detect:', c: 'Body position and movement of limbs', d: ['Light intensity', 'Sound frequency', 'Blood oxygen levels'], s: 'Proprioceptors in muscles, tendons, and joints provide the brain with information about body position.' },
  ];

  shuffle(bank);
  const selected = [];
  for (let i = 0; i < count && i < bank.length; i++) {
    const q = bank[i];
    const allChoices = shuffle([q.c, ...q.d]);
    selected.push({
      text: q.q,
      category: q.t,
      choices: allChoices,
      correctIndex: allChoices.indexOf(q.c),
      solution: q.s,
      sectionId: SECTIONS.science.id,
    });
  }
  return selected;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM SET DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateExamSets(startNum, count) {
  const exams = [];
  let setNum = startNum;

  // Distribution across 100 exams:
  // - 20 Math Focus sets
  // - 20 Reading and Writing sets
  // - 15 Reading Focus sets
  // - 15 Science Focus sets
  // - 15 Writing Focus sets
  // - 15 Mock Exam sets

  const types = [
    { type: 'math', count: 20, title: (n) => `Kaplan Math Questions - Set ${n}`, sections: ['math'], qCounts: { math: 28 }, desc: (n) => `Kaplan Nursing Entrance Exam - Mathematics Practice Set ${n}. Focuses on arithmetic, fractions, decimals, percentages, ratios, conversions, algebra, and word problems.`, time: 60 },
    { type: 'reading-writing', count: 20, title: (n) => `Reading and Writing Exam ${n}`, sections: ['reading', 'writing'], qCounts: { reading: 22, writing: 21 }, desc: (n) => `Kaplan Nursing Entrance Exam - Reading and Writing Practice ${n}. Tests reading comprehension, inference, writing mechanics, and passage development.`, time: 90 },
    { type: 'reading', count: 15, title: (n) => `Kaplan Reading Comprehension - Set ${n}`, sections: ['reading'], qCounts: { reading: 22 }, desc: (n) => `Kaplan Nursing Entrance Exam - Reading Comprehension Practice Set ${n}. Tests main idea, supporting details, inference, author's purpose, point of view, and passage organization.`, time: 60 },
    { type: 'science', count: 15, title: (n) => `Kaplan Science Questions - Set ${n}`, sections: ['science'], qCounts: { science: 20 }, desc: (n) => `Kaplan Nursing Entrance Exam - Science Practice Set ${n}. Covers anatomy and physiology: cardiovascular, electrolytes, GI, immune, neurology, renal, hematology, homeostasis, respiratory, and sensory systems.`, time: 50 },
    { type: 'writing', count: 15, title: (n) => `Kaplan Writing Skills - Set ${n}`, sections: ['writing'], qCounts: { writing: 21 }, desc: (n) => `Kaplan Nursing Entrance Exam - Writing Skills Practice Set ${n}. Tests grammar, mechanics, transitions, paragraph logic, and passage development.`, time: 50 },
    { type: 'mock', count: 15, title: (n) => `Kaplan Mock Exam ${n}`, sections: ['reading', 'math', 'writing', 'science'], qCounts: { reading: 22, math: 28, writing: 21, science: 20 }, desc: (n) => `Kaplan Nursing Entrance Exam - Full Mock Exam ${n}. Comprehensive practice exam covering Reading, Math, Writing, and Science sections, simulating the actual Kaplan entrance exam format.`, time: 165 },
  ];

  for (const { type, count: typeCount, title, sections, qCounts, desc, time } of types) {
    for (let i = 0; i < typeCount; i++) {
      const examSections = sections.map(s => ({ ...SECTIONS[s] }));
      const questions = [];

      for (const sectionKey of sections) {
        const sectionQs = qCounts[sectionKey];
        let generated;
        switch (sectionKey) {
          case 'math':
            generated = generateMathQuestions(sectionQs);
            break;
          case 'reading':
            generated = generateReadingQuestions(sectionQs);
            break;
          case 'writing':
            generated = generateWritingQuestions(sectionQs);
            break;
          case 'science':
            generated = generateScienceQuestions(sectionQs);
            break;
        }
        // Add sectionId to each question
        generated.forEach(q => { q.sectionId = SECTIONS[sectionKey].id; });
        questions.push(...generated);
      }

      const readingPassages = questions
        .filter(q => q.passageTitle)
        .map(q => q.passageTitle)
        .filter((v, i, a) => a.indexOf(v) === i);

      exams.push({
        title: title(setNum),
        description: desc(setNum),
        timeLimitMinutes: time,
        passingPercent: 70,
        showResultsToStudent: true,
        randomizeQuestions: true,
        allowPrevious: true,
        sections: examSections,
        questions,
        readingPassages,
        examType: type,
        setNumber: setNum,
      });
      setNum++;
    }
  }

  return exams;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n🎓 Kaplan Nursing Entrance Exam Batch Creator\n`);
  console.log(`  Mode:      ${DRY_RUN ? 'DRY RUN (no uploads)' : 'LIVE — will write to production Firestore'}`);
  console.log(`  Start set: ${START_SET}`);
  console.log(`  Count:     ${EXAM_COUNT} exams\n`);

  // Generate all exam sets
  console.log('📝 Generating exam sets...');
  const exams = generateExamSets(START_SET, EXAM_COUNT);
  console.log(`   Generated ${exams.length} exam sets.\n`);

  // Summary
  const typeCounts = {};
  let totalQuestions = 0;
  exams.forEach(e => {
    typeCounts[e.examType] = (typeCounts[e.examType] || 0) + 1;
    totalQuestions += e.questions.length;
  });
  console.log('📊 Exam breakdown:');
  for (const [type, cnt] of Object.entries(typeCounts)) {
    console.log(`   ${type}: ${cnt} exams`);
  }
  console.log(`   Total questions: ${totalQuestions}\n`);

  if (DRY_RUN) {
    console.log('🔍 Sample exams:');
    exams.slice(0, 5).forEach(e => {
      console.log(`   • "${e.title}" — ${e.questions.length} questions, ${e.sections.map(s => s.title).join('+')}`);
    });
    console.log(`\n   ... and ${exams.length - 5} more.\n`);

    // Save to JSON for review
    const outPath = path.join(__dirname, '..', 'exam-data-preview.json');
    fs.writeFileSync(outPath, JSON.stringify(exams, null, 2));
    console.log(`📁 Full data saved to: ${outPath}\n`);
    return;
  }

  // Upload to Firestore
  const token = getAccessToken();
  console.log('🔥 Starting Firestore upload...\n');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < exams.length; i++) {
    const exam = exams[i];
    const docId = generateId();
    const docData = {
      ...exam,
      createdBy: ADMIN_UID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'published',
    };

    try {
      await createDocument(docId, docData, token);
      success++;
      if ((i + 1) % 10 === 0 || i === exams.length - 1) {
        console.log(`   ✅ Uploaded ${i + 1}/${exams.length}: "${exam.title}" (id: ${docId})`);
      }
    } catch (err) {
      failed++;
      console.error(`   ❌ Failed "${exam.title}": ${err.message}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✨ Done! ${success} uploaded, ${failed} failed.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});