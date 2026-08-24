/**
 * Kaplan Math Question Generator
 * ----------------------------------------------------------------------------
 * Generates ORIGINAL, randomized math questions in the style of the Kaplan
 * Nursing Entrance Exam (Math section). Topics:
 *
 *   basic arithmetic operations, fractions, decimals, percentages,
 *   ratios and proportions, unit conversions, basic algebra,
 *   word problems and data interpretation.
 *
 * Every question is computed from the same numbers that appear in the text,
 * so the correct answer is always mathematically valid, and the distractors
 * are the classic student mistakes (wrong operation, forgot to simplify,
 * misplaced decimal, etc.).
 *
 * All questions are original — nothing is copied from Kaplan's material.
 */

import { generateProceduralReadingPassage } from './reading-generator.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function rndInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Format a fraction as "3/4", or "3" when the denominator is 1. */
function fmtFrac(num, den) {
  const g = gcd(num, den);
  num /= g;
  den /= g;
  return den === 1 ? String(num) : `${num}/${den}`;
}

/** Format a decimal without float artifacts: 0.60 -> "0.6", 3.00 -> "3". */
function fmtDec(x) {
  return String(Number(x.toFixed(2)));
}

/** Shuffle a copy of an array (Fisher-Yates). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a question object from a correct answer + distractor pool.
 * Ensures exactly 4 distinct choices, then shuffles them.
 */
function buildQuestion(category, text, correct, distractors, solution = '') {
  const correctStr = String(correct);
  const pool = [correctStr, ...(distractors || []).map(String)].filter(
    (v) => v != null && v !== ''
  );
  const choices = [...new Set(pool)].slice(0, 4);

  // Fallback padding: nudge the numeric correct answer if a topic didn't
  // supply enough distinct distractors.
  const base = Number(correctStr);
  let i = 1;
  while (choices.length < 4) {
    const cand = Number.isFinite(base) && correctStr.indexOf('/') === -1
      ? String(base + i)
      : `${correctStr}${i}`;
    if (!choices.includes(cand)) choices.push(cand);
    i++;
  }

  const shuffled = shuffle(choices);
  return {
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    text,
    category,
    choices: shuffled,
    correctIndex: shuffled.indexOf(correctStr),
    solution,
  };
}

// ---------------------------------------------------------------------------
// Topic generators. Each returns an array of { text, category, correct, distractors }.
// ---------------------------------------------------------------------------

/** Basic arithmetic: whole-number addition, subtraction, multiplication, division. */
function genBasicArithmetic(count) {
  const out = [];
  const ops = [
    {
      symbol: '+',
      mk: () => {
        const a = rndInt(15, 98);
        const b = rndInt(7, 49);
        return { a, b };
      },
      num: ({ a, b }) => a + b,
      text: ({ a, b }) => `${a} + ${b}`,
      extra: (r) => [r + 1, r - 1, r + 10],
    },
    {
      symbol: '−',
      mk: () => {
        const a = rndInt(30, 99);
        const b = rndInt(5, a - 1);
        return { a, b };
      },
      num: ({ a, b }) => a - b,
      text: ({ a, b }) => `${a} − ${b}`,
      extra: (r) => [r + 1, r - 1, r + 10],
    },
    {
      symbol: '×',
      mk: () => {
        const a = rndInt(6, 12);
        const b = rndInt(3, 9);
        return { a, b };
      },
      num: ({ a, b }) => a * b,
      text: ({ a, b }) => `${a} × ${b}`,
      extra: (r, { a, b }) => [r + a, r + b, (a + 1) * b],
    },
    {
      symbol: '÷',
      mk: () => {
        const b = rndInt(2, 9);
        const q = rndInt(2, 12);
        return { a: b * q, b };
      },
      num: ({ a, b }) => a / b,
      text: ({ a, b }) => `${a} ÷ ${b}`,
      extra: (r) => [r + 1, r - 1, r + 10],
    },
  ];
  for (let n = 0; n < count; n++) {
    const op = ops[rndInt(0, ops.length - 1)];
    const o = op.mk();
    const correct = String(op.num(o));
    const extras = op.extra(op.num(o), o).map(String).filter((v) => v !== correct);
    out.push({
      text: `What is ${op.text(o)}?`,
      category: 'Basic arithmetic operations',
      correct,
      distractors: extras,
      solution: `${op.text(o)} = ${correct}`,
    });
  }
  return out;
}

/** Addition / subtraction / multiplication / division of fractions. */
function genFractionOperations(count) {
  const out = [];
  const ops = [
    {
      name: 'add',
      symbol: '+',
      compute: (a, b, c, d) => a * d + c * b,
      den: (a, b, c, d) => b * d,
      work: (a, b, c, d) => `${a}/${b} + ${c}/${d} = (${a}×${d} + ${c}×${b}) / (${b}×${d})`,
      extra: (a, b, c, d) => [[a + c, b + d], [a * c, b * d], [a * d - c * b, b * d]],
    },
    {
      name: 'subtract',
      symbol: '-',
      compute: (a, b, c, d) => a * d - c * b,
      den: (a, b, c, d) => b * d,
      work: (a, b, c, d) => `${a}/${b} - ${c}/${d} = (${a}×${d} - ${c}×${b}) / (${b}×${d})`,
      extra: (a, b, c, d) => [[a + c, b + d], [a * c, b * d], [a * d + c * b, b * d]],
    },
    {
      name: 'multiply',
      symbol: '×',
      compute: (a, b, c, d) => a * c,
      den: (a, b, c, d) => b * d,
      work: (a, b, c, d) => `${a}/${b} × ${c}/${d} = (${a}×${c}) / (${b}×${d})`,
      extra: (a, b, c, d) => [[a * c, b + d], [a + c, b + d], [a * d + c * b, b * d]],
    },
    {
      name: 'divide',
      symbol: '÷',
      compute: (a, b, c, d) => a * d,
      den: (a, b, c, d) => b * c,
      work: (a, b, c, d) => `${a}/${b} ÷ ${c}/${d} = (${a}×${d}) / (${b}×${c})`,
      extra: (a, b, c, d) => [[a * c, b * d], [b * d, a * c], [a + c, b + d]],
    },
  ];
  for (let n = 0; n < count; n++) {
    const op = ops[rndInt(0, ops.length - 1)];
    let a, b, c, d, num;
    // re-roll until the answer is positive for subtraction (avoid negatives)
    let guard = 0;
    do {
      b = rndInt(2, 9);
      d = rndInt(2, 9);
      a = rndInt(1, b - 1); // proper fractions
      c = rndInt(1, d - 1);
      num = op.compute(a, b, c, d);
      guard++;
    } while (op.name === 'subtract' && num <= 0 && guard < 25);
    if (op.name === 'subtract' && num <= 0) {
      c = Math.max(1, Math.floor((a * d - 1) / b)); // guarantee num >= 1
      num = a * d - c * b;
    }
    if (op.name === 'divide' && a * d === b * c) {
      a = a === 1 ? a + 1 : a - 1; // avoid answer of exactly 1
      num = op.compute(a, b, c, d);
    }
    const den = op.den(a, b, c, d);
    const correct = fmtFrac(num, den);
    const extras = op.extra(a, b, c, d)
      .map(([n, m]) => fmtFrac(n, m))
      .filter((v) => v !== correct);
    out.push({
      text: `What is ${a}/${b} ${op.symbol} ${c}/${d}?`,
      category: 'Fractions',
      correct,
      distractors: extras,
      solution: `${op.work(a, b, c, d)} = ${correct}`,
    });
  }
  return out;
}

/** Simplify a fraction: (a*k)/(b*k) -> a/b. */
function genSimplifyFractions(count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const a = rndInt(1, 5);
    const b = rndInt(a + 1, 7); // a < b so the simplified form is a proper fraction
    const k = rndInt(2, 6);
    const num = a * k;
    const den = b * k;
    const correct = fmtFrac(a, b);
    const distractors = [
      fmtFrac(a + 1, b),
      fmtFrac(a, b + 1),
      `${a}/${den}`,
    ];
    out.push({
      text: `Simplify the fraction: ${num}/${den}`,
      category: 'Fractions',
      correct,
      distractors,
      solution: `Divide the numerator and denominator by their greatest common factor, ${k}: ${num}/${den} = (${a}×${k}) / (${b}×${k}) = ${correct}`,
    });
  }
  return out;
}

/** Fraction word problems with clean arithmetic. */
function genFractionWordProblems(count) {
  const out = [];
  const templates = [
    (k) => {
      const total = 120 * k;
      return {
        text: `A nurse administers 3/4 of a ${total} mL IV bag. How many mL were given?`,
        correct: (3 * total) / 4,
        distractors: [total / 4, (total * 2) / 4, total],
        solution: `Multiply: (3/4) × ${total} = (3 × ${total}) / 4 = ${(3 * total) / 4} mL`,
      };
    },
    (k) => {
      const total = 60 * k;
      return {
        text: `Of the ${total} patients in a ward, 2/5 are scheduled for morning procedures. How many patients is that?`,
        correct: (2 * total) / 5,
        distractors: [total / 5, (3 * total) / 5, (2 * total) / 3],
        solution: `Multiply: (2/5) × ${total} = (2 × ${total}) / 5 = ${(2 * total) / 5} patients`,
      };
    },
    (k) => {
      const total = 8 * k;
      return {
        text: `A nurse completes 3/4 of a ${total}-hour shift before taking a break. How many hours were completed?`,
        correct: (3 * total) / 4,
        distractors: [total / 4, (total * 2) / 3, total],
        solution: `Multiply: (3/4) × ${total} = (3 × ${total}) / 4 = ${(3 * total) / 4} hours`,
      };
    },
    (k) => {
      const total = 100 * k;
      return {
        text: `A patient drinks 7/10 of a ${total} mL glass of water. How many mL were consumed?`,
        correct: (7 * total) / 10,
        distractors: [(3 * total) / 10, total / 10, total],
        solution: `Multiply: (7/10) × ${total} = (7 × ${total}) / 10 = ${(7 * total) / 10} mL`,
      };
    },
  ];
  for (let n = 0; n < count; n++) {
    const t = templates[rndInt(0, templates.length - 1)](rndInt(1, 4));
    out.push({
      text: t.text,
      category: 'Word problems and Data interpretation',
      correct: String(t.correct),
      distractors: t.distractors.map(String),
      solution: t.solution || '',
    });
  }
  return out;
}

/** Algebra: solve linear equations and evaluate expressions. */
function genAlgebra(count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const kind = rndInt(0, 2);
    if (kind === 0) {
      const x = rndInt(1, 9);
      const a = rndInt(2, 6);
      const b = rndInt(1, 9);
      const c = a * x + b;
      out.push({
        text: `Solve for x: ${a}x + ${b} = ${c}`,
        category: 'Basic algebra',
        correct: String(x),
        distractors: [String(x + 1), String(x - 1), String(c - b - a)],
        solution: `Subtract ${b} from both sides: ${a}x = ${c} − ${b} = ${a * x}. Then divide both sides by ${a}: x = ${a * x} ÷ ${a} = ${x}`,
      });
    } else if (kind === 1) {
      const x = rndInt(2, 9);
      const a = rndInt(2, 6);
      const b = rndInt(1, 9);
      const correct = a * x - b;
      out.push({
        text: `If x = ${x}, evaluate ${a}x − ${b}`,
        category: 'Basic algebra',
        correct: String(correct),
        distractors: [String(a * x + b), String(x - b), String(a * x)],
        solution: `Substitute x = ${x}: ${a}(${x}) − ${b} = ${a * x} − ${b} = ${correct}`,
      });
    } else {
      const x = rndInt(2, 9);
      const d = rndInt(2, 6);
      const correct = x * d;
      out.push({
        text: `Solve for x: x/${d} = ${x}`,
        category: 'Basic algebra',
        correct: String(correct),
        distractors: [String(x + d), String(x * d + 1), String(d)],
        solution: `Multiply both sides by ${d}: x = ${x} × ${d} = ${correct}`,
      });
    }
  }
  return out;
}

