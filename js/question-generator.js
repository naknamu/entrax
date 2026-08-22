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
// Skills follow Week 1 of the vault reading-and-writing study plan and the
// kaplan-questions-guideline.txt reference: main idea & topic (D1),
// supporting details (D2), inferences (D3), purpose & point of view (D4),
// passage organization (D5), passage logic (D6). Each passage carries one
// question per skill; the passage text is embedded with the question.
// ---------------------------------------------------------------------------

const READING_PASSAGES = [
  {
    title: 'Pain reassessment',
    text: 'The nurse manager updated the unit\u2019s policy to require pain reassessment within thirty minutes of any analgesic administration. Hospital studies had shown that patients who were reassessed promptly reported better pain control and required fewer rescue doses. Staff were also reminded to document the patient\u2019s pain rating on the same numeric scale used before the medication was given.',
    questions: [
      {
        skill: 'purpose',
        text: 'What is the main purpose of the passage?',
        correct: 'To explain why the unit changed its pain reassessment policy',
        distractors: ['To criticize staff who failed to assess pain', 'To describe a new pain medication', 'To compare two different pain scales'],
        solution: 'The passage opens with the policy change and then gives the reasons behind it, so the main purpose is to explain why the change was made.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, within how long after giving an analgesic must pain be reassessed?',
        correct: 'Thirty minutes',
        distractors: ['Fifteen minutes', 'One hour', 'Two hours'],
        solution: 'The first sentence states that reassessment is required \u201cwithin thirty minutes of any analgesic administration.\u201d',
      },
      {
        skill: 'inference',
        text: 'It can be inferred from the passage that the policy change was made because —',
        correct: 'prompt reassessment was linked to better patient outcomes',
        distractors: ['the hospital purchased new equipment', 'staff requested fewer medications', 'documentation had always been optional'],
        solution: 'The passage says promptly reassessed patients reported better pain control and needed fewer rescue doses, so improved outcomes motivated the change.',
      },
      {
        skill: 'logic',
        text: 'Which of the following statements, if true, would most strengthen the author\u2019s argument?',
        correct: 'Units that reassess within thirty minutes report fewer medication errors',
        distractors: ['Pain scales vary from one unit to another', 'Some patients decline pain medication', 'Documentation takes additional time'],
        solution: 'A statement linking prompt reassessment to better safety outcomes supports the policy the passage defends.',
      },
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'Prompt pain reassessment improves patient outcomes, so the unit made it a requirement.',
        distractors: ['Pain medication should be given every thirty minutes.', 'Pain scales are too unreliable to use at night.', 'Documentation is optional for stable patients.'],
        solution: 'The passage explains why the unit changed the policy: promptly reassessed patients reported better pain control and needed fewer rescue doses.',
      },
      {
        skill: 'organization',
        text: 'The information in the passage is organized mainly as —',
        correct: 'cause and effect',
        distractors: ['chronological order', 'compare and contrast', 'general to specific'],
        solution: 'The passage presents the policy change and then explains the study findings that led to it, a cause-and-effect structure.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'neutral and objective',
        distractors: ['angry and critical', 'humorous and lighthearted', 'worried and alarmed'],
        solution: 'The author reports the policy change and the evidence behind it without praise or criticism, so the tone is neutral and objective.',
      },
    ],
  },
  {
    title: 'Hand hygiene',
    text: 'Hand hygiene remains the single most effective measure for preventing health care\u2013associated infections. Although compliance has improved, audits show that opportunities are still missed after glove removal and between patient contacts. The infection control team now conducts unannounced observations and posts unit-level feedback each month.',
    questions: [
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'highlight the importance of hand hygiene and of ongoing monitoring',
        distractors: ['describe a new soap product', 'report one hospital\u2019s failure', 'argue that gloves replace hand washing'],
        solution: 'The passage explains why hand hygiene matters and describes how the hospital monitors compliance, so the purpose is to highlight both.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, when are hand hygiene opportunities still missed?',
        correct: 'After glove removal and between patient contacts',
        distractors: ['Before entering patient rooms', 'During medication preparation', 'Only at shift change'],
        solution: 'The second sentence states that opportunities are missed \u201cafter glove removal and between patient contacts.\u201d',
      },
      {
        skill: 'inference',
        text: 'Posting unit-level feedback each month is most likely intended to —',
        correct: 'encourage improvement through transparency',
        distractors: ['replace unannounced observations', 'punish individual staff members', 'eliminate the need for training'],
        solution: 'Public, unit-level feedback motivates teams to improve while unannounced observation continues, so transparency is the goal.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would best conclude the passage?',
        correct: 'With consistent feedback, compliance gaps can be closed and infections reduced.',
        distractors: ['Most infections occur in the community.', 'Audits are expensive to perform.', 'Soap should be replaced entirely by alcohol rubs.'],
        solution: 'A strong conclusion ties the monitoring strategy back to the passage\u2019s goal of preventing infections.',
      },
      {
        skill: 'mainIdea',
        text: 'Which statement best summarizes the passage?',
        correct: 'Hand hygiene is vital, and ongoing monitoring helps close compliance gaps.',
        distractors: ['Hand hygiene is only necessary after glove removal.', 'Soap should be replaced entirely with alcohol rubs.', 'Infections cannot be prevented in hospitals.'],
        solution: 'The passage states that hand hygiene is the single most effective measure and describes how monitoring and feedback improve compliance.',
      },
      {
        skill: 'organization',
        text: 'The passage is organized mainly as —',
        correct: 'problem and solution',
        distractors: ['compare and contrast', 'chronological order', 'cause and effect'],
        solution: 'The passage identifies a problem (hand hygiene opportunities still missed) and then describes the solution (unannounced observations and unit-level feedback).',
      },
      {
        skill: 'pov',
        text: 'The author most likely believes that compliance gaps —',
        correct: 'can be reduced with consistent monitoring and feedback',
        distractors: ['will never change despite any effort', 'are acceptable because infections are rare', 'can be fixed by replacing hand washing with gloves'],
        solution: 'The passage presents monitoring and feedback as the response to missed opportunities, so the author believes the gaps can be reduced.',
      },
    ],
  },
  {
    title: 'Medication reconciliation',
    text: 'Medication reconciliation compares a patient\u2019s current medication list with the medications ordered on admission. Discrepancies, such as a missing dose or a doubled drug, are common at transitions of care. Reviewing the list with the patient and the pharmacy reduces the risk of harmful errors.',
    questions: [
      {
        skill: 'purpose',
        text: 'The passage is mainly about —',
        correct: 'the role of medication reconciliation in preventing errors',
        distractors: ['the cost of prescription drugs', 'how to administer intravenous medications', 'the duties of the pharmacy department'],
        solution: 'The passage defines reconciliation and explains how it prevents errors, which is its main focus.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, discrepancies are most likely to occur —',
        correct: 'at transitions of care',
        distractors: ['during surgery', 'in the pharmacy storeroom', 'after discharge only'],
        solution: 'The passage states that discrepancies \u201care common at transitions of care.\u201d',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that involving the patient in the review helps because —',
        correct: 'patients may know exactly what they take at home',
        distractors: ['patients prefer to manage their own medications', 'pharmacists cannot read orders', 'the review takes less time'],
        solution: 'Patients are the most reliable source for their actual home medication list, which is why their input improves accuracy.',
      },
      {
        skill: 'logic',
        text: 'Which statement, if added, would best support the passage\u2019s main idea?',
        correct: 'Studies show reconciliation prevents up to 70% of serious medication errors.',
        distractors: ['Most patients take fewer than three medications.', 'New computers were installed in the pharmacy.', 'Medication errors rarely cause patient harm.'],
        solution: 'A statistic showing that reconciliation prevents errors directly supports the passage\u2019s claim about reducing risk.',
      },
      {
        skill: 'mainIdea',
        text: 'The main idea of the passage is that —',
        correct: 'comparing medication lists and reviewing them with the patient prevents harmful errors',
        distractors: ['pharmacies should fill all prescriptions on admission', 'medication errors are rare in hospitals', 'patients should bring no medications from home'],
        solution: 'Each sentence supports the point that reconciliation catches discrepancies and reduces the risk of harmful errors.',
      },
      {
        skill: 'organization',
        text: 'How is the information in the passage organized?',
        correct: 'from a general definition to specific examples and a specific action',
        distractors: ['chronological order of a hospital admission', 'compare and contrast of two medications', 'a series of questions and answers'],
        solution: 'The passage opens with a definition of reconciliation, gives examples of discrepancies, and ends with the specific review step.',
      },
      {
        skill: 'pov',
        text: 'The author would most likely agree that medication reconciliation —',
        correct: 'is a valuable step in preventing medication errors',
        distractors: ['adds unnecessary work for nurses', 'should be performed only at discharge', 'is the sole responsibility of the pharmacy'],
        solution: 'The passage says that reviewing the list \u201creduces the risk of harmful errors,\u201d so the author values reconciliation as an error-prevention step.',
      },
    ],
  },
  {
    title: 'Early mobilization',
    text: 'Early mobilization of patients after surgery shortens hospital stays and reduces complications such as pneumonia and blood clots. Despite the evidence, patients often remain in bed because of fatigue or fear of pain. Nurses can ease the process by setting small, achievable goals and giving pain medication before activity.',
    questions: [
      {
        skill: 'purpose',
        text: 'The purpose of this passage is to —',
        correct: 'explain the benefits of early mobilization and how nurses can support it',
        distractors: ['describe the risks of surgery', 'compare hospital departments', 'promote a new walking device'],
        solution: 'The passage presents the benefits of mobilization and then practical nursing strategies, so that is its purpose.',
      },
      {
        skill: 'detail',
        text: 'Which complications does the passage say early mobilization reduces?',
        correct: 'Pneumonia and blood clots',
        distractors: ['Dehydration and fever', 'Infection and skin rash', 'Constipation and anemia'],
        solution: 'The first sentence names \u201cpneumonia and blood clots\u201d as complications reduced by early mobilization.',
      },
      {
        skill: 'inference',
        text: 'Patients often remain in bed despite the evidence mainly because of —',
        correct: 'fatigue and fear of pain',
        distractors: ['lack of nursing staff', 'hospital policy', 'insurance requirements'],
        solution: 'The passage says patients stay in bed \u201cbecause of fatigue or fear of pain.\u201d',
      },
      {
        skill: 'logic',
        text: 'The advice to set small, achievable goals most directly supports which idea?',
        correct: 'Gradual activity can overcome patients\u2019 reluctance.',
        distractors: ['Surgery should be avoided.', 'Pain medication is unnecessary.', 'Mobilization should wait until discharge.'],
        solution: 'Small goals address the fatigue and fear that keep patients in bed, so they support gradual, achievable activity.',
      },
      {
        skill: 'mainIdea',
        text: 'What is the author mainly trying to tell the reader?',
        correct: 'Early mobilization benefits patients, and nurses can help patients overcome barriers to it.',
        distractors: ['Patients should not be moved after surgery.', 'Surgery causes more complications than it prevents.', 'Pain medication should be given only after activity.'],
        solution: 'The passage presents the benefits of early mobilization and then explains how nurses can help patients overcome fatigue and fear.',
      },
      {
        skill: 'organization',
        text: 'The passage is organized mainly as —',
        correct: 'problem and solution',
        distractors: ['compare and contrast', 'a sequence of events over time', 'chronological order'],
        solution: 'The passage describes the problem (patients staying in bed because of fatigue or fear) and the solution (small goals and pain medication before activity).',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s attitude toward early mobilization is best described as —',
        correct: 'supportive and encouraging',
        distractors: ['skeptical and doubtful', 'indifferent and neutral', 'opposed and cautious'],
        solution: 'The author describes the benefits and practical ways nurses can help, which shows a supportive attitude.',
      },
    ],
  },
  {
    title: 'Diabetes teaching',
    text: 'A patient newly diagnosed with type 2 diabetes is taught to check blood glucose before meals and at bedtime. The educator explains that consistent monitoring shows how food, activity, and medication affect glucose levels. Patients who track results in a log are better able to recognize patterns and adjust their routines with their care team.',
    questions: [
      {
        skill: 'purpose',
        text: 'The main purpose of the passage is to —',
        correct: 'describe the value of blood glucose monitoring in diabetes management',
        distractors: ['criticize patients who do not monitor', 'explain how insulin is manufactured', 'list the symptoms of hypoglycemia'],
        solution: 'The passage focuses on why monitoring matters and how a log helps, so its purpose is to describe the value of monitoring.',
      },
      {
        skill: 'detail',
        text: 'When is the patient taught to check blood glucose?',
        correct: 'Before meals and at bedtime',
        distractors: ['Only in the morning', 'After every meal', 'Once a week'],
        solution: 'The first sentence says the patient checks glucose \u201cbefore meals and at bedtime.\u201d',
      },
      {
        skill: 'inference',
        text: 'Keeping a glucose log most likely helps because it —',
        correct: 'reveals patterns that guide treatment decisions',
        distractors: ['replaces the need for medication', 'reduces the frequency of office visits', 'guarantees normal glucose levels'],
        solution: 'The passage says a log helps patients \u201crecognize patterns and adjust their routines,\u201d which guides treatment decisions.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would best introduce the passage?',
        correct: 'Blood glucose monitoring is a cornerstone of type 2 diabetes self-management.',
        distractors: ['Most patients dislike needles.', 'Insulin was discovered in 1921.', 'Hospital food is often criticized.'],
        solution: 'A general statement about monitoring\u2019s importance sets up the teaching example that follows.',
      },
      {
        skill: 'mainIdea',
        text: 'Which statement best expresses the main idea of the passage?',
        correct: 'Consistent glucose monitoring and logging help patients with diabetes manage their condition.',
        distractors: ['Blood glucose should be checked only at bedtime.', 'Insulin cures type 2 diabetes.', 'Exercise has no effect on glucose levels.'],
        solution: 'The passage explains how monitoring and a log help the patient recognize patterns and adjust routines.',
      },
      {
        skill: 'organization',
        text: 'The passage describes the monitoring routine mainly as —',
        correct: 'a sequence of steps that repeats daily',
        distractors: ['a compare-and-contrast of two medications', 'a problem followed by one solution', 'a chronological history of diabetes care'],
        solution: 'The passage lists the steps \u2014 check before meals and at bedtime, track results in a log, recognize patterns, adjust routines \u2014 a repeating sequence.',
      },
      {
        skill: 'pov',
        text: 'The author\u2019s tone in the passage is best described as —',
        correct: 'informative and encouraging',
        distractors: ['critical of the patient', 'alarmist and frightening', 'sarcastic and dismissive'],
        solution: 'The author explains monitoring neutrally and notes that patients who log results are better able to adjust routines, an encouraging tone.',
      },
    ],
  },
  {
    title: 'Delegation',
    text: 'Delegation is the transfer of a task to a competent team member while the nurse retains accountability for the outcome. Simple, stable tasks may be delegated, but assessment, teaching, and tasks requiring clinical judgment are not. The delegating nurse must verify the other person\u2019s competence and provide clear instructions.',
    questions: [
      {
        skill: 'purpose',
        text: 'The passage primarily explains —',
        correct: 'what delegation is and what it requires of the nurse',
        distractors: ['why delegation is illegal', 'how to evaluate nursing students', 'the difference between two medications'],
        solution: 'The passage defines delegation and then states what the delegating nurse must do, which is its main point.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, which tasks should NOT be delegated?',
        correct: 'Assessment, teaching, and tasks requiring clinical judgment',
        distractors: ['Simple, stable tasks', 'Measuring vital signs on stable patients', 'Delivering meal trays'],
        solution: 'The passage states that assessment, teaching, and tasks requiring clinical judgment are not to be delegated.',
      },
      {
        skill: 'inference',
        text: 'A nurse who delegates a task remains accountable because —',
        correct: 'accountability for the outcome stays with the delegating nurse',
        distractors: ['the team member is supervised by management', 'tasks are always reversible', 'the patient requested the task'],
        solution: 'The definition states the nurse \u201cretains accountability for the outcome\u201d after delegating the task.',
      },
      {
        skill: 'logic',
        text: 'Which additional statement would best clarify the author\u2019s point?',
        correct: 'Delegation is appropriate only when the team member has the training and scope to perform the task.',
        distractors: ['Delegation always reduces the nurse\u2019s workload.', 'Team members should never ask questions.', 'All tasks can be safely delegated.'],
        solution: 'Clarifying that competence and scope must match the task supports the requirement to verify competence.',
      },
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'Delegation works only when the task fits the team member\u2019s competence and the nurse keeps accountability.',
        distractors: ['Nurses should never delegate any task.', 'Delegation removes all responsibility from the nurse.', 'All simple tasks can be delegated without supervision.'],
        solution: 'The passage defines delegation and stresses verifying competence and retaining accountability, which is its main point.',
      },
      {
        skill: 'organization',
        text: 'The passage is organized mainly by —',
        correct: 'contrasting tasks that may be delegated with tasks that may not',
        distractors: ['chronological order of a work shift', 'a cause-and-effect chain', 'a comparison of two nurses'],
        solution: 'The passage contrasts simple, stable tasks with tasks requiring clinical judgment, then explains the delegating nurse\u2019s duties.',
      },
      {
        skill: 'pov',
        text: 'Which statement best describes the author\u2019s view of delegation?',
        correct: 'It is useful when done correctly and safely',
        distractors: ['It is never appropriate in nursing', 'It means the nurse is no longer accountable', 'It should be used for every patient task'],
        solution: 'The author explains when delegation is appropriate and what it requires, showing it is useful when done correctly and safely.',
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
      text: `${passage.text}\n\n${q.text}`,
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
// ---------------------------------------------------------------------------

/** Mechanics: choose the correctly revised sentence. */
function genWritingMechanics(count) {
  const items = [
    {
      stem: 'The nurse, along with the residents, were responsible for the evening rounds.',
      correct: 'The nurse, along with the residents, was responsible for the evening rounds.',
      distractors: ['The nurse and the residents was responsible for the evening rounds.', 'The nurse, along with the residents, are responsible for the evening rounds.', 'The nurse, along with the residents, were responsible for the evening rounds.'],
      solution: 'The subject is \u201cthe nurse\u201d (singular); the phrase \u201calong with the residents\u201d does not change the number, so the verb must be \u201cwas.\u201d',
    },
    {
      stem: 'The patient was restless, the nurse increased the frequency of observation.',
      correct: 'Because the patient was restless, the nurse increased the frequency of observation.',
      distractors: ['The patient was restless the nurse increased the frequency of observation.', 'The patient was restless, the nurse increased, the frequency of observation.', 'The patient was restless and the nurse increasing the frequency of observation.'],
      solution: 'Two complete sentences joined only by a comma form a comma splice; subordinating with \u201cBecause\u201d fixes it.',
    },
    {
      stem: 'Each nurse must document their assessment before leaving the shift.',
      correct: 'Each nurse must document his or her assessment before leaving the shift.',
      distractors: ['Each nurse must document their assessments before leaving the shift.', 'Each nurses must document their assessment before leaving the shift.', 'Each nurse must document themselves assessment before leaving the shift.'],
      solution: '\u201cEach nurse\u201d is singular, so the pronoun must be singular (\u201chis or her\u201d) to agree.',
    },
    {
      stem: 'The nurse checks the drip rate, verified the prescription, and then documents the findings.',
      correct: 'The nurse checks the drip rate, verifies the prescription, and then documents the findings.',
      distractors: ['The nurse checks the drip rate, verified the prescription, and documents the findings.', 'The nurse checked the drip rate, verifies the prescription, and then documents the findings.', 'The nurse checks the drip rate, verifying the prescription, and then documents the findings.'],
      solution: 'Items in a list should be parallel: checks, verifies, documents are all present tense.',
    },
    {
      stem: 'The patients\u2019 vital signs were stable, but the nurses station was empty.',
      correct: 'The patients\u2019 vital signs were stable, but the nurses\u2019 station was empty.',
      distractors: ['The patients vital signs were stable, but the nurses\u2019 station was empty.', 'The patient\u2019s vital signs were stable, but the nurses station was empty.', 'The patients\u2019 vital signs were stable, but the nurses station was empty.'],
      solution: 'The station belongs to more than one nurse, so it needs the plural possessive \u201cnurses\u2019.\u201d',
    },
    {
      stem: 'After reviewing the chart, the medication was administered by the nurse.',
      correct: 'After reviewing the chart, the nurse administered the medication.',
      distractors: ['After reviewing the chart, the medication was administered by the nurse.', 'After reviewed the chart, the medication was administered by the nurse.', 'After the chart was reviewed, the medication administering began.'],
      solution: 'The introductory phrase must modify the sentence subject; the nurse reviews the chart, so the nurse must be the subject.',
    },
    {
      stem: 'The technician prepares the tray and then he labels every medication.',
      correct: 'The technician prepares the tray and then labels every medication.',
      distractors: ['The technician prepares the tray and then he labels every medication.', 'The technician prepare the tray and then labels every medication.', 'The technician prepares the tray and then he label every medication.'],
      solution: 'With a single subject, the second verb should not repeat the pronoun; \u201cprepares \u2026 labels\u201d is concise and correct.',
    },
    {
      stem: 'There is many reasons why the wound should be kept clean and dry.',
      correct: 'There are many reasons why the wound should be kept clean and dry.',
      distractors: ['There is many reasons why the wound should be kept clean and dry.', 'There are many reason why the wound should be kept clean and dry.', 'There is many reason why the wound should be kept clean and dry.'],
      solution: '\u201cReasons\u201d is plural, so the verb must be \u201care.\u201d',
    },
    {
      stem: 'The nurse asked the patient how was he feeling after the procedure.',
      correct: 'The nurse asked the patient how he was feeling after the procedure.',
      distractors: ['The nurse asked the patient how was he feeling after the procedure.', 'The nurse ask the patient how he was feeling after the procedure.', 'The nurse asked the patient how he were feeling after the procedure.'],
      solution: 'An indirect question uses statement word order: \u201chow he was feeling,\u201d not \u201chow was he feeling.\u201d',
    },
    {
      stem: 'Because the patient\u2019s blood pressure dropped suddenly. The nurse called the rapid response team.',
      correct: 'Because the patient\u2019s blood pressure dropped suddenly, the nurse called the rapid response team.',
      distractors: ['Because the patient\u2019s blood pressure dropped suddenly the nurse called the rapid response team.', 'Because the patient\u2019s blood pressure dropped suddenly, and the nurse called the rapid response team.', 'The patient\u2019s blood pressure dropped suddenly, because the nurse called the rapid response team.'],
      solution: 'The first group of words is a fragment \u2014 a subordinate clause punctuated as a sentence. Joining it to the main clause with a comma fixes it.',
    },
    {
      stem: 'The medication was due at noon the nurse administered it at 12:15.',
      correct: 'The medication was due at noon, so the nurse administered it at 12:15.',
      distractors: ['The medication was due at noon the nurse administered it at 12:15.', 'The medication was due at noon, the nurse administered it at 12:15.', 'The medication was due at noon the nurse administered, it at 12:15.'],
      solution: 'Two complete sentences run together with no punctuation form a run-on; joining them with a comma and the conjunction \u201cso\u201d fixes it.',
    },
    {
      stem: 'The nurse checked the IV site, the dressing and the drainage bag.',
      correct: 'The nurse checked the IV site, the dressing, and the drainage bag.',
      distractors: ['The nurse checked the IV site the dressing and the drainage bag.', 'The nurse checked the IV site, the dressing and the drainage, bag.', 'The nurse checked the IV site, the dressing and, the drainage bag.'],
      solution: 'Items in a series of three or more are separated by commas, including before \u201cand\u201d (the serial comma).',
    },
    {
      stem: 'After the procedure the patient was moved to the recovery room.',
      correct: 'After the procedure, the patient was moved to the recovery room.',
      distractors: ['After the procedure the patient, was moved to the recovery room.', 'After, the procedure the patient was moved to the recovery room.', 'After the procedure, the patient, was moved to the recovery room.'],
      solution: 'An introductory phrase such as \u201cAfter the procedure\u201d is set off from the main clause with a comma.',
    },
    {
      stem: 'The first dose was given at 8 a.m. the second dose was scheduled for 8 p.m.',
      correct: 'The first dose was given at 8 a.m.; the second dose was scheduled for 8 p.m.',
      distractors: ['The first dose was given at 8 a.m., the second dose was scheduled for 8 p.m.', 'The first dose was given at 8 a.m. the second dose was scheduled for 8 p.m.', 'The first dose was given at 8 a.m. and, the second dose was scheduled for 8 p.m.'],
      solution: 'Two closely related complete sentences can be joined with a semicolon; a comma alone would create a comma splice.',
    },
    {
      stem: 'The admission kit contained the following items a gown, toiletries, and a patient ID band.',
      correct: 'The admission kit contained the following items: a gown, toiletries, and a patient ID band.',
      distractors: ['The admission kit contained the following items; a gown, toiletries, and a patient ID band.', 'The admission kit contained the following items a gown, toiletries, and a patient ID band.', 'The admission kit contained the following items, a gown, toiletries, and a patient ID band.'],
      solution: 'A colon introduces a list after a complete sentence such as \u201cthe following items.\u201d',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  for (let n = 0; n < count; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: `Which revision best corrects the sentence?\n\n${it.stem}`,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/** Paragraph logic: order sentences, find the topic/concluding/odd sentence. */
function genWritingParagraphLogic(count) {
  const items = [
    {
      sentences: [
        'Patients who understand their discharge instructions are less likely to be readmitted.',
        'Nurses should review each instruction and ask the patient to repeat it back.',
        'A family member may also attend the teaching session.',
        'Discharge planning begins on the day of admission.',
      ],
      ask: 'Which sentence should be FIRST as the topic sentence?',
      correct: 'Patients who understand their discharge instructions are less likely to be readmitted.',
      distractors: ['Nurses should review each instruction and ask the patient to repeat it back.', 'A family member may also attend the teaching session.', 'Discharge planning begins on the day of admission.'],
      solution: 'The topic sentence states the general claim (understanding instructions reduces readmissions) that the other sentences support.',
    },
    {
      sentences: [
        'Some medications require refrigeration.',
        'Insulin should be stored in the refrigerator until it is opened.',
        'Once opened, it may be kept at room temperature for up to 28 days.',
        'Always check the manufacturer\u2019s storage guidance.',
      ],
      ask: 'Which sentence should come LAST as the concluding sentence?',
      correct: 'Always check the manufacturer\u2019s storage guidance.',
      distractors: ['Some medications require refrigeration.', 'Insulin should be stored in the refrigerator until it is opened.', 'Once opened, it may be kept at room temperature for up to 28 days.'],
      solution: 'The final sentence gives the general rule that wraps up the specific examples about storage.',
    },
    {
      sentences: [
        'The call light was placed within reach.',
        'The bed was set to its lowest position.',
        'The nurse implemented several measures to prevent falls.',
        'Nonskid socks were provided.',
      ],
      ask: 'Which sentence best serves as the topic sentence?',
      correct: 'The nurse implemented several measures to prevent falls.',
      distractors: ['The call light was placed within reach.', 'The bed was set to its lowest position.', 'Nonskid socks were provided.'],
      solution: 'The topic sentence introduces the list; the other sentences are the specific measures.',
    },
    {
      sentences: [
        'The night nurse reported the patient\u2019s status to the day nurse.',
        'The report included vital signs, medications, and recent events.',
        'The day nurse asked clarifying questions.',
        'Handoffs are most effective when they are structured and complete.',
      ],
      ask: 'Which sentence should be FIRST?',
      correct: 'Handoffs are most effective when they are structured and complete.',
      distractors: ['The night nurse reported the patient\u2019s status to the day nurse.', 'The report included vital signs, medications, and recent events.', 'The day nurse asked clarifying questions.'],
      solution: 'The general principle about handoffs should open the paragraph, followed by the example of one handoff.',
    },
    {
      sentences: [
        'The wound was cleaned with sterile saline.',
        'A new dressing was applied over the wound.',
        'The patient\u2019s hemoglobin was 13.2 g/dL.',
        'The nurse documented the procedure.',
      ],
      ask: 'Which sentence does NOT belong in the paragraph?',
      correct: 'The patient\u2019s hemoglobin was 13.2 g/dL.',
      distractors: ['The wound was cleaned with sterile saline.', 'A new dressing was applied over the wound.', 'The nurse documented the procedure.'],
      solution: 'The other sentences describe one wound-care procedure; the hemoglobin value is unrelated to that sequence.',
    },
    {
      sentences: [
        'Hand washing removes transient bacteria from the skin.',
        'Alcohol rubs are effective when hands are not visibly soiled.',
        'Barriers such as gloves provide additional protection.',
        'Together, these practices greatly reduce the spread of infection.',
      ],
      ask: 'Which sentence best concludes the paragraph?',
      correct: 'Together, these practices greatly reduce the spread of infection.',
      distractors: ['Hand washing removes transient bacteria from the skin.', 'Alcohol rubs are effective when hands are not visibly soiled.', 'Barriers such as gloves provide additional protection.'],
      solution: 'The concluding sentence summarizes and synthesizes the three practices described.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  for (let n = 0; n < count; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: `Read the sentences:\n\n${it.sentences.map((s, i) => `(${i + 1}) ${s}`).join('\n')}\n\n${it.ask}`,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/** Transitions: choose the word that best links two sentences (Week 1 Day 5/6). */
function genWritingTransitions(count) {
  const items = [
    {
      context: 'Patients are told to report chest pain immediately. _____ , some people wait to see whether the pain passes before calling for help.',
      ask: 'Which transition word best fills the blank?',
      correct: 'However',
      distractors: ['Therefore', 'For example', 'Consequently'],
      solution: 'The second sentence contrasts with the first, so a contrast word such as \u201cHowever\u201d is needed.',
    },
    {
      context: 'The wound showed no signs of healing after two weeks. _____, the care team ordered a wound culture.',
      ask: 'Which transition word best fills the blank?',
      correct: 'Therefore',
      distractors: ['However', 'For example', 'Meanwhile'],
      solution: 'The second sentence states a result of the first, so a consequence word such as \u201cTherefore\u201d is needed.',
    },
    {
      context: 'The nurse explained each step of the procedure. _____, she demonstrated the steps on a mannequin.',
      ask: 'Which transition word best fills the blank?',
      correct: 'Next',
      distractors: ['However', 'Similarly', 'As a result'],
      solution: 'The second sentence continues the sequence, so a sequencing word such as \u201cNext\u201d is needed.',
    },
    {
      context: 'Hand washing removes most transient bacteria from the skin. _____, alcohol-based rubs protect when hands are not visibly soiled.',
      ask: 'Which transition word best fills the blank?',
      correct: 'Similarly',
      distractors: ['However', 'Therefore', 'Finally'],
      solution: 'The second sentence makes a comparable point about another hygiene method, so \u201cSimilarly\u201d is needed.',
    },
    {
      context: 'The patient\u2019s potassium level was dangerously low. _____, the physician ordered an IV potassium infusion.',
      ask: 'Which transition word best fills the blank?',
      correct: 'Consequently',
      distractors: ['Nevertheless', 'For example', 'Meanwhile'],
      solution: 'The low potassium caused the order, so a result word such as \u201cConsequently\u201d is needed.',
    },
    {
      context: 'Vital signs were checked on admission, again at 4 p.m., and once more at 8 p.m. _____, the nurse recorded the last set on the flow sheet.',
      ask: 'Which transition word best fills the blank?',
      correct: 'Finally',
      distractors: ['However', 'In contrast', 'For example'],
      solution: 'The sentence marks the end of a sequence of checks, so \u201cFinally\u201d is needed.',
    },
    {
      context: 'The patient tolerated the first dose of the medication well. _____, the second dose caused nausea.',
      ask: 'Which transition word best fills the blank?',
      correct: 'However',
      distractors: ['Therefore', 'Furthermore', 'For example'],
      solution: 'The second sentence contrasts with the first, so a contrast word such as \u201cHowever\u201d is needed.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  for (let n = 0; n < count; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: `${it.context}\n\n${it.ask}`,
      category: 'Writing',
      correct: it.correct,
      distractors: it.distractors,
      solution: it.solution,
    });
  }
  return out;
}

/** Passage development: pick the sentence that best supports the paragraph. */
function genWritingPassageDevelopment(count) {
  const items = [
    {
      text: 'Vaccination programs protect communities as well as individuals. When enough people are immunized, the spread of disease slows dramatically, which shields even those who cannot be vaccinated.',
      ask: 'Which sentence, if added, would best support the main idea?',
      correct: 'Immunizations protect both the individual and the community through herd immunity.',
      distractors: ['The clinic opens at 8 a.m. on weekdays.', 'Most vaccines are injected into the upper arm.', 'Cold packs should be available after vaccination.'],
      solution: 'A sentence explaining herd immunity directly supports the claim about community protection.',
    },
    {
      text: 'Adequate sleep is essential for healing and recovery. Patients who sleep poorly often have higher pain levels and slower wound healing.',
      ask: 'Which sentence, if added, would best support the main idea?',
      correct: 'A consistent bedtime routine helps the body prepare for rest.',
      distractors: ['Hospitals usually serve breakfast by 7 a.m.', 'Some patients prefer warm blankets.', 'Night shift schedules vary by unit.'],
      solution: 'A practical strategy that improves sleep supports the passage\u2019s point about the importance of sleep.',
    },
    {
      text: 'Monitoring fluid balance is a core nursing responsibility. Small shifts in body water can signal serious problems before other signs appear.',
      ask: 'Which sentence, if added, would best support the main idea?',
      correct: 'Measuring daily weight is a reliable way to detect fluid changes.',
      distractors: ['Most hospital scales are digital now.', 'Patients often ask about their diet.', 'Water makes up about 60% of body weight.'],
      solution: 'A method for detecting fluid changes directly supports the claim that monitoring matters.',
    },
    {
      text: 'Unrelieved pain can slow a patient\u2019s recovery. Pain interferes with sleep, appetite, and the willingness to move, which are all needed for healing.',
      ask: 'Which sentence, if added, would best support the main idea?',
      correct: 'Patients with well-managed pain are often discharged sooner.',
      distractors: ['Pain scales use numbers from zero to ten.', 'Some patients close their eyes when in pain.', 'Nurses chart pain at each shift.'],
      solution: 'A statement linking pain management to faster recovery strengthens the passage\u2019s main idea.',
    },
    {
      text: 'Nurses often check a patient\u2019s temperature, pulse, and blood pressure on admission. These first measurements provide a baseline for comparing later readings.',
      ask: 'Which sentence would provide the best introduction to this paragraph?',
      correct: 'Vital signs taken on admission give a snapshot of a patient\u2019s condition.',
      distractors: ['The hospital cafeteria closes at 7 p.m.', 'Most thermometers are electronic now.', 'Patients may feel nervous on the first day.'],
      solution: 'A general statement about why admission vital signs matter sets up the specific points that follow.',
    },
    {
      text: 'Washing hands with soap and water removes dirt and most germs. Alcohol-based rubs are convenient when hands are not visibly soiled. Gloves provide a barrier when touching body fluids.',
      ask: 'Which sentence would provide the most effective conclusion?',
      correct: 'Using these measures consistently greatly reduces the spread of infection.',
      distractors: ['Some sinks have automatic faucets.', 'Soap comes in liquid and bar forms.', 'Gloves are made of latex or vinyl.'],
      solution: 'A concluding sentence summarizes the three hygiene measures and states their shared benefit.',
    },
    {
      text: 'The nurse prepared the patient for a blood transfusion. First, she verified the patient\u2019s identity against the order. Then she checked the blood product label with a second nurse. The hospital\u2019s gift shop closes at 6 p.m.',
      ask: 'Which sentence should be removed because it does not support the paragraph?',
      correct: 'The hospital\u2019s gift shop closes at 6 p.m.',
      distractors: ['The nurse prepared the patient for a blood transfusion.', 'First, she verified the patient\u2019s identity against the order.', 'Then she checked the blood product label with a second nurse.'],
      solution: 'The gift shop detail is unrelated to the transfusion procedure and breaks the paragraph\u2019s focus.',
    },
  ];
  const out = [];
  const shuffled = shuffle(items);
  for (let n = 0; n < count; n++) {
    const it = shuffled[n % shuffled.length];
    out.push({
      text: `${it.text}\n\n${it.ask}`,
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
  { id: 'readingMainIdea', label: 'Main idea and topic', gen: (c) => genReadingSkill('mainIdea', c) },
  { id: 'readingDetails', label: 'Supporting details', gen: (c) => genReadingSkill('detail', c) },
  { id: 'readingInference', label: 'Drawing basic inferences', gen: (c) => genReadingSkill('inference', c) },
  { id: 'readingPurpose', label: 'Identifying the purpose of a passage', gen: (c) => genReadingSkill('purpose', c) },
  { id: 'readingPOV', label: 'Point of view and tone', gen: (c) => genReadingSkill('pov', c) },
  { id: 'readingOrganization', label: 'Passage organization', gen: (c) => genReadingSkill('organization', c) },
  { id: 'readingLogic', label: 'Determining the logic of a passage', gen: (c) => genReadingSkill('logic', c) },
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
      questions.push(buildQuestion(q.category, q.text, q.correct, q.distractors, q.solution));
    }
  }
  return questions;
}

/**
 * Generate Kaplan-style READING comprehension questions (passage-based).
 * @param {string[]} topicIds - subset of KAPLAN_READING_TOPICS ids (default: all)
 * @param {number} perTopic - questions per topic (default 3)
 */
export function generateKaplanReadingQuestions(topicIds = null, perTopic = 3) {
  return generateKaplanQuestionsByTopic(KAPLAN_READING_TOPICS, topicIds, perTopic);
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