/** Ratio & proportion: solve proportions and ratio word problems. */
function genRatioProportion(count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const kind = rndInt(0, 2);
    if (kind === 0) {
      const a = rndInt(1, 5);
      const b = rndInt(2, 9);
      const k = rndInt(2, 6);
      const x = a * k;
      out.push({
        text: `Solve for x: ${a}/${b} = x/${b * k}`,
        category: 'Ratios and proportions',
        correct: String(x),
        distractors: [String(x + b), String(x - a), String(a)],
        solution: `Cross-multiply: x = (${a} × ${b * k}) / ${b} = ${a * k} / 1 = ${x}`,
      });
    } else if (kind === 1) {
      const nurses = rndInt(2, 6);
      const patients = rndInt(4, 10);
      const k = rndInt(3, 8);
      out.push({
        text: `The nurse-to-patient ratio is ${nurses}:${patients}. How many nurses are needed for ${patients * k} patients?`,
        category: 'Ratios and proportions',
        correct: String(nurses * k),
        distractors: [String(patients * k / nurses), String(nurses * k + 1), String(nurses + k)],
        solution: `For ${patients * k} patients, multiply the nurse count by the same factor ${k}: ${nurses} × ${k} = ${nurses * k} nurses`,
      });
    } else {
      const a = rndInt(2, 5);
      const b = rndInt(2, 5);
      const k = rndInt(2, 6);
      out.push({
        text: `A solution mixes ${a} parts saline to ${b} parts water. If the total volume is ${(a + b) * k} mL, how many mL are saline?`,
        category: 'Ratios and proportions',
        correct: String(a * k),
        distractors: [String(b * k), String((a + b) * k / a), String(a * k + 1)],
        solution: `Saline is ${a} out of every ${a + b} parts: (${a} / ${a + b}) × ${(a + b) * k} = ${a * k} mL`,
      });
    }
  }
  return out;
}

/** Decimals: add, subtract, multiply, divide (integer math to avoid float bugs). */
function genDecimals(count) {
  const out = [];
  const ops = [
    {
      symbol: '+', // (a + b) scaled by 100
      mk: () => {
        const a = rndInt(1, 999);
        const b = rndInt(1, 999);
        return { num: (a + b) / 100, text: `${fmtDec(a / 100)} + ${fmtDec(b / 100)}` };
      },
      extra: (r) => [r / 10, r * 10, r + 1],
    },
    {
      symbol: '-',
      mk: () => {
        const a = rndInt(200, 999);
        const b = rndInt(1, a - 1);
        return { num: (a - b) / 100, text: `${fmtDec(a / 100)} − ${fmtDec(b / 100)}` };
      },
      extra: (r) => [r + 0.1, r * 10, r - 0.1],
    },
    {
      symbol: '×',
      mk: () => {
        const a = rndInt(1, 99);
        const b = rndInt(1, 99);
        return { num: (a * b) / 100, text: `${fmtDec(a / 10)} × ${fmtDec(b / 10)}` };
      },
      extra: (r) => [r * 10, r / 10, r + 0.1],
    },
    {
      symbol: '÷',
      mk: () => {
        const a = rndInt(1, 99);
        const d = rndInt(1, 9);
        // a ÷ (d/10) = (a*10)/d
        return { num: (a * 10) / d, text: `${a} ÷ ${fmtDec(d / 10)}` };
      },
      extra: (r) => [r * 10, r / 10, r + 1],
    },
  ];
  for (let n = 0; n < count; n++) {
    const op = ops[rndInt(0, ops.length - 1)];
    const { num, text } = op.mk();
    const correct = fmtDec(num);
    const extras = op.extra(Number(correct)).map(fmtDec).filter((v) => v !== correct);
    out.push({
      text: `What is ${text}?`,
      category: 'Decimals',
      correct,
      distractors: extras,
      solution: `${text} = ${correct}`,
    });
  }
  return out;
}

/** Unit conversions (metric + time). */
function genConversions(count) {
  const out = [];
  const units = [
    { from: 'mL', to: 'L', factor: 1000, div: true, values: [250, 500, 750, 1250, 1500, 2000, 2500] },
    { from: 'L', to: 'mL', factor: 1000, div: false, values: [0.25, 0.5, 0.75, 1.25, 1.5, 2.5] },
    { from: 'mg', to: 'g', factor: 1000, div: true, values: [250, 500, 750, 1250, 1500, 2000] },
    { from: 'g', to: 'mg', factor: 1000, div: false, values: [0.25, 0.5, 0.75, 1.5, 2, 2.5] },
    { from: 'cm', to: 'm', factor: 100, div: true, values: [25, 50, 75, 125, 150, 200, 250] },
    { from: 'm', to: 'cm', factor: 100, div: false, values: [0.25, 0.5, 0.75, 1.25, 1.5, 2.5] },
    { from: 'kg', to: 'g', factor: 1000, div: false, values: [0.25, 0.5, 0.75, 1.5, 2, 2.5] },
    { from: 'm', to: 'km', factor: 1000, div: true, values: [250, 500, 750, 1250, 1500, 2000] },
  ];
  for (let n = 0; n < count; n++) {
    const u = units[rndInt(0, units.length - 1)];
    const value = u.values[rndInt(0, u.values.length - 1)];
    const correct = u.div ? fmtDec(value / u.factor) : fmtDec(value * u.factor);
    out.push({
      text: `Convert ${fmtDec(value)} ${u.from} to ${u.to}:`,
      category: 'Unit conversions',
      correct,
      distractors: [
        fmtDec(u.div ? value * u.factor : value / u.factor),
        fmtDec(Number(correct) * 10),
        fmtDec(Number(correct) / 10),
      ].filter((v) => v !== correct),
      solution: `${fmtDec(value)} ${u.from} ${u.div ? '÷' : '×'} ${u.factor} = ${correct} ${u.to}`,
    });
  }
  return out;
}

/** Percentages: percent-of, percent change, discount, "what percent". */
function genPercentages(count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const kind = rndInt(0, 3);
    if (kind === 0) {
      const pct = [5, 10, 15, 20, 25, 40, 50, 75][rndInt(0, 7)];
      const base = [40, 60, 80, 120, 200, 240][rndInt(0, 5)];
      const c = fmtDec((pct / 100) * base);
      out.push({
        text: `What is ${pct}% of ${base}?`,
        category: 'Percentages',
        correct: c,
        distractors: [fmtDec(Number(c) + pct), String(pct), fmtDec(base - Number(c))],
        solution: `${pct}% of ${base} = (${pct} / 100) × ${base} = ${c}`,
      });
    } else if (kind === 1) {
      const from = [20, 25, 40, 50, 80, 100][rndInt(0, 5)];
      const delta = [5, 10, 20, 25][rndInt(0, 3)];
      const c = fmtDec((delta / from) * 100);
      out.push({
        text: `A dosage increases from ${from} mg to ${from + delta} mg. What is the percent increase?`,
        category: 'Percentages',
        correct: c,
        distractors: [String(delta), fmtDec(Number(c) + 5), fmtDec(100 - Number(c))],
        solution: `Percent increase = (increase / original) × 100 = (${delta} / ${from}) × 100 = ${c}%`,
      });
    } else if (kind === 2) {
      const price = [40, 60, 80, 120, 200][rndInt(0, 4)];
      const pct = [10, 20, 25, 50][rndInt(0, 3)];
      const c = fmtDec(price - (pct / 100) * price);
      out.push({
        text: `An item costs $${price} and is discounted ${pct}%. What is the sale price?`,
        category: 'Percentages',
        correct: c,
        distractors: [fmtDec((pct / 100) * price), fmtDec(Number(c) - pct), String(price)],
        solution: `Discount = ${pct}% of $${price} = $${fmtDec((pct / 100) * price)}. Sale price = $${price} − $${fmtDec((pct / 100) * price)} = $${c}`,
      });
    } else {
      const part = [3, 5, 6, 9, 12, 15][rndInt(0, 5)];
      const total = [15, 20, 25, 30, 50, 60][rndInt(0, 5)];
      const c = fmtDec((part / total) * 100);
      out.push({
        text: `${part} out of ${total} patients completed the survey. What percent is that?`,
        category: 'Percentages',
        correct: c,
        distractors: [fmtDec(Number(c) + 10), String(total - part), fmtDec(100 - Number(c))],
        solution: `Percent = (part / total) × 100 = (${part} / ${total}) × 100 = ${c}%`,
      });
    }
  }
  return out;
}

/** Data interpretation: read a short list of vitals and answer. */
function genDataInterpretation(count) {
  const out = [];
  const letters = ['A', 'B', 'C', 'D'];
  const fmt1 = (t) => (Number.isInteger(t) ? String(t) : t.toFixed(1));
  for (let n = 0; n < count; n++) {
    const kind = rndInt(0, 3);
    if (kind === 0) {
      // Highest / lowest heart rate
      const vals = [];
      const used = new Set();
      while (vals.length < 4) {
        const v = rndInt(60, 90);
        if (!used.has(v)) { used.add(v); vals.push(v); }
      }
      const highest = rndInt(0, 1) === 0;
      const target = highest ? Math.max(...vals) : Math.min(...vals);
      const correct = letters[vals.indexOf(target)];
      out.push({
        text: `Heart rates (bpm): ${vals.map((v, i) => `Patient ${letters[i]}: ${v}`).join(', ')}. Which patient has the ${highest ? 'highest' : 'lowest'} heart rate?`,
        category: 'Word problems and Data interpretation',
        correct,
        distractors: letters.filter((l) => l !== correct),
        solution: `Compare the readings: ${vals.map((v, i) => `Patient ${letters[i]} = ${v} bpm`).join(', ')}. The ${highest ? 'highest' : 'lowest'} reading is ${target} bpm (Patient ${correct}).`,
      });
    } else if (kind === 1) {
      // Total IV intake for 4 patients
      const vals = [];
      for (let i = 0; i < 4; i++) vals.push(rndInt(2, 9) * 10);
      const sum = vals.reduce((s, v) => s + v, 0);
      out.push({
        text: `IV intake (mL): ${vals.map((v, i) => `Patient ${letters[i]}: ${v}`).join(', ')}. What is the total intake for all four patients?`,
        category: 'Word problems and Data interpretation',
        correct: String(sum),
        distractors: [String(sum / 2), String(sum + 10), String(sum - 10)],
        solution: `Add the four readings: ${vals.join(' + ')} = ${sum} mL`,
      });
    } else if (kind === 2) {
      // Difference between highest and lowest systolic BP
      const vals = [];
      const used = new Set();
      while (vals.length < 4) {
        const v = rndInt(95, 150);
        if (!used.has(v)) { used.add(v); vals.push(v); }
      }
      const diff = Math.max(...vals) - Math.min(...vals);
      out.push({
        text: `Systolic BP (mmHg): ${vals.map((v, i) => `Patient ${letters[i]}: ${v}`).join(', ')}. What is the difference between the highest and lowest reading?`,
        category: 'Word problems and Data interpretation',
        correct: String(diff),
        distractors: [String(Math.max(...vals) + Math.min(...vals)), String(diff + 10), String(diff + 5)],
        solution: `Highest = ${Math.max(...vals)} mmHg, lowest = ${Math.min(...vals)} mmHg. Difference = ${Math.max(...vals)} − ${Math.min(...vals)} = ${diff} mmHg`,
      });
    } else {
      // How many temperatures above a threshold
      const temps = [];
      const used = new Set();
      while (temps.length < 4) {
        const v = rndInt(970, 1010) / 10;
        if (!used.has(v)) { used.add(v); temps.push(v); }
      }
      const threshold = rndInt(980, 1000) / 10;
      const above = temps.filter((t) => t > threshold).length;
      out.push({
        text: `Temperatures (°F): ${temps.map((t, i) => `Patient ${letters[i]}: ${fmt1(t)}`).join(', ')}. How many patients have a temperature above ${fmt1(threshold)} °F?`,
        category: 'Word problems and Data interpretation',
        correct: String(above),
        distractors: [String(above + 1), String(Math.max(0, above - 1)), String(4 - above)].filter((v) => v !== String(above)),
        solution: `Count readings above ${fmt1(threshold)} °F: ${temps.filter((t) => t > threshold).map((t, i) => `Patient ${letters[temps.indexOf(t)]} (${fmt1(t)} °F)`).join(', ') || 'none'} → ${above} patient(s)`,
      });
    }
  }
  return out;
}

/** Fractions: mix of fraction operations and simplification. */
function genFractions(count) {
  const half = Math.ceil(count / 2);
  return [...genFractionOperations(half), ...genSimplifyFractions(count - half)];
}

/** Word problems and data interpretation: fraction word problems + table reading. */
function genWordProblems(count) {
  const half = Math.ceil(count / 2);
  return [...genFractionWordProblems(half), ...genDataInterpretation(count - half)];
}

// ---------------------------------------------------------------------------
// READING — passage-based comprehension (Kaplan: 22 questions, 45 min).
// Per kaplan-entrance-exam-sections.txt and Awesome_vault/Plan/
// Reading-Section-Questions-Guidelines.txt: passages are 3-4 numbered
// paragraphs long with several questions per passage, on science, nature,
// and history topics — not nursing/medical subjects. Question stems follow
// the vault guidelines: main idea (whole passage), organization, details,
// inferences (implied meaning, vocabulary-in-context, predicting outcomes),
// purpose (author purpose, audience, purpose of a paragraph), and logic
// (best title, paragraph relationships, strengthening). Each passage carries
// one question per skill; the passage is emitted once per question as a
// separate `passage` field and rendered as one block (with numbered
// paragraphs) followed by its questions.
// ---------------------------------------------------------------------------

const READING_PASSAGES = [
  {
    title: 'The Erie Canal',
    text: 'In the early 1800s, hauling goods across the Appalachian Mountains was slow and costly. Farmers in western New York could barely sell their crops because transportation consumed most of the profit. The state decided that a canal linking the Hudson River to Lake Erie could change that.\n\nConstruction began in 1817 and took eight years. Thousands of laborers, many of them Irish immigrants, dug the 363-mile waterway by hand. When the canal opened in 1825, the cost of shipping a ton of goods from Buffalo to New York City dropped from about $100 to under $10.\n\nThe canal transformed the region almost overnight. Villages along its route grew into busy cities, and New York City became the nation\u2019s leading port. Within a decade, tolls had repaid the entire cost of construction.\n\nThe canal\u2019s success inspired a wave of canal building across the country. Although railroads later made canals less important, the Erie Canal had already changed how Americans moved people and goods.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'The Erie Canal was a costly project that paid off by making transportation faster and cheaper and by transforming the region.',
        distractors: ['The Erie Canal was the first waterway ever built in the United States.', 'Irish immigrants refused to work on the canal because of the pay.', 'Railroads made the canal unnecessary before it was even finished.'],
        solution: 'The passage traces the canal from its costly construction to its success, showing how it repaid its cost and transformed the region.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, how long did construction of the Erie Canal take?',
        correct: 'Eight years',
        distractors: ['Four years', 'Ten years', 'Twenty years'],
        solution: 'Paragraph 2 states that construction began in 1817 and took eight years.',
      },
      {
        skill: 'inference',
        text: 'Based on the passage, what would most likely happen if the canal had not been built?',
        correct: 'Shipping goods from Buffalo to New York City would have remained slow and costly.',
        distractors: ['New York City would have become the leading port even sooner.', 'Farmers in western New York would have sold more crops.', 'Railroads would never have been invented.'],
        solution: 'The passage says the canal made shipping cheaper and faster and helped the region grow, so without it transportation would have stayed slow and costly.',
      },
      {
        skill: 'purpose',
        text: 'What is the author\u2019s main purpose in writing this passage?',
        correct: 'to explain how the Erie Canal was built and why it mattered',
        distractors: ['to persuade readers to visit New York State', 'to criticize the workers who built the canal', 'to compare the canal with modern railroads'],
        solution: 'The passage tells the story of the canal\u2019s construction and its effects, so its purpose is to explain and inform.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s attitude toward the Erie Canal is best described as —',
        correct: 'appreciative of its historical importance',
        distractors: ['dismissive of the laborers who built it', 'angry about the cost of the project', 'completely uninterested in its legacy'],
        solution: 'The passage emphasizes the canal\u2019s success and lasting influence, showing appreciation rather than criticism.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'problem and solution',
        distractors: ['compare and contrast', 'chronological order', 'general to specific'],
        solution: 'The passage identifies the problem of costly transportation, presents the canal as the solution, and then describes the results.',
      },
      {
        skill: 'logic',
        text: 'Which title best fits this passage?',
        correct: 'A Canal That Changed a Nation',
        distractors: ['How to Build a Canal in Eight Years', 'The Life of an Irish Immigrant', 'Why Railroads Replaced Canals'],
        solution: 'The passage is about the canal\u2019s construction and its broad effects, so a title that highlights its national impact fits best.',
      },
    ],
  },
  {
    title: 'The Northern Lights',
    text: 'On clear nights near the poles, the sky sometimes glows with shifting curtains of green, red, and violet light. These displays, called auroras, have fascinated people for centuries and inspired countless myths.\n\nScientists now understand what causes them. The sun constantly releases a stream of charged particles. When these particles reach Earth, most are deflected by the planet\u2019s magnetic field, but some are channeled toward the poles, where they collide with gases in the upper atmosphere and make them glow.\n\nThe color of an aurora depends on which gas is struck. Oxygen produces green and red light, while nitrogen produces blue and purple. Green is the most common color because oxygen is plentiful high in the atmosphere.\n\nAuroras are more frequent during periods of intense solar activity, which follows an eleven-year cycle. In unusually strong displays, the lights can be seen far from the poles, surprising people in places where auroras are rare.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Auroras are colorful sky displays caused by charged particles from the sun colliding with gases in the upper atmosphere.',
        distractors: ['Auroras are caused by pollution in the atmosphere.', 'Auroras can only be seen once every eleven years.', 'Scientists know nothing about what causes auroras.'],
        solution: 'The passage explains what auroras are and the scientific reason behind them, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, what produces the green color in an aurora?',
        correct: 'Oxygen high in the atmosphere',
        distractors: ['Nitrogen', 'The moon', 'Clouds of dust'],
        solution: 'Paragraph 3 says oxygen produces green and red light.',
      },
      {
        skill: 'inference',
        text: 'As used in paragraph 2, the word \u201cchanneled\u201d most nearly means —',
        correct: 'directed',
        distractors: ['blocked', 'created', 'weakened'],
        solution: 'The passage says the particles are \u201cchanneled toward the poles,\u201d meaning they are directed there by the magnetic field.',
      },
      {
        skill: 'purpose',
        text: 'Why does the author include paragraph 3?',
        correct: 'To explain why auroras show different colors',
        distractors: ['To describe how to photograph an aurora', 'To warn about the dangers of solar activity', 'To compare oxygen with nitrogen'],
        solution: 'Paragraph 3 explains that the color depends on which gas is struck, so its purpose is to explain the colors.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'informative and objective',
        distractors: ['frightening and alarming', 'playful and silly', 'angry and critical'],
        solution: 'The author presents facts about auroras without emotion or opinion, so the tone is informative and objective.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'general to specific',
        distractors: ['chronological order', 'compare and contrast', 'problem and solution'],
        solution: 'The passage starts with a general description of auroras and then narrows to their causes, colors, and frequency.',
      },
      {
        skill: 'logic',
        text: 'How does paragraph 4 relate to paragraph 2?',
        correct: 'It extends the explanation by describing when auroras are most frequent.',
        distractors: ['It contradicts the claim that particles cause auroras.', 'It describes a different kind of light display.', 'It argues that auroras are dangerous.'],
        solution: 'Paragraph 2 explains how auroras form; paragraph 4 adds information about how often they occur, so it extends that explanation.',
      },
    ],
  },
  {
    title: 'The Pony Express',
    text: 'In 1860, sending a letter from Missouri to California took weeks by stagecoach or ship. The Pony Express was a bold attempt to deliver mail much faster: relays of riders on horseback would carry letters across nearly 2,000 miles in about ten days.\n\nThe service depended on hundreds of relay stations spaced about ten miles apart. A rider would gallop into a station, switch to a fresh horse, and continue. Riders were mostly young men, some barely teenagers, chosen for their light weight and riding skill.\n\nThe Pony Express was fast, but it was never profitable. Postage was high, and the service lost money from the start. It lasted only about eighteen months before the completion of the transcontinental telegraph made it obsolete.\n\nAlthough short-lived, the Pony Express became a lasting symbol of the American West. Its riders and their daring journeys are remembered in books, movies, and folklore far more than their business records would ever suggest.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'The Pony Express delivered mail faster than ever before, but it lasted only about eighteen months.',
        distractors: ['The Pony Express made its owners rich.', 'Riders delivered mail only within California.', 'The transcontinental telegraph was slower than the Pony Express.'],
        solution: 'The passage describes the service, its speed, and its brief life, which together form the main point.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, about how far apart were the relay stations?',
        correct: 'Ten miles',
        distractors: ['Two miles', 'Fifty miles', 'One hundred miles'],
        solution: 'Paragraph 2 says the stations were spaced about ten miles apart.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that riders changed horses at each station because —',
        correct: 'a single horse could not keep up the pace for the whole route',
        distractors: ['riders were paid for every horse they used', 'stations were used only once', 'horses could not cross the telegraph lines'],
        solution: 'Fresh horses at frequent stations allowed riders to keep moving at speed over a route far too long for one horse.',
      },
      {
        skill: 'purpose',
        text: 'This passage was most likely written for —',
        correct: 'general readers interested in American history',
        distractors: ['people planning to ride the route today', 'investors deciding whether to fund a delivery service', 'trainers of young riders'],
        solution: 'The passage tells the story of a historical service in plain terms, so it is aimed at general readers.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s view of the Pony Express\u2019s fame is best described as —',
        correct: 'mildly surprised that it is remembered so fondly',
        distractors: ['certain that its fame is fully deserved', 'annoyed that it is overrated', 'uninterested in its legacy'],
        solution: 'The final paragraph says the fame grew \u201cfar more than their business records would ever suggest,\u201d which conveys mild surprise.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'chronological order',
        distractors: ['compare and contrast', 'problem and solution', 'general to specific'],
        solution: 'The passage follows the service from its start in 1860 through its operation and end, so it is organized chronologically.',
      },
      {
        skill: 'logic',
        text: 'Which statement, if true, would most strengthen the author\u2019s point that the Pony Express became a lasting symbol?',
        correct: 'Hundreds of books and films have been made about the riders.',
        distractors: ['The telegraph required wires and operators.', 'Riders were paid in gold coins.', 'Most station managers were women.'],
        solution: 'The author says the service is remembered in books, movies, and folklore; evidence of many books and films directly supports that claim.',
      },
    ],
  },
  {
    title: 'The Disappearing Honeybees',
    text: 'Honeybees pollinate billions of dollars\u2019 worth of crops each year, from apples and almonds to cucumbers and blueberries. Without them, many fruits and vegetables would become scarce and expensive.\n\nIn recent decades, beekeepers have reported losing unusually large numbers of colonies, a phenomenon known as colony collapse disorder. Researchers have identified several likely causes: pesticides that weaken bees\u2019 immune systems, parasites such as the varroa mite, and the loss of wildflower habitat to development.\n\nThese causes often act together. A hive weakened by mites may be unable to survive exposure to a pesticide, while a bee that cannot find enough diverse flowers becomes malnourished and more vulnerable.\n\nThe consequences reach beyond the hive. Farmers in some regions now rent hives to ensure their crops are pollinated, and the price of those rentals has climbed. Scientists continue to study the problem, hoping that changes in farming practices can slow the decline.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Honeybees are essential to food production, and a combination of factors is causing their numbers to decline.',
        distractors: ['Honeybees are the only insects that pollinate crops.', 'Colony collapse disorder has no known causes.', 'Beekeeping has become much easier in recent years.'],
        solution: 'The passage explains why honeybees matter and describes the causes and effects of their decline, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, which of the following is a cause of colony collapse disorder?',
        correct: 'Pesticides that weaken bees\u2019 immune systems',
        distractors: ['The invention of the automobile', 'An increase in the number of beekeepers', 'A rise in the price of almonds'],
        solution: 'Paragraph 2 names pesticides, parasites such as the varroa mite, and loss of wildflower habitat as causes.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that a hive weakened by mites is more likely to suffer pesticide damage because —',
        correct: 'weakened bees are less able to withstand additional threats',
        distractors: ['mites are killed by most pesticides', 'pesticides attract more mites', 'beekeepers cannot see mites at all'],
        solution: 'The passage says a hive weakened by mites may be unable to survive exposure to a pesticide, so weakened bees are more vulnerable.',
      },
      {
        skill: 'purpose',
        text: 'What is the author\u2019s main purpose in writing this passage?',
        correct: 'to explain why honeybee colonies are declining and why it matters',
        distractors: ['to teach readers how to keep bees', 'to argue that all pesticides should be banned immediately', 'to describe the life cycle of the varroa mite'],
        solution: 'The passage presents the causes of the decline and its effects on food production, so its purpose is to explain the problem.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'concerned and informative',
        distractors: ['amused and lighthearted', 'angry at consumers', 'certain that bees will disappear'],
        solution: 'The author presents the problem seriously and notes ongoing efforts to address it, so the tone is concerned and informative.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'cause and effect',
        distractors: ['chronological order', 'compare and contrast', 'a sequence of manufacturing steps'],
        solution: 'The passage presents the causes of colony collapse and then their effects on farms and food prices.',
      },
      {
        skill: 'logic',
        text: 'Which title best fits this passage?',
        correct: 'Trouble in the Hive: Why Honeybees Are Declining',
        distractors: ['How to Start a Beekeeping Business', 'The Many Uses of Honey', 'A History of the Varroa Mite'],
        solution: 'The passage focuses on why honeybee colonies are declining, so a title about trouble in the hive fits best.',
      },
    ],
  },
  {
    title: 'How Blue Jeans Are Made',
    text: 'The blue jeans people wear today begin as cotton, which is cleaned, combed, and spun into yarn. The yarn is then woven into denim, a sturdy fabric with a diagonal ribbed pattern.\n\nThe fabric\u2019s blue color comes from indigo dye. In modern factories, the yarn is dipped in synthetic indigo and exposed to air, which makes the dye turn blue through oxidation. Only the outer threads are dyed, which is why jeans fade over time to reveal white threads underneath.\n\nAfter dyeing, the denim is cut into pattern pieces and sewn together. Rivets are added at stress points such as pockets to keep them from tearing. Finally, the finished jeans may be washed, stonewashed, or otherwise treated to achieve a particular look.\n\nThe entire process, from raw cotton to finished garment, involves many workers and machines, but the essential steps have changed little since jeans were first popularized more than a century ago.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Making blue jeans involves a series of steps from raw cotton to finished garment.',
        distractors: ['Blue jeans are always dyed black.', 'Denim is woven only by hand.', 'Jeans never fade no matter how they are washed.'],
        solution: 'The passage walks through each stage of jeans production, from cotton to the finished product.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, why are rivets added to jeans?',
        correct: 'To keep pockets from tearing at stress points',
        distractors: ['To make the jeans heavier', 'To help the dye set', 'To allow the fabric to stretch'],
        solution: 'Paragraph 3 says rivets are added at stress points such as pockets to keep them from tearing.',
      },
      {
        skill: 'inference',
        text: 'As used in paragraph 2, the word \u201coxidation\u201d most nearly means —',
        correct: 'the process of combining with oxygen',
        distractors: ['the removal of all color', 'a method of stitching fabric', 'the stretching of yarn'],
        solution: 'The passage says the yarn is exposed to air, which makes the dye turn blue through oxidation, so the word refers to the dye reacting with oxygen in the air.',
      },
      {
        skill: 'purpose',
        text: 'This passage was most likely written for —',
        correct: 'readers who want to understand how jeans are manufactured',
        distractors: ['buyers comparing prices of jeans', 'workers being trained to cut denim', 'scientists studying indigo dye'],
        solution: 'The passage explains the production process in general terms, so it is written for curious general readers.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'factual and straightforward',
        distractors: ['sarcastic and mocking', 'mysterious and dramatic', 'emotional and pleading'],
        solution: 'The passage describes the steps plainly, without opinion or exaggeration, so the tone is factual and straightforward.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'a sequence of steps in a process',
        distractors: ['compare and contrast', 'problem and solution', 'chronological history of a company'],
        solution: 'The passage follows the manufacturing steps from cotton to finished jeans in order.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would best conclude the passage?',
        correct: 'Newer factories are also experimenting with methods that use less water and energy.',
        distractors: ['Cotton grows best in warm climates.', 'Denim fabric was invented in France.', 'Most jeans are sold in department stores.'],
        solution: 'The final paragraph notes that the steps have changed little over a century, so a sentence about modern factory improvements follows naturally.',
      },
    ],
  },
  {
    title: 'Mars and Earth: Close Cousins',
    text: 'Mars and Earth are neighbors in the solar system and share several features. Both are rocky planets with similar day lengths, and both have polar ice caps, seasons, and volcanoes.\n\nThe differences, however, are dramatic. Earth\u2019s atmosphere is thick and rich in oxygen, while Mars has a thin atmosphere made mostly of carbon dioxide. Average temperatures on Mars are far colder, and its surface pressure is so low that liquid water cannot persist on the surface.\n\nEvidence suggests that Mars was once much warmer and wetter. River valleys and lakebeds, now dry, hint at a time when water flowed across the planet. Scientists study these ancient landscapes to understand what changed and whether life could ever have existed there.\n\nFor these reasons, Mars is the focus of many space missions. Rovers and orbiters have mapped its surface, tested its soil, and searched for signs of past water. Each mission brings scientists closer to answering whether the red planet was ever habitable.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Mars and Earth share some features but differ greatly, and scientists study Mars to learn about its past.',
        distractors: ['Mars has an atmosphere identical to Earth\u2019s.', 'Scientists have found living things on Mars.', 'Mars and Earth have nothing in common.'],
        solution: 'The passage covers both the similarities and differences between the planets and explains why Mars is studied.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, which feature do Mars and Earth share?',
        correct: 'Polar ice caps and seasons',
        distractors: ['Thick, oxygen-rich atmospheres', 'Liquid water on the surface', 'Identical average temperatures'],
        solution: 'Paragraph 1 lists polar ice caps, seasons, and volcanoes as features shared by both planets.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that liquid water cannot persist on the surface of Mars today because —',
        correct: 'the surface pressure is too low',
        distractors: ['the planet receives no sunlight', 'rovers removed all the water', 'volcanoes dried the planet out'],
        solution: 'Paragraph 2 says surface pressure is so low that liquid water cannot persist.',
      },
      {
        skill: 'purpose',
        text: 'What is the author\u2019s main purpose in writing this passage?',
        correct: 'to compare Earth and Mars and explain why Mars interests scientists',
        distractors: ['to argue that Mars should be left unexplored', 'to describe the moons of Mars', 'to explain how to build a spaceship'],
        solution: 'The passage moves from shared features to differences and then to why scientists study Mars, so its purpose is to compare and explain.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s attitude toward Mars exploration is best described as —',
        correct: 'supportive and curious',
        distractors: ['opposed and dismissive', 'fearful and anxious', 'bored and indifferent'],
        solution: 'The final paragraph presents missions positively, noting each brings scientists closer to answers, so the attitude is supportive and curious.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'compare and contrast',
        distractors: ['chronological order', 'problem and solution', 'a sequence of steps'],
        solution: 'The passage moves from the features Mars and Earth share to the ways they differ, a compare-and-contrast structure.',
      },
      {
        skill: 'logic',
        text: 'Which statement, if true, would most strengthen the author\u2019s point about studying Mars?',
        correct: 'A recent rover discovered minerals that form only in the presence of liquid water.',
        distractors: ['The moon is closer to Earth than Mars is.', 'Mars has two small moons, Phobos and Deimos.', 'Space suits are very expensive to make.'],
        solution: 'Evidence of past liquid water supports the passage\u2019s claim that Mars was once wetter and is worth studying.',
      },
    ],
  },
  {
    title: 'The Great Chicago Fire',
    text: 'On the evening of October 8, 1871, a fire broke out in a small barn on the southwest side of Chicago. The city had enjoyed a dry summer, and most buildings were made of wood, so the flames found plenty of fuel.\n\nStrong winds pushed the fire north and east, and it quickly jumped the Chicago River. Firefighters struggled with limited equipment, and the blaze burned out of control for nearly two days.\n\nWhen the fire finally died out, about 17,000 buildings lay in ruins. Roughly 100,000 people, a third of the city\u2019s population, were left homeless, and around 300 people had lost their lives.\n\nThe city chose to rebuild rather than abandon the site. New laws required stone and brick construction, wider streets, and better water systems. Within a few years, Chicago had risen again, stronger and safer than before.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'A devastating fire destroyed much of Chicago, and the city rebuilt itself with safer construction.',
        distractors: ['Chicago was the first city in the United States to have fire engines.', 'The fire began because of a factory accident.', 'Chicago was abandoned after the fire and never recovered.'],
        solution: 'The passage describes the fire and then explains how the city rebuilt, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, about how many buildings were destroyed by the fire?',
        correct: '17,000',
        distractors: ['300', '2,000', '100,000'],
        solution: 'Paragraph 3 states that about 17,000 buildings lay in ruins.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that the fire spread so quickly partly because —',
        correct: 'the buildings were mostly made of wood',
        distractors: ['the firefighters refused to work', 'the river carried the flames', 'the city had no streets'],
        solution: 'Paragraph 1 notes that most buildings were made of wood after a dry summer, which gave the flames plenty of fuel.',
      },
      {
        skill: 'purpose',
        text: 'Why does the author include paragraph 4?',
        correct: 'To explain how Chicago recovered from the fire',
        distractors: ['To criticize the city\u2019s leaders', 'To describe the fire\u2019s start', 'To list the names of the firefighters'],
        solution: 'Paragraph 4 tells how the city rebuilt with safer materials, so its purpose is to explain the recovery.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s attitude toward Chicago\u2019s rebuilding is best described as —',
        correct: 'admiring of the city\u2019s determination',
        distractors: ['doubtful that it really happened', 'uninterested in the city\u2019s future', 'angry that the city was rebuilt'],
        solution: 'The final paragraph says the city \u201crose again, stronger and safer than before,\u201d which shows admiration for its determination.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'chronological order',
        distractors: ['compare and contrast', 'cause and effect', 'problem and solution'],
        solution: 'The passage follows the fire from its start through the aftermath and rebuilding, so it is organized chronologically.',
      },
      {
        skill: 'logic',
        text: 'How does paragraph 2 relate to paragraph 1?',
        correct: 'It continues the account of the fire\u2019s spread',
        distractors: ['It contradicts the claim that the fire was large.', 'It describes how the city was rebuilt.', 'It lists the causes of the dry summer.'],
        solution: 'Paragraph 1 describes the fire\u2019s start; paragraph 2 continues the story of how it spread across the city.',
      },
    ],
  },
  {
    title: 'Tide Pools',
    text: 'Along rocky coasts, the ocean leaves behind small pools of seawater when the tide goes out. These tide pools are miniature worlds that change with every tide.\n\nA single pool may hold sea stars, anemones, hermit crabs, and tiny fish. Each creature is adapted to survive the pool\u2019s changing conditions, from hot sun at low tide to crashing waves at high tide.\n\nLife in a tide pool is connected. Anemones sting drifting prey, crabs scavenge scraps, and small fish feed on even smaller creatures. When one animal disappears, the whole pool feels the effect.\n\nVisitors can learn a great deal by watching a tide pool, but the pools are fragile. Turning over rocks or lifting animals out can harm them, so the best rule is to look with your eyes and leave everything in place.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Tide pools are small, fragile habitats full of creatures adapted to changing conditions.',
        distractors: ['Tide pools are found only in warm oceans.', 'Sea stars are the only animals that live in tide pools.', 'Tide pools never change from one day to the next.'],
        solution: 'The passage describes what tide pools are, what lives in them, and why they need protection, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, what happens when the tide goes out?',
        correct: 'Small pools of seawater are left behind',
        distractors: ['The pools fill with fresh water', 'All the animals leave the coast', 'The water becomes too hot for any life'],
        solution: 'Paragraph 1 says the ocean leaves behind small pools of seawater when the tide goes out.',
      },
      {
        skill: 'inference',
        text: 'As used in paragraph 2, the word \u201cadapted\u201d most nearly means —',
        correct: 'suited to the conditions',
        distractors: ['unable to survive', 'collected by visitors', 'newly discovered'],
        solution: 'The passage says each creature is \u201cadapted to survive the pool\u2019s changing conditions,\u201d meaning it is suited to them.',
      },
      {
        skill: 'purpose',
        text: 'What is the author\u2019s main purpose in writing this passage?',
        correct: 'to describe tide pools and explain how to protect them',
        distractors: ['to persuade readers to collect sea animals', 'to tell the history of a particular coast', 'to compare oceans around the world'],
        solution: 'The passage explains what tide pools contain and ends with advice on protecting them, so its purpose is to describe and inform.',
      },
      {
        skill: 'pov',
        text: 'The author would most likely describe careless visitors to tide pools as —',
        correct: 'harmful to a fragile environment',
        distractors: ['helpful to the animals', 'unimportant to the pool', 'the best teachers of ocean life'],
        solution: 'Paragraph 4 warns that turning over rocks and lifting animals out can harm the pools, so the author would see careless visitors as harmful.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'problem and solution',
        distractors: ['compare and contrast', 'chronological order', 'cause and effect'],
        solution: 'The passage describes the fragile tide-pool habitat and then presents the problem of visitor harm and the solution of looking without touching.',
      },
      {
        skill: 'logic',
        text: 'Which title best fits this passage?',
        correct: 'A Closer Look at Tide Pools',
        distractors: ['The Largest Fish in the Ocean', 'How to Build a Sandcastle', 'A History of Coastal Farming'],
        solution: 'The passage is an introduction to tide pools and their inhabitants, so a title about looking closely at tide pools fits best.',
      },
    ],
  },
  {
    title: 'The Silk Road',
    text: 'More than two thousand years ago, a network of routes linked China with the Mediterranean Sea. This network of routes is known as the Silk Road. Traders carried goods across deserts and mountains for thousands of miles.\n\nSilk from China was the most famous cargo, but merchants also traded spices, glass, wool, and horses. Cities along the routes grew wealthy by taxing the passing caravans.\n\nIdeas traveled with the goods. Papermaking, gunpowder, and new religions spread from one civilization to another, and travelers exchanged knowledge of astronomy, farming, and engineering.\n\nWhen faster sea routes opened, the Silk Road gradually lost its importance. Yet its legacy lasted: for centuries it had connected distant peoples and shaped the cultures it touched.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'The Silk Road was a network of trade routes that carried goods and ideas between distant civilizations.',
        distractors: ['The Silk Road was a single paved highway built by one empire.', 'The Silk Road carried only silk and nothing else.', 'The Silk Road was destroyed in a single battle.'],
        solution: 'The passage describes what the Silk Road was, what it carried, and its legacy, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, what was the most famous cargo carried on the Silk Road?',
        correct: 'Silk from China',
        distractors: ['Wool from the Mediterranean', 'Horses from Japan', 'Spices from the Americas'],
        solution: 'Paragraph 2 says silk from China was the most famous cargo.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that cities along the routes grew wealthy because —',
        correct: 'they collected taxes from passing merchants',
        distractors: ['they produced all the silk themselves', 'they blocked the routes from outsiders', 'they mined gold in the mountains'],
        solution: 'Paragraph 2 says cities grew wealthy by taxing the passing caravans.',
      },
      {
        skill: 'purpose',
        text: 'What is the author\u2019s main purpose in writing this passage?',
        correct: 'to explain what the Silk Road was and why it mattered',
        distractors: ['to persuade readers to travel to China', 'to teach readers how silk is woven', 'to argue that sea routes were a mistake'],
        solution: 'The passage explains the routes, the goods and ideas they carried, and their lasting influence, so its purpose is to explain.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s attitude toward the Silk Road\u2019s legacy is best described as —',
        correct: 'appreciative of its lasting influence',
        distractors: ['dismissive of its importance', 'uncertain that it ever existed', 'critical of the merchants who used it'],
        solution: 'The final paragraph calls its legacy lasting and says it shaped the cultures it touched, which shows appreciation.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'chronological order',
        distractors: ['compare and contrast', 'cause and effect', 'problem and solution'],
        solution: 'The passage moves from the routes\u2019 early importance to their later decline, so it is organized chronologically.',
      },
      {
        skill: 'logic',
        text: 'How does paragraph 3 relate to paragraph 2?',
        correct: 'It extends the discussion from goods to the ideas that traveled with them',
        distractors: ['It contradicts the claim that the routes existed', 'It describes the fall of the Silk Road', 'It lists the prices of traded goods'],
        solution: 'Paragraph 2 is about the goods traded; paragraph 3 adds the ideas and knowledge that spread along the same routes, extending the point.',
      },
    ],
  },
  {
    title: 'Glaciers: Rivers of Ice',
    text: 'Glaciers are massive bodies of ice that form where snow falls faster than it melts. Over many years, the weight of new snow compresses older snow into dense ice, and the glacier begins to flow slowly downhill like a frozen river.\n\nMoving glaciers reshape the land. They carve deep U-shaped valleys, scrape soil from mountainsides, and leave behind ridges of rock called moraines when they melt.\n\nGlaciers also supply fresh water. In many mountain regions, rivers fed by melting glaciers provide water for farms and cities through the summer. When a glacier shrinks, those communities may face shortages.\n\nToday most of the world\u2019s glaciers are retreating as the climate warms. Scientists monitor their size each year because glaciers are sensitive records of climate change, and their meltwater flows into the oceans, raising sea levels.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which of the following BEST expresses the main idea of the passage?',
        correct: 'Glaciers are slow-moving masses of ice that shape the land, supply fresh water, and are now retreating as the climate warms.',
        distractors: ['Glaciers are found only at the North Pole.', 'Glaciers have no effect on rivers or the sea.', 'Glaciers form in a single cold night.'],
        solution: 'The passage explains what glaciers are, what they do, and why they are shrinking, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, what is a moraine?',
        correct: 'A ridge of rock left behind by a melting glacier',
        distractors: ['A type of glacier found in valleys', 'A lake formed at the top of a mountain', 'A tool used to measure ice'],
        solution: 'Paragraph 2 says glaciers leave behind ridges of rock called moraines when they melt.',
      },
      {
        skill: 'inference',
        text: 'The passage suggests that communities near shrinking glaciers may face —',
        correct: 'shortages of water in summer',
        distractors: ['more frequent earthquakes', 'warmer winter temperatures', 'a rise in ocean salt levels'],
        solution: 'Paragraph 3 says rivers fed by melting glaciers provide summer water and that communities may face shortages when a glacier shrinks.',
      },
      {
        skill: 'purpose',
        text: 'Why does the author include paragraph 4?',
        correct: 'To explain why scientists study glaciers today',
        distractors: ['To describe how glaciers formed', 'To list the animals that live on ice', 'To argue that glaciers are harmful'],
        solution: 'Paragraph 4 explains that glaciers are retreating and that scientists monitor them as records of climate change, so its purpose is to explain why they matter today.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'informative and concerned',
        distractors: ['excited and playful', 'angry and mocking', 'bored and indifferent'],
        solution: 'The author explains the facts about glaciers and notes the concern of retreating ice and water shortages, so the tone is informative with a note of concern.',
      },
      {
        skill: 'organization',
        text: 'How is this passage primarily organized?',
        correct: 'cause and effect',
        distractors: ['compare and contrast', 'chronological order', 'problem and solution'],
        solution: 'The passage describes glaciers and then explains the effects of warming: retreating ice, water shortages, and rising seas.',
      },
      {
        skill: 'logic',
        text: 'Which title best fits this passage?',
        correct: 'Glaciers: Rivers of Ice on the Move',
        distractors: ['How to Survive a Snowstorm', 'The History of Ocean Travel', 'Why Snow Is White'],
        solution: 'The passage introduces what glaciers are and what they do, so a title about glaciers as moving rivers of ice fits best.',
      },
    ],
  },
];

function genReadingSkill(skill, count) {
  const out = [];
  const pool = READING_PASSAGES.flatMap(p => p.questions.filter(q => q.skill === skill));
  const shuffled = shuffle(pool);
  if (!shuffled.length) return out;
  for (let n = 0; n < count; n++) {
    const q = shuffled[n % shuffled.length];
    const passage = READING_PASSAGES.find(p => p.questions.includes(q));
    out.push({
      text: q.text,
      passage: passage.text, // rendered once per passage group, not repeated per question
      category: 'Reading',
      correct: q.correct,
      distractors: q.distractors,
      solution: q.solution,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// WRITING — passage development, paragraph logic, mechanics
// (Kaplan: 21 questions, 45 min, based on nine short passages).
// Source of truth: Awesome_vault/Plan/Writing-Section-Questions-Guidelines.txt
// and kaplan_writing_question_templates.json. All content uses general-
// interest topics — NOT nursing/medical/healthcare fields. Passages carry
// numbered sentences so questions can reference specific sentence numbers;
// questions are 4-option multiple choice (A-D).
// ---------------------------------------------------------------------------

/**
 * Mechanics of Writing (guidelines §3): subject-verb agreement, verb tense,
 * pronoun-antecedent agreement, comma/apostrophe/capitalization usage,
 * commonly confused words, run-ons & comma splices, fragments, misplaced or
 * dangling modifiers, parallel structure, wordiness, and
 * quotation/colon/semicolon punctuation.
 */
function genWritingMechanics(count) {
  const items = [
    {
      text: 'Which sentence contains an error in subject-verb agreement?',
      correct: 'The list of errands were taped to the refrigerator.',
      distractors: ['The basket of apples was sitting on the porch.', 'A row of tall maple trees lines the driveway.', 'Each of the players has a clean uniform.'],
      solution: 'The subject is \u201cthe list\u201d (singular); \u201cerrands\u201d is inside a prepositional phrase, so the verb must be \u201cwas.\u201d',
    },
    {
      text: 'Which revision best corrects the sentence?\n\nThe box of crayons on the shelf are ready to use.',
      correct: 'The box of crayons on the shelf is ready to use.',
      distractors: ['The boxes of crayons on the shelf is ready to use.', 'The box of crayons on the shelf are ready to use.', 'The box of crayon on the shelf are ready to use.'],
      solution: 'The subject is \u201cthe box\u201d (singular), not \u201ccrayons,\u201d so the verb must be \u201cis.\u201d',
    },
    {
      text: 'Which sentence contains an inconsistent verb tense?',
      correct: 'The bus arrives at 7:15, and we waited on the platform.',
      distractors: ['Every morning, Maya walks to the corner bakery for fresh bread.', 'Yesterday the team practiced drills and then ran laps.', 'Last summer we camped beside the lake every weekend.'],
      solution: 'The verbs in one sentence should agree in tense: either \u201carrives \u2026 wait\u201d or \u201carrived \u2026 waited.\u201d',
    },
    {
      text: 'Which sentence contains an error in pronoun-antecedent agreement?',
      correct: 'Each of the dogs wagged their tail eagerly.',
      distractors: ['Each volunteer brought his or her own water bottle.', 'The committee submitted its report on time.', 'The class wrote its answers in pencil.'],
      solution: '\u201cEach\u201d is singular, so the pronoun must be singular (\u201cits\u201d); \u201ctheir\u201d does not agree with the singular antecedent.',
    },
    {
      text: 'Which sentence is punctuated correctly?',
      correct: 'After the rain stopped, we walked to the park.',
      distractors: ['After the rain stopped we walked to the park.', 'After, the rain stopped we walked to the park.', 'After the rain, stopped we walked to the park.'],
      solution: 'An introductory phrase such as \u201cAfter the rain stopped\u201d is set off from the main clause with a comma.',
    },
    {
      text: 'Which sentence uses the apostrophe correctly?',
      correct: 'The dogs\u2019 leashes hang by the back door.',
      distractors: ['Its time to feed the dogs.', 'The dogs bowl is empty again.', 'The dog\u2019s are barking at the mail carrier.'],
      solution: 'The leashes belong to more than one dog, so the plural possessive \u201cdogs\u2019\u201d is correct; the other options misuse \u201cits/it\u2019s\u201d or add an apostrophe where none belongs.',
    },
    {
      text: 'Which sentence contains a capitalization error?',
      correct: 'We drove to the grand canyon last spring.',
      distractors: ['The mayor spoke at the town hall meeting on Tuesday.', 'My favorite class is American History.', 'The library opens at nine o\u2019clock.'],
      solution: '\u201cGrand Canyon\u201d is a proper noun and must be capitalized.',
    },
    {
      text: 'Which word correctly completes the sentence?\n\nThe long drought began to ___ the crops in the valley.',
      correct: 'affect',
      distractors: ['effect', 'than', 'then'],
      solution: '\u201cAffect\u201d is a verb meaning \u201cto influence\u201d; \u201ceffect\u201d is usually a noun meaning \u201cresult.\u201d',
    },
    {
      text: 'Which word correctly completes the sentence?\n\n___ going to be a cold winter, so the birds have already flown south.',
      correct: 'It\u2019s',
      distractors: ['Its', 'They\u2019re', 'Their'],
      solution: '\u201cIt\u2019s\u201d is the contraction of \u201cit is\u201d; \u201cits\u201d is the possessive form.',
    },
    {
      text: 'Which word correctly completes the sentence?\n\nWe packed more food ___ we could possibly eat on the hike.',
      correct: 'than',
      distractors: ['then', 'their', 'there'],
      solution: '\u201cThan\u201d is used for comparisons; \u201cthen\u201d refers to time.',
    },
    {
      text: 'Which of the following is the best revision of the sentence?\n\nThe museum closed at five the gift shop stayed open until six.',
      correct: 'The museum closed at five; the gift shop stayed open until six.',
      distractors: ['The museum closed at five the gift shop stayed open until six.', 'The museum closed at five, the gift shop stayed open until six.', 'The museum closed at five and, the gift shop stayed open until six.'],
      solution: 'Two complete sentences joined with no punctuation form a run-on; a semicolon separates them correctly.',
    },
    {
      text: 'Which of the following is the best revision of the fragment?\n\nBecause the power went out during the storm.',
      correct: 'Because the power went out during the storm, the basement flooded.',
      distractors: ['Because the power went out during the storm.', 'Because the power went out, during the storm.', 'The power went out during the storm, because.'],
      solution: 'A subordinate clause punctuated as a sentence is a fragment; joining it to a main clause with a comma completes the thought.',
    },
    {
      text: 'Which sentence contains a misplaced or dangling modifier?',
      correct: 'Walking to the bus stop, the rain began to pour.',
      distractors: ['Riding her bike, Priya waved to her neighbor.', 'After stirring the soup, the chef added salt.', 'Sleeping in the sun, the cat stretched lazily.'],
      solution: 'The phrase \u201cWalking to the bus stop\u201d should modify a person, but the subject is \u201cthe rain\u201d; the sentence needs a human subject, e.g., \u201cWalking to the bus stop, Nina felt the first drops of rain.\u201d',
    },
    {
      text: 'Which sentence lacks parallel structure?',
      correct: 'She enjoys hiking, biking, and to swim.',
      distractors: ['The recipe calls for flour, sugar, and eggs.', 'The campers pitched tents, gathered wood, and built a fire.', 'The report was clear, concise, and accurate.'],
      solution: 'Items in a list should take the same form: \u201chiking, biking, and swimming\u201d (all gerunds), not a mix of gerunds and an infinitive.',
    },
    {
      text: 'Which of the following is the most concise and correct revision of the sentence?\n\nThe reason why the game was canceled is because of the heavy rain.',
      correct: 'The game was canceled because of the heavy rain.',
      distractors: ['The reason why the game was canceled is because of the heavy rain.', 'The game was canceled due to the fact that the heavy rain happened.', 'The game, which was canceled, happened because of the heavy rain.'],
      solution: 'The original repeats the idea (\u201cthe reason why \u2026 is because\u201d); the concise version states the cause once.',
    },
    {
      text: 'Which sentence uses the colon correctly?',
      correct: 'The pantry held exactly what we needed: flour, sugar, and vanilla.',
      distractors: ['The pantry held: flour, sugar, and vanilla.', 'The pantry held flour, sugar, and vanilla: for baking.', 'The pantry held flour sugar, and vanilla.'],
      solution: 'A colon introduces a list after a complete sentence (\u201cThe pantry held exactly what we needed\u201d); it should not follow a verb or sit inside a fragment.',
    },
    {
      text: 'Which sentence uses the semicolon correctly?',
      correct: 'The sky cleared by noon; the picnic went on as planned.',
      distractors: ['The sky cleared by noon; the picnic, went on as planned.', 'The sky cleared by noon the picnic; went on as planned.', 'The sky cleared by noon, the picnic went on as planned.'],
      solution: 'A semicolon joins two closely related complete sentences; joining them with only a comma would create a comma splice.',
    },
    {
      text: 'Which sentence uses quotation marks correctly?',
      correct: 'The librarian asked, \u201cHave you returned your books?\u201d',
      distractors: ['The librarian asked, \u201cHave you returned your books\u201d?', 'The librarian asked \u201chave you returned your books?\u201d', '\u201cHave you returned your books\u201d? the librarian asked.'],
      solution: 'A direct question goes inside the quotation marks, and a comma separates the speaker tag from the quote.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  const pick = Math.min(count, items.length); // never repeat a question in one exam
  for (let n = 0; n < pick; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: it.text,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/**
 * Paragraph Logic (guidelines §2): best order of sentences, best transition
 * word/phrase, splitting a paragraph, best concluding sentence, and the
 * purpose/main idea of a paragraph. Sentences are numbered so questions can
 * reference specific sentence numbers.
 */
function genWritingParagraphLogic(count) {
  const items = [
    {
      text: 'Read the sentences:\n\n(1) Shoppers fill the aisles between the stalls.\n(2) Every Saturday morning, the town square becomes a farmers market.\n(3) Local bakers and growers sell their goods there.\n(4) By noon, the fresh bread is usually sold out.\n\nWhich sentence should be FIRST as the topic sentence?',
      correct: 'Every Saturday morning, the town square becomes a farmers market.',
      distractors: ['Shoppers fill the aisles between the stalls.', 'Local bakers and growers sell their goods there.', 'By noon, the fresh bread is usually sold out.'],
      solution: 'The topic sentence introduces the subject (the Saturday farmers market); the other sentences supply details about it.',
    },
    {
      text: 'Read the sentences:\n\n(1) Plastic bottles pile up quickly in most households.\n(2) Recycling them keeps them out of landfills.\n(3) Many towns now collect bottles at curbside.\n(4) A simple rinse prepares a bottle for the bin.\n\nWhich sentence would best conclude the paragraph?',
      correct: 'With a small effort, every household can keep plastic out of the waste stream.',
      distractors: ['Plastic bottles were first used in the 1940s.', 'Some bottles are made of thicker plastic than others.', 'Recycling trucks run on diesel fuel.'],
      solution: 'A concluding sentence wraps up the paragraph\u2019s point about recycling effort; the other options introduce new or unrelated facts.',
    },
    {
      text: 'Read the sentences:\n\n(1) The book club meets on the first Tuesday of every month.\n(2) Members take turns choosing the next title.\n(3) Discussions usually last about an hour.\n(4) The public pool opens in mid-June.\n\nWhich sentence does NOT belong in the paragraph?',
      correct: 'Sentence 4',
      distractors: ['Sentence 1', 'Sentence 2', 'Sentence 3'],
      solution: 'Sentences 1\u20133 all describe the book club; sentence 4 introduces an unrelated topic that breaks the paragraph\u2019s focus.',
    },
    {
      text: 'Read the sentences:\n\n(1) Composting turns kitchen scraps into rich soil.\n(2) First, collect fruit and vegetable peels in a bin.\n(3) Then add dry leaves and stir the pile weekly.\n(4) In a few months, dark crumbly compost is ready for the garden.\n\nWhat is the main purpose of this paragraph?',
      correct: 'To explain the basic process of composting',
      distractors: ['To persuade readers to stop gardening', 'To compare composting with recycling', 'To describe the history of farming'],
      solution: 'The paragraph walks through the steps of making compost, so its purpose is to explain the process.',
    },
    {
      text: 'Read the sentences:\n\n(1) The high school drama club stages three plays a year.\n(2) The spring musical is always the biggest production.\n(3) Auditions are held in January.\n(4) Rehearsals run for eight weeks.\n\nWhere is the best place to add this sentence?\n\n\u201cThe fall show, by contrast, is a smaller one-act play.\u201d',
      correct: 'After sentence 2.',
      distractors: ['Before sentence 1.', 'After sentence 3.', 'Before sentence 4.'],
      solution: 'The new sentence contrasts with the spring musical described in sentence 2, so it belongs immediately after it.',
    },
    {
      text: 'Read the sentences:\n\n(1) The seeds sprout within two weeks.\n(2) First, fill the pots with potting soil.\n(3) Then press two seeds into each pot and water them.\n(4) Finally, move the pots to a sunny windowsill.\n\nWhich of the following is the most logical order for the sentences?',
      correct: '2, 3, 4, 1',
      distractors: ['1, 2, 3, 4', '3, 1, 2, 4', '2, 1, 3, 4'],
      solution: 'The paragraph follows the steps of planting: fill the pots, plant the seeds, move them to the sun, and then the sprouts appear.',
    },
    {
      text: 'Read the sentences:\n\n(1) The town library offers reading programs for children.\n(2) Story time for toddlers happens every Wednesday morning.\n(3) Summer reading clubs reward kids with small prizes.\n(4) For adults, the library hosts book discussions once a month.\n(5) It also runs a popular film series on Friday nights.\n\nWhich is the best way to divide this paragraph into two paragraphs?',
      correct: 'After sentence 3.',
      distractors: ['After sentence 1.', 'After sentence 2.', 'After sentence 4.'],
      solution: 'Sentences 1\u20133 focus on children\u2019s programs and sentences 4\u20135 on adult programs, so the natural split comes after sentence 3.',
    },
    {
      text: 'Read the sentences:\n\n(1) Volunteers clear the trails every spring.\n(2) They repair benches and post new maps.\n(3) Last year the group planted two hundred native trees.\n\nWhich of the following would be the best topic sentence for this paragraph?',
      correct: 'A dedicated team of volunteers keeps the city park in shape.',
      distractors: ['Volunteers must wear sturdy boots at all times.', 'The park was designed by a famous architect.', 'Tree planting is popular in many countries.'],
      solution: 'The topic sentence states the paragraph\u2019s general subject (volunteers caring for the park); the other options are too specific, off-topic, or too broad.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  const pick = Math.min(count, items.length); // never repeat a question in one exam
  for (let n = 0; n < pick; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: it.text,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/** Transitions (guidelines §2): the word that best connects two sentences. */
function genWritingTransitions(count) {
  const items = [
    {
      text: 'The forecast called for sunshine. _____, by noon the sky was full of clouds.\n\nWhich transition word best fills the blank?',
      correct: 'However',
      distractors: ['Therefore', 'For example', 'In addition'],
      solution: 'The second sentence contrasts with the first, so a contrast word such as \u201cHowever\u201d is needed.',
    },
    {
      text: 'The trail was washed out after the flood. _____, the rangers closed the path for the season.\n\nWhich transition word best fills the blank?',
      correct: 'Therefore',
      distractors: ['However', 'Meanwhile', 'For example'],
      solution: 'The second sentence states a result of the first, so a consequence word such as \u201cTherefore\u201d is needed.',
    },
    {
      text: 'The community garden grows tomatoes and peppers. _____, it has a small herb bed near the gate.\n\nWhich transition word best fills the blank?',
      correct: 'In addition',
      distractors: ['However', 'Therefore', 'For example'],
      solution: 'The second sentence adds another detail about the same garden, so an addition phrase such as \u201cIn addition\u201d is needed.',
    },
    {
      text: 'Many local parks offer free summer activities. _____, the lakeside park hosts a concert every Friday.\n\nWhich transition word best fills the blank?',
      correct: 'For example',
      distractors: ['Therefore', 'However', 'In contrast'],
      solution: 'The second sentence gives a specific instance of the first, so \u201cFor example\u201d is needed.',
    },
    {
      text: 'First the dough is kneaded, then it rises for an hour. _____, it is shaped and baked.\n\nWhich transition word best fills the blank?',
      correct: 'Finally',
      distractors: ['However', 'Therefore', 'In addition'],
      solution: 'The sentence marks the last step in a sequence, so \u201cFinally\u201d is needed.',
    },
    {
      text: 'The old bridge could not support heavy trucks. _____, drivers were rerouted through town.\n\nWhich transition word best fills the blank?',
      correct: 'Consequently',
      distractors: ['Nevertheless', 'For example', 'Meanwhile'],
      solution: 'The second sentence gives the outcome of the bridge\u2019s limits, so a result word such as \u201cConsequently\u201d is needed.',
    },
    {
      text: 'Dad painted the fence in the backyard. _____, the kids washed the car in the driveway.\n\nWhich transition word best fills the blank?',
      correct: 'Meanwhile',
      distractors: ['Therefore', 'However', 'For example'],
      solution: 'The two actions happen at the same time, so \u201cMeanwhile\u201d is needed.',
    },
    {
      text: 'The team lost its first three games. _____, the players never gave up hope.\n\nWhich transition word best fills the blank?',
      correct: 'Nevertheless',
      distractors: ['Therefore', 'For example', 'Similarly'],
      solution: 'The second sentence states a surprising contrast to the first, so a concession word such as \u201cNevertheless\u201d is needed.',
    },
    {
      text: 'The blue jays build their nests high in the oak. _____, the crows choose the tops of the pines.\n\nWhich transition word best fills the blank?',
      correct: 'Similarly',
      distractors: ['However', 'Therefore', 'Finally'],
      solution: 'The second sentence makes a comparable point about another bird, so \u201cSimilarly\u201d is needed.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  const pick = Math.min(count, items.length); // never repeat a question in one exam
  for (let n = 0; n < pick; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: it.text,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/**
 * Passage Development (guidelines §1): missing subject, unnecessary or
 * redundant word, best sentence placement, sentence that doesn't belong,
 * best topic sentence, and best supporting detail. Passages carry numbered
 * sentences so questions can reference specific sentence numbers.
 */
function genWritingPassageDevelopment(count) {
  const items = [
    {
      text: 'Which sentence is missing a subject?',
      correct: 'And have a good sense of rhythm and timing.',
      distractors: ['The band practices in the garage on Saturdays.', 'The drummer sets the tempo for the whole group.', 'Their first show is next month at the community center.'],
      solution: 'This group of words has a verb (\u201chave\u201d) but no subject, so it is a fragment missing a subject.',
    },
    {
      text: 'Read the paragraph:\n\n(1) The train that leaves at nine stops at every town.\n(2) The express that runs at ten goes straight to the city.\n(3) We basically decided to take the early train.\n(4) The seats that we chose were near the window.\n\nWhich sentence includes an unnecessary word?',
      correct: 'Sentence 3',
      distractors: ['Sentence 1', 'Sentence 2', 'Sentence 4'],
      solution: 'In sentence 3, \u201cbasically\u201d adds no meaning and can be deleted; the \u201cthat\u201d clauses in the other sentences are necessary.',
    },
    {
      text: 'Read the paragraph:\n\n(1) Regular reading keeps the mind sharp at any age.\n(2) People who read often build a larger vocabulary.\n(3) Stories also help readers understand others\u2019 experiences.\n\nWhich sentence best supports the main idea stated in sentence 1?',
      correct: 'A daily habit of reading has been linked to better memory and focus.',
      distractors: ['Books are printed on paper or read on screens.', 'Libraries lend millions of books each year.', 'Some readers finish a book in a single evening.'],
      solution: 'Sentence 1 claims that reading keeps the mind sharp; the correct option offers concrete evidence for that claim, while the others state unrelated facts.',
    },
    {
      text: 'Read the paragraph:\n\n(1) The community center added several new classes this fall.\n(2) A pottery workshop fills up within days of registration.\n(3) An evening dance workshop draws a steady crowd.\n(4) The staff plans to expand the schedule again in the spring.\n\nWhere is the best place to add this sentence?\n\n\u201cThe photography class, which is new this year, has a waiting list.\u201d',
      correct: 'After sentence 3.',
      distractors: ['Before sentence 1.', 'After sentence 2.', 'After sentence 4.'],
      solution: 'The new sentence is another example of a popular class, so it belongs with the examples in sentences 2\u20133, before the wrap-up in sentence 4.',
    },
    {
      text: 'Read the paragraph:\n\n(1) The town\u2019s annual harvest fair fills the fairgrounds every October.\n(2) Local farms compete for the biggest pumpkin prize.\n(3) Kids race through a straw maze while parents watch.\n(4) The county courthouse was built in 1887.\n\nWhich sentence does NOT belong in the paragraph?',
      correct: 'Sentence 4',
      distractors: ['Sentence 1', 'Sentence 2', 'Sentence 3'],
      solution: 'Sentences 1\u20133 all describe the harvest fair; sentence 4 is an unrelated fact about the courthouse.',
    },
    {
      text: 'Read the paragraph:\n\n(1) Volunteers sort donated clothes by size and season.\n(2) Shoppers can take what they need at no cost.\n(3) Leftover items are sent to a regional clothing drive.\n\nWhich of the following would be the best topic sentence for this paragraph?',
      correct: 'The community clothing exchange helps families outfit themselves for free.',
      distractors: ['Donations are accepted only on weekday mornings.', 'Clothing has been worn by humans for thousands of years.', 'The nearest mall is about twenty minutes away.'],
      solution: 'The topic sentence captures the paragraph\u2019s main idea (a free community clothing exchange); the distractors are too specific, too broad, or off-topic.',
    },
    {
      text: 'Read the paragraph:\n\n(1) Starting a backyard compost pile is easier than most people think.\n(2) A simple bin and a few basic ingredients are all it takes.\n(3) Finished compost enriches the soil for next season\u2019s garden.\n\nWhich sentence best supports the main idea stated in sentence 1?',
      correct: 'Kitchen scraps, dry leaves, and a weekly stir are the only requirements.',
      distractors: ['Compost bins are sold at hardware stores.', 'Some gardens are planted in raised beds.', 'Autumn is the busiest season for yard work.'],
      solution: 'Sentence 1 claims composting is easy; the correct option lists the simple requirements, while the others are only loosely related.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  const pick = Math.min(count, items.length); // never repeat a question in one exam
  for (let n = 0; n < pick; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: it.text,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SCIENCE — physiology topics (Kaplan: 20 questions, 30 min). Ten systems.
// ---------------------------------------------------------------------------

function genScienceFromPool(pool, count) {
  const out = [];
  const shuffled = shuffle(pool);
  for (let n = 0; n < count; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: it.text,
      category: 'Science',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

const scienceCardiovascular = [
  { text: 'Which chamber of the heart pumps oxygenated blood to the body?', correct: 'Left ventricle', distractors: ['Right ventricle', 'Left atrium', 'Right atrium'], solution: 'The left ventricle has the thickest wall because it pumps blood through the systemic circulation.' },
  { text: 'Which type of blood vessel carries blood away from the heart?', correct: 'Artery', distractors: ['Vein', 'Capillary', 'Venule'], solution: 'Arteries carry blood away from the heart; veins return blood to it.' },
  { text: 'The normal resting heart rate for an adult is approximately —', correct: '60\u2013100 beats per minute', distractors: ['40\u201360 beats per minute', '100\u2013140 beats per minute', '120\u2013160 beats per minute'], solution: 'Normal adult resting heart rate is 60\u2013100 bpm.' },
  { text: 'Blood pressure is highest during which phase of the cardiac cycle?', correct: 'Systole', distractors: ['Diastole', 'The refractory period', 'The filling phase'], solution: 'Systole is ventricular contraction, when pressure in the arteries peaks.' },
  { text: 'Which valve lies between the left atrium and the left ventricle?', correct: 'Mitral valve', distractors: ['Aortic valve', 'Pulmonic valve', 'Tricuspid valve'], solution: 'The mitral (bicuspid) valve separates the left atrium from the left ventricle.' },
];

const scienceElectrolytes = [
  { text: 'Which electrolyte is essential for nerve and muscle function and is monitored closely with digoxin therapy?', correct: 'Potassium', distractors: ['Sodium', 'Chloride', 'Phosphate'], solution: 'Potassium affects cardiac conduction, and digoxin increases the risk of potassium-related rhythm problems.' },
  { text: 'Which electrolyte imbalance commonly follows prolonged vomiting or diarrhea?', correct: 'Hypokalemia (low potassium)', distractors: ['Hyperkalemia (high potassium)', 'Hypercalcemia (high calcium)', 'Hypoglycemia (low glucose)'], solution: 'GI losses are rich in potassium, so vomiting and diarrhea commonly cause low potassium.' },
  { text: 'Sodium balance is regulated primarily by which hormone?', correct: 'Aldosterone', distractors: ['Insulin', 'Thyroxine', 'Parathyroid hormone'], solution: 'Aldosterone causes the kidneys to retain sodium, which also pulls water with it.' },
  { text: 'The normal serum sodium range is approximately —', correct: '135\u2013145 mEq/L', distractors: ['100\u2013110 mEq/L', '150\u2013160 mEq/L', '80\u201390 mEq/L'], solution: 'Normal serum sodium is 135\u2013145 mEq/L.' },
  { text: 'Which mineral is essential for blood clotting and muscle contraction?', correct: 'Calcium', distractors: ['Magnesium', 'Phosphorus', 'Iron'], solution: 'Calcium is required for clot formation, muscle contraction, and nerve transmission.' },
];

const scienceGastrointestinal = [
  { text: 'Which organ produces bile?', correct: 'Liver', distractors: ['Gallbladder', 'Pancreas', 'Stomach'], solution: 'The liver produces bile; the gallbladder stores and concentrates it.' },
  { text: 'Most nutrient absorption occurs in the —', correct: 'Small intestine', distractors: ['Stomach', 'Large intestine', 'Esophagus'], solution: 'The small intestine has villi that maximize the surface for absorbing nutrients.' },
  { text: 'Which enzyme begins the digestion of carbohydrates in the mouth?', correct: 'Salivary amylase', distractors: ['Pepsin', 'Lipase', 'Trypsin'], solution: 'Salivary amylase starts breaking starches into sugars in the mouth.' },
  { text: 'Which hormone stimulates the secretion of gastric acid?', correct: 'Gastrin', distractors: ['Insulin', 'Glucagon', 'Aldosterone'], solution: 'Gastrin, released when food enters the stomach, stimulates acid secretion.' },
  { text: 'Peristalsis is best described as —', correct: 'rhythmic muscular contractions that move contents along the digestive tract', distractors: ['the chemical breakdown of food by enzymes', 'absorption of nutrients into the blood', 'secretion of bile by the liver'], solution: 'Peristalsis is the wave-like muscular movement that propels food through the tract.' },
];

const scienceImmune = [
  { text: 'Which cells produce antibodies?', correct: 'B lymphocytes', distractors: ['Red blood cells', 'Platelets', 'Neutrophils'], solution: 'B lymphocytes (B cells) differentiate into plasma cells that secrete antibodies.' },
  { text: 'The body\u2019s first line of defense against infection includes —', correct: 'skin and mucous membranes', distractors: ['antibodies and complement', 'T lymphocytes', 'memory cells'], solution: 'Skin and mucous membranes are physical barriers, the first line of defense.' },
  { text: 'Immunity acquired from vaccination is best classified as —', correct: 'active artificial immunity', distractors: ['passive natural immunity', 'active natural immunity', 'passive artificial immunity'], solution: 'Vaccination triggers the person\u2019s own immune response, so it is active and artificially induced.' },
  { text: 'Anaphylaxis is best described as —', correct: 'a severe, systemic allergic reaction', distractors: ['a mild local rash', 'a bacterial infection', 'a type of blood clot'], solution: 'Anaphylaxis is a rapid, life-threatening systemic hypersensitivity reaction.' },
  { text: 'Fever is most accurately described as —', correct: 'a systemic response that helps the body fight infection', distractors: ['a sign of decreased immunity', 'always a harmful response', 'a result of a low white blood cell count'], solution: 'Fever raises body temperature to inhibit pathogens and enhance immune activity.' },
];

const scienceNeurology = [
  { text: 'Which part of the brain controls balance and coordination?', correct: 'Cerebellum', distractors: ['Cerebrum', 'Brainstem', 'Thalamus'], solution: 'The cerebellum coordinates voluntary movement, balance, and posture.' },
  { text: 'The nervous system is divided into the central nervous system and the —', correct: 'peripheral nervous system', distractors: ['autonomic nervous system', 'somatic nervous system', 'sympathetic nervous system'], solution: 'The two main divisions are the central (brain and spinal cord) and the peripheral nervous system.' },
  { text: 'Which lobe of the cerebrum is primarily responsible for processing vision?', correct: 'Occipital lobe', distractors: ['Frontal lobe', 'Temporal lobe', 'Parietal lobe'], solution: 'The occipital lobe at the back of the brain processes visual information.' },
  { text: 'Slurred speech and weakness on one side of the body are classic signs of a —', correct: 'stroke', distractors: ['migraine', 'simple seizure', 'concussion'], solution: 'Sudden focal weakness and speech changes suggest interruption of blood flow to the brain, a stroke.' },
  { text: 'Which neurotransmitter drives the fight-or-flight response?', correct: 'Epinephrine (adrenaline)', distractors: ['Dopamine', 'Serotonin', 'Acetylcholine'], solution: 'Epinephrine and norepinephrine prepare the body for stress via the sympathetic system.' },
];

const scienceRenal = [
  { text: 'The functional unit of the kidney is the —', correct: 'nephron', distractors: ['neuron', 'alveolus', 'glomerulus'], solution: 'Each nephron filters blood and forms urine; the glomerulus is only one part of it.' },
  { text: 'Which hormone increases water reabsorption in the kidneys?', correct: 'Antidiuretic hormone (ADH)', distractors: ['Insulin', 'Parathyroid hormone', 'Calcitonin'], solution: 'ADH causes the collecting ducts to reabsorb water, concentrating the urine.' },
  { text: 'Normal adult urine output is approximately —', correct: '1\u20132 liters per day', distractors: ['4\u20136 liters per day', '100\u2013200 mL per day', '8\u201310 liters per day'], solution: 'Normal urine output is roughly 1\u20132 L/day, about 0.5\u20131 mL/kg/hour.' },
  { text: 'Which blood test is the best index of kidney function?', correct: 'Creatinine', distractors: ['Glucose', 'Albumin', 'Bilirubin'], solution: 'Creatinine is produced at a steady rate and cleared by the kidneys, so it reflects renal function.' },
  { text: 'The kidneys help regulate blood pressure by secreting —', correct: 'renin', distractors: ['erythropoietin', 'aldosterone', 'antidiuretic hormone'], solution: 'Renin starts the renin\u2013angiotensin cascade that raises blood pressure; erythropoietin instead stimulates red cell production.' },
];

const scienceHematology = [
  { text: 'Which blood cell carries oxygen?', correct: 'Red blood cell (erythrocyte)', distractors: ['White blood cell', 'Platelet', 'Plasma cell'], solution: 'Erythrocytes contain hemoglobin, which binds and transports oxygen.' },
  { text: 'Which nutrient is required for hemoglobin production?', correct: 'Iron', distractors: ['Calcium', 'Potassium', 'Iodine'], solution: 'Iron is a core component of hemoglobin; deficiency causes anemia.' },
  { text: 'A low platelet count is called —', correct: 'thrombocytopenia', distractors: ['leukopenia', 'anemia', 'polycythemia'], solution: 'Thrombocytopenia is a low platelet count, which increases bleeding risk.' },
  { text: 'Which blood type is the universal donor?', correct: 'O negative', distractors: ['AB positive', 'A positive', 'B negative'], solution: 'O negative cells lack A, B, and Rh antigens, so they can be given to most recipients.' },
  { text: 'The main function of platelets is —', correct: 'blood clotting', distractors: ['oxygen transport', 'fighting infection', 'producing antibodies'], solution: 'Platelets aggregate and form plugs to stop bleeding and support clot formation.' },
];

const scienceHomeostasis = [
  { text: 'Homeostasis is best defined as —', correct: 'maintenance of a stable internal environment', distractors: ['rapid change in body temperature', 'a response only to external stress', 'equalizing all body functions'], solution: 'Homeostasis keeps internal conditions such as temperature, pH, and glucose within a narrow range.' },
  { text: 'Which mechanisms help cool the body when it overheats?', correct: 'Sweating and vasodilation', distractors: ['Shivering and vasoconstriction', 'Increased metabolic rate', 'Piloerection'], solution: 'Sweating cools by evaporation, and dilated skin vessels release heat.' },
  { text: 'Which hormone lowers blood glucose?', correct: 'Insulin', distractors: ['Glucagon', 'Cortisol', 'Epinephrine'], solution: 'Insulin moves glucose into cells, lowering blood glucose; the others raise it.' },
  { text: 'Which of the following is an example of negative feedback?', correct: 'Rising blood glucose triggers insulin release that lowers glucose back to normal.', distractors: ['Contractions during labor intensify until delivery', 'Platelet activation amplifies further clot formation', 'A positive result triggers more of the same response'], solution: 'Negative feedback reverses the change; labor and clotting are positive-feedback loops that amplify it.' },
  { text: 'Body temperature is regulated by the —', correct: 'hypothalamus', distractors: ['cerebellum', 'medulla oblongata', 'pituitary gland'], solution: 'The hypothalamus is the body\u2019s thermostat, balancing heat loss and heat production.' },
];

const scienceRespiratory = [
  { text: 'Gas exchange between air and blood occurs in the —', correct: 'alveoli', distractors: ['bronchi', 'trachea', 'pleura'], solution: 'Alveoli are thin-walled air sacs where oxygen and carbon dioxide diffuse across.' },
  { text: 'Which gas is the main waste product exhaled by the lungs?', correct: 'Carbon dioxide', distractors: ['Oxygen', 'Nitrogen', 'Hydrogen'], solution: 'Carbon dioxide produced by cell metabolism is carried to the lungs and exhaled.' },
  { text: 'The main muscle of respiration is the —', correct: 'diaphragm', distractors: ['pectoralis major', 'rectus abdominis', 'latissimus dorsi'], solution: 'The diaphragm contracts and flattens to expand the chest during inspiration.' },
  { text: 'The normal adult respiratory rate is approximately —', correct: '12\u201320 breaths per minute', distractors: ['4\u20138 breaths per minute', '24\u201330 breaths per minute', '35\u201345 breaths per minute'], solution: 'Normal adult respiratory rate is about 12\u201320 breaths per minute.' },
  { text: 'Which condition is characterized by air trapping and difficulty exhaling?', correct: 'Chronic obstructive pulmonary disease (COPD)', distractors: ['Atelectasis', 'Pleurisy', 'Pulmonary edema'], solution: 'In COPD, airway obstruction makes expiration difficult and traps air in the lungs.' },
];

const scienceSensory = [
  { text: 'Which structure of the eye focuses light onto the retina?', correct: 'Lens', distractors: ['Cornea', 'Iris', 'Sclera'], solution: 'The lens changes shape to focus light; the cornea refracts it first, and the iris controls light entry.' },
  { text: 'The sensory receptors for hearing are located in the —', correct: 'cochlea', distractors: ['semicircular canals', 'tympanic membrane', 'eustachian tube'], solution: 'Hair cells in the cochlea convert sound vibrations into nerve signals.' },
  { text: 'Which cranial nerve carries visual information to the brain?', correct: 'Optic nerve (CN II)', distractors: ['Olfactory nerve (CN I)', 'Facial nerve (CN VII)', 'Vagus nerve (CN X)'], solution: 'The optic nerve transmits signals from the retina to the visual cortex.' },
  { text: 'The sense of smell is mediated by the —', correct: 'olfactory nerve', distractors: ['optic nerve', 'trigeminal nerve', 'hypoglossal nerve'], solution: 'Olfactory receptors in the nasal cavity send signals through the olfactory nerve (CN I).' },
  { text: 'Which part of the inner ear is responsible for balance?', correct: 'Vestibular apparatus (semicircular canals)', distractors: ['Cochlea', 'Tympanic membrane', 'Auditory ossicles'], solution: 'The semicircular canals and vestibule sense head position and movement for balance.' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const KAPLAN_MATH_TOPICS = [
  { id: 'basicArithmetic', label: 'Basic arithmetic operations', gen: genBasicArithmetic },
  { id: 'fractions', label: 'Fractions', gen: genFractions },
  { id: 'decimals', label: 'Decimals', gen: genDecimals },
  { id: 'percentages', label: 'Percentages', gen: genPercentages },
  { id: 'ratios', label: 'Ratios and proportions', gen: genRatioProportion },
  { id: 'conversions', label: 'Unit conversions', gen: genConversions },
  { id: 'algebra', label: 'Basic algebra', gen: genAlgebra },
  { id: 'wordProblems', label: 'Word problems and Data interpretation', gen: genWordProblems },
];

/** Reading topics map to Week 1 of the vault study plan (Kaplan READING section, 22 questions). */
export const KAPLAN_READING_TOPICS = [
  { id: 'readingMainIdea', label: 'Main idea and topic', skill: 'mainIdea', gen: (c) => genReadingSkill('mainIdea', c) },
  { id: 'readingDetails', label: 'Supporting details', skill: 'detail', gen: (c) => genReadingSkill('detail', c) },
  { id: 'readingInference', label: 'Drawing basic inferences', skill: 'inference', gen: (c) => genReadingSkill('inference', c) },
  { id: 'readingPurpose', label: 'Identifying the purpose of a passage', skill: 'purpose', gen: (c) => genReadingSkill('purpose', c) },
  { id: 'readingPOV', label: 'Point of view and tone', skill: 'pov', gen: (c) => genReadingSkill('pov', c) },
  { id: 'readingOrganization', label: 'Passage organization', skill: 'organization', gen: (c) => genReadingSkill('organization', c) },
  { id: 'readingLogic', label: 'Determining the logic of a passage', skill: 'logic', gen: (c) => genReadingSkill('logic', c) },
];

/** Writing topics map to the Kaplan app (WRITING section) plus Week 1 of the study plan. */
export const KAPLAN_WRITING_TOPICS = [
  { id: 'writingMechanics', label: 'Assessing mechanics of writing', gen: genWritingMechanics },
  { id: 'writingTransitions', label: 'Transitions and logical flow', gen: genWritingTransitions },
  { id: 'writingParagraphLogic', label: 'Assessing paragraph logic', gen: genWritingParagraphLogic },
  { id: 'writingDevelopment', label: 'Assessing passage development', gen: genWritingPassageDevelopment },
];

/** Science topics map to the physiology areas listed in the Kaplan app (SCIENCE section). */
export const KAPLAN_SCIENCE_TOPICS = [
  { id: 'scienceCardiovascular', label: 'Cardiovascular system', gen: (c) => genScienceFromPool(scienceCardiovascular, c) },
  { id: 'scienceElectrolytes', label: 'Electrolytes', gen: (c) => genScienceFromPool(scienceElectrolytes, c) },
  { id: 'scienceGI', label: 'Gastrointestinal system', gen: (c) => genScienceFromPool(scienceGastrointestinal, c) },
  { id: 'scienceImmune', label: 'Immune system', gen: (c) => genScienceFromPool(scienceImmune, c) },
  { id: 'scienceNeurology', label: 'Neurology', gen: (c) => genScienceFromPool(scienceNeurology, c) },
  { id: 'scienceRenal', label: 'Renal system', gen: (c) => genScienceFromPool(scienceRenal, c) },
  { id: 'scienceHematology', label: 'Hematological system', gen: (c) => genScienceFromPool(scienceHematology, c) },
  { id: 'scienceHomeostasis', label: 'Homeostasis', gen: (c) => genScienceFromPool(scienceHomeostasis, c) },
  { id: 'scienceRespiratory', label: 'Respiratory system', gen: (c) => genScienceFromPool(scienceRespiratory, c) },
  { id: 'scienceSensory', label: 'Sensory system', gen: (c) => genScienceFromPool(scienceSensory, c) },
];

/**
 * Generate questions for the given topics.
 * @param {string[]} topicIds - subset of KAPLAN_MATH_TOPICS ids (default: all)
 * @param {number} perTopic - questions per topic (default 3)
 * @returns {Array<{text, category, choices: string[], correctIndex: number}>}
 */
export function generateKaplanMathQuestions(topicIds = null, perTopic = 3) {
  const count = Math.max(1, Math.min(10, perTopic));
  const ids = topicIds && topicIds.length
    ? topicIds
    : KAPLAN_MATH_TOPICS.map((t) => t.id);
  const questions = [];
  for (const topic of KAPLAN_MATH_TOPICS) {
    if (!ids.includes(topic.id)) continue;
    const raw = topic.gen(count);
    for (const q of raw) {
      questions.push(buildQuestion(q.category, q.text, q.correct, q.distractors, q.solution));
    }
  }
  return questions;
}

/** Shared driver for the non-math Kaplan generators (reading/writing/science). */
function generateKaplanQuestionsByTopic(topicList, topicIds = null, perTopic = 3) {
  const count = Math.max(1, Math.min(10, perTopic));
  const ids = topicIds && topicIds.length
    ? topicIds
    : topicList.map((t) => t.id);
  const questions = [];
  for (const topic of topicList) {
    if (!ids.includes(topic.id)) continue;
    const raw = topic.gen(count);
    for (const q of raw) {
      const built = buildQuestion(q.category, q.text, q.correct, q.distractors, q.solution);
      // Reading questions carry a separate `passage` (shown once, then its
      // questions) instead of embedding the passage inside the question text.
      if (q.passage) built.passage = q.passage;
      questions.push(built);
    }
  }
  return questions;
}

/** Titles of all available reading passages (for pool-size checks / UI warnings). */
export function getReadingPassageTitles() {
  return READING_PASSAGES.map((p) => p.title);
}

/** Title of the reading passage whose text matches the given passage text, or null. */
export function readingPassageTitleFromText(text) {
  if (!text) return null;
  return READING_PASSAGES.find((p) => p.text === text)?.title ?? null;
}

/**
 * Generate Kaplan-style READING comprehension questions (passage-based).
 *
 * Questions are grouped BY PASSAGE so every question about the same passage
 * appears consecutively (in the passage's natural reading order) instead of
 * being scattered by skill: `perTopic` passages are picked in random order and
 * each contributes one question per selected skill, so each skill still yields
 * `perTopic` questions overall.
 * @param {string[]} topicIds - subset of KAPLAN_READING_TOPICS ids (default: all)
 * @param {number} perTopic - questions per topic (default 3; capped at 10)
 * @param {string[]} excludeTitles - passage titles already used by other generated
 *   exams; excluded so no passage repeats across exams. Once the fixed passage
 *   bank is exhausted, the shortfall is filled with procedurally generated
 *   passages (js/reading-generator.js), which are unique on every call.
 */
export function generateKaplanReadingQuestions(topicIds = null, perTopic = 3, excludeTitles = []) {
  const ids = topicIds && topicIds.length
    ? topicIds
    : KAPLAN_READING_TOPICS.map((t) => t.id);
  const skills = new Set(
    KAPLAN_READING_TOPICS.filter((t) => ids.includes(t.id)).map((t) => t.skill)
  );
  if (!skills.size) return [];

  // Drop passages already used by other generated exams. The fixed bank is
  // used first; any shortfall is filled with unique procedurally generated
  // passages, so generation never runs out.
  const exclude = new Set(excludeTitles || []);
  const pool = READING_PASSAGES.filter((p) => !exclude.has(p.title));
  const requested = Math.max(1, Math.min(10, perTopic));
  const staticCount = Math.min(requested, pool.length);

  const questions = [];
  const usedTitles = new Set(exclude);
  const passages = shuffle(pool);
  for (let n = 0; n < staticCount; n++) {
    appendPassageQuestions(questions, passages[n % passages.length], skills);
    usedTitles.add(passages[n % passages.length].title);
  }

  // Fill the shortfall with procedurally generated passages (always unique).
  let remaining = requested - staticCount;
  let guard = 0;
  while (remaining > 0 && guard < 40) {
    guard++;
    const procedural = generateProceduralReadingPassage(skills, [...usedTitles]);
    if (!procedural) break;
    appendPassageQuestions(questions, procedural, skills);
    usedTitles.add(procedural.title);
    remaining--;
  }
  return questions;
}

/** Build a passage's questions and append them (tagged with title + text). */
function appendPassageQuestions(questions, passage, skills) {
  for (const q of passage.questions) {
    if (!skills.has(q.skill)) continue;
    const built = buildQuestion('Reading', q.text, q.correct, q.distractors, q.solution);
    built.passage = passage.text;
    built.passageTitle = passage.title;
    questions.push(built);
  }
}

/**
 * Generate Kaplan-style WRITING questions (mechanics, paragraph logic, passage development).
 * @param {string[]} topicIds - subset of KAPLAN_WRITING_TOPICS ids (default: all)
 * @param {number} perTopic - questions per topic (default 3)
 */
export function generateKaplanWritingQuestions(topicIds = null, perTopic = 3) {
  return generateKaplanQuestionsByTopic(KAPLAN_WRITING_TOPICS, topicIds, perTopic);
}

/**
 * Generate Kaplan-style SCIENCE questions (physiology topics).
 * @param {string[]} topicIds - subset of KAPLAN_SCIENCE_TOPICS ids (default: all)
 * @param {number} perTopic - questions per topic (default 2)
 */
export function generateKaplanScienceQuestions(topicIds = null, perTopic = 2) {
  return generateKaplanQuestionsByTopic(KAPLAN_SCIENCE_TOPICS, topicIds, perTopic);
}
