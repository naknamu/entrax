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
// Per kaplan-entrance-exam-sections.txt: passages are 3-4 paragraphs long
// with several questions per passage, on general-interest topics (501
// Reading Comprehension Questions style), not nursing/medical subjects.
// Skills follow Week 1 of the vault reading-and-writing study plan and the
// kaplan-questions-guideline.txt reference: main idea & topic (D1),
// supporting details (D2), inferences (D3), purpose & point of view (D4),
// passage organization (D5), passage logic (D6). Each passage carries one
// question per skill; the passage text is embedded with the question.
// ---------------------------------------------------------------------------

const READING_PASSAGES = [
  {
    title: 'The Erie Canal',
    text: 'In the early 1800s, hauling goods across the Appalachian Mountains was slow and costly. Farmers in western New York could barely sell their crops because transportation consumed most of the profit. The state decided that a canal linking the Hudson River to Lake Erie could change that.\n\nConstruction began in 1817 and took eight years. Thousands of laborers, many of them Irish immigrants, dug the 363-mile waterway by hand. When the canal opened in 1825, the cost of shipping a ton of goods from Buffalo to New York City dropped from about $100 to under $10.\n\nThe canal transformed the region almost overnight. Villages along its route grew into busy cities, and New York City became the nation\u2019s leading port. Within a decade, tolls had repaid the entire cost of construction.\n\nThe canal\u2019s success inspired a wave of canal building across the country. Although railroads later made canals less important, the Erie Canal had already changed how Americans moved people and goods.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'The Erie Canal was a costly project that paid off by making transportation faster and cheaper and by transforming the region.',
        distractors: ['The Erie Canal was the first waterway ever built in the United States.', 'Irish immigrants refused to work on the canal because of the pay.', 'Railroads made the canal unnecessary before it was even finished.'],
        solution: 'The passage traces the canal from its costly construction to its success, showing how it repaid its cost and transformed the region.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, how long did construction of the Erie Canal take?',
        correct: 'Eight years',
        distractors: ['Four years', 'Ten years', 'Twenty years'],
        solution: 'The second paragraph states that construction began in 1817 and took eight years.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred from the passage that before the canal, farmers in western New York —',
        correct: 'had trouble selling their crops profitably',
        distractors: ['could ship goods cheaply to New York City', 'refused to grow any crops at all', 'preferred shipping goods by railroad'],
        solution: 'The first paragraph says transportation consumed most of the profit, so farmers could barely sell their crops.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'explain how the Erie Canal was built and why it mattered',
        distractors: ['persuade readers to visit New York State', 'criticize the workers who built the canal', 'compare the canal with modern railroads'],
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
        text: 'The information in the passage is organized mainly as —',
        correct: 'problem and solution',
        distractors: ['compare and contrast', 'a sequence of manufacturing steps', 'general to specific'],
        solution: 'The passage identifies the problem of costly transportation, presents the canal as the solution, and then describes the results.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would best conclude the passage?',
        correct: 'Today the canal is used mainly for recreation and stands as a reminder of an earlier era of transportation.',
        distractors: ['Most farmers now ship their goods by air.', 'The canal was never able to repay its cost.', 'New York City no longer has a port.'],
        solution: 'A conclusion that looks at the canal\u2019s present-day role follows the historical account naturally; the other choices contradict the passage.',
      },
    ],
  },
  {
    title: 'The Northern Lights',
    text: 'On clear nights near the poles, the sky sometimes glows with shifting curtains of green, red, and violet light. These displays, called auroras, have fascinated people for centuries and inspired countless myths.\n\nScientists now understand what causes them. The sun constantly releases a stream of charged particles. When these particles reach Earth, most are deflected by the planet\u2019s magnetic field, but some are channeled toward the poles, where they collide with gases in the upper atmosphere and make them glow.\n\nThe color of an aurora depends on which gas is struck. Oxygen produces green and red light, while nitrogen produces blue and purple. Green is the most common color because oxygen is plentiful high in the atmosphere.\n\nAuroras are more frequent during periods of intense solar activity, which follows an eleven-year cycle. In unusually strong displays, the lights can be seen far from the poles, surprising people in places where auroras are rare.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'Which statement best summarizes the passage?',
        correct: 'Auroras are colorful sky displays caused by charged particles from the sun colliding with gases in the upper atmosphere.',
        distractors: ['Auroras are caused by pollution in the atmosphere.', 'Auroras can only be seen once every eleven years.', 'Scientists know nothing about what causes auroras.'],
        solution: 'The passage explains what auroras are and the scientific reason behind them, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, what produces the green color in an aurora?',
        correct: 'Oxygen high in the atmosphere',
        distractors: ['Nitrogen', 'The moon', 'Clouds of dust'],
        solution: 'The third paragraph says oxygen produces green and red light.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that people far from the poles rarely see auroras because —',
        correct: 'the charged particles are usually concentrated near the poles',
        distractors: ['the lights only appear during the day', 'the magnetic field blocks all particles', 'those people never look at the sky'],
        solution: 'The second paragraph says the particles are channeled toward the poles, and the final paragraph notes that strong displays are needed for them to be seen farther away.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'explain the scientific cause of auroras',
        distractors: ['warn readers about solar storms', 'describe myths about the sun', 'persuade readers to travel to the poles'],
        solution: 'The passage focuses on how auroras are produced, so its purpose is to explain the science behind them.',
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
        text: 'How is the information in the passage organized?',
        correct: 'general to specific',
        distractors: ['chronological order', 'compare and contrast', 'problem and solution'],
        solution: 'The passage starts with a general description of auroras and then narrows to their causes, colors, and frequency.',
      },
      {
        skill: 'logic',
        text: 'Based on the passage, auroras would most likely be seen most often —',
        correct: 'during years of high solar activity',
        distractors: ['immediately after a thunderstorm', 'in the middle of the day', 'in equatorial regions'],
        solution: 'The final paragraph says auroras are more frequent during intense solar activity.',
      },
    ],
  },
  {
    title: 'The Pony Express',
    text: 'In 1860, sending a letter from Missouri to California took weeks by stagecoach or ship. The Pony Express was a bold attempt to deliver mail much faster: relays of riders on horseback would carry letters across nearly 2,000 miles in about ten days.\n\nThe service depended on hundreds of relay stations spaced about ten miles apart. A rider would gallop into a station, switch to a fresh horse, and continue. Riders were mostly young men, some barely teenagers, chosen for their light weight and riding skill.\n\nThe Pony Express was fast, but it was never profitable. Postage was high, and the service lost money from the start. It lasted only about eighteen months before the completion of the transcontinental telegraph made it obsolete.\n\nAlthough short-lived, the Pony Express became a lasting symbol of the American West. Its riders and their daring journeys are remembered in books, movies, and folklore far more than their business records would ever suggest.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'The Pony Express delivered mail faster than ever before, but it lasted only about eighteen months.',
        distractors: ['The Pony Express made its owners rich.', 'Riders delivered mail only within California.', 'The transcontinental telegraph was slower than the Pony Express.'],
        solution: 'The passage describes the service, its speed, and its brief life, which together form the main point.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, about how far apart were the relay stations?',
        correct: 'Ten miles',
        distractors: ['Two miles', 'Fifty miles', 'One hundred miles'],
        solution: 'The second paragraph says the stations were spaced about ten miles apart.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that riders changed horses at each station because —',
        correct: 'a single horse could not keep up the pace for the whole route',
        distractors: ['riders were paid for every horse they used', 'stations were used only once', 'horses could not cross the telegraph lines'],
        solution: 'Fresh horses at frequent stations allowed riders to keep moving at speed over a route far too long for one horse.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'describe the Pony Express and explain its short history',
        distractors: ['argue that the telegraph was a mistake', 'explain how to train young riders', 'compare stagecoaches with steamships'],
        solution: 'The passage recounts what the service was, how it worked, and why it ended, so its purpose is to describe its history.',
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
        text: 'The passage is organized mainly as —',
        correct: 'chronological order',
        distractors: ['compare and contrast', 'problem and solution', 'general to specific'],
        solution: 'The passage follows the service from its start in 1860 through its operation and end, so it is organized chronologically.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would best follow the final paragraph?',
        correct: 'The story of the riders continues to appear in films and novels today.',
        distractors: ['Riders were paid in gold coins.', 'The telegraph required wires and operators.', 'Most station managers were women.'],
        solution: 'The final paragraph is about the service\u2019s lasting fame, so a sentence noting its continuing presence in films and novels extends that idea.',
      },
    ],
  },
  {
    title: 'The Disappearing Honeybees',
    text: 'Honeybees pollinate billions of dollars\u2019 worth of crops each year, from apples and almonds to cucumbers and blueberries. Without them, many fruits and vegetables would become scarce and expensive.\n\nIn recent decades, beekeepers have reported losing unusually large numbers of colonies, a phenomenon known as colony collapse disorder. Researchers have identified several likely causes: pesticides that weaken bees\u2019 immune systems, parasites such as the varroa mite, and the loss of wildflower habitat to development.\n\nThese causes often act together. A hive weakened by mites may be unable to survive exposure to a pesticide, while a bee that cannot find enough diverse flowers becomes malnourished and more vulnerable to disease.\n\nThe consequences reach beyond the hive. Farmers in some regions now rent hives to ensure their crops are pollinated, and the price of those rentals has climbed. Scientists continue to study the problem, hoping that changes in farming practices can slow the decline.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'Honeybees are essential to food production, and a combination of factors is causing their numbers to decline.',
        distractors: ['Honeybees are the only insects that pollinate crops.', 'Colony collapse disorder has no known causes.', 'Beekeeping has become much easier in recent years.'],
        solution: 'The passage explains why honeybees matter and describes the causes and effects of their decline, which the first answer states.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, which of the following is a cause of colony collapse disorder?',
        correct: 'Pesticides that weaken bees\u2019 immune systems',
        distractors: ['The invention of the automobile', 'An increase in the number of beekeepers', 'A rise in the price of almonds'],
        solution: 'The second paragraph names pesticides, parasites such as the varroa mite, and loss of wildflower habitat as causes.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that a hive weakened by mites is more likely to suffer pesticide damage because —',
        correct: 'weakened bees are less able to withstand additional threats',
        distractors: ['mites are killed by most pesticides', 'pesticides attract more mites', 'beekeepers cannot see mites at all'],
        solution: 'The passage says a hive weakened by mites may be unable to survive exposure to a pesticide, so weakened bees are more vulnerable.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'explain why honeybee colonies are declining and why it matters',
        distractors: ['teach readers how to keep bees', 'argue that all pesticides should be banned immediately', 'describe the life cycle of the varroa mite'],
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
        text: 'The passage is organized mainly as —',
        correct: 'cause and effect',
        distractors: ['chronological order', 'compare and contrast', 'a sequence of manufacturing steps'],
        solution: 'The passage presents the causes of colony collapse and then their effects on farms and food prices.',
      },
      {
        skill: 'logic',
        text: 'Which sentence, if added, would best support the passage\u2019s main idea?',
        correct: 'Studies show that farms near healthy wildflower meadows need fewer rented hives.',
        distractors: ['Most honey is sold in glass jars.', 'Bees can sting more than once.', 'Honey was the only sweetener in ancient Egypt.'],
        solution: 'A statement linking habitat to hive health supports the passage\u2019s point that habitat loss contributes to the decline.',
      },
    ],
  },
  {
    title: 'How Blue Jeans Are Made',
    text: 'The blue jeans people wear today begin as cotton, which is cleaned, combed, and spun into yarn. The yarn is then woven into denim, a sturdy fabric with a diagonal ribbed pattern.\n\nThe fabric\u2019s blue color comes from indigo dye. In modern factories, the yarn is dipped in synthetic indigo and exposed to air, which makes the dye turn blue through oxidation. Only the outer threads are dyed, which is why jeans fade over time to reveal white threads underneath.\n\nAfter dyeing, the denim is cut into pattern pieces and sewn together. Rivets are added at stress points such as pockets to keep them from tearing. Finally, the finished jeans may be washed, stonewashed, or otherwise treated to achieve a particular look.\n\nThe entire process, from raw cotton to finished garment, involves many workers and machines, but the essential steps have changed little since jeans were first popularized more than a century ago.',
    questions: [
      {
        skill: 'mainIdea',
        text: 'What is the main idea of the passage?',
        correct: 'Making blue jeans involves a series of steps from raw cotton to finished garment.',
        distractors: ['Blue jeans are always dyed black.', 'Denim is woven only by hand.', 'Jeans never fade no matter how they are washed.'],
        solution: 'The passage walks through each stage of jeans production, from cotton to the finished product.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, why are rivets added to jeans?',
        correct: 'To keep pockets from tearing at stress points',
        distractors: ['To make the jeans heavier', 'To help the dye set', 'To allow the fabric to stretch'],
        solution: 'The third paragraph says rivets are added at stress points such as pockets to keep them from tearing.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that jeans fade because —',
        correct: 'only the outer threads of the yarn are dyed',
        distractors: ['the dye is removed in the factory', 'indigo dissolves in water', 'the fabric is bleached every day'],
        solution: 'The second paragraph explains that only the outer threads are dyed, so wear reveals undyed white threads underneath.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'describe the process by which blue jeans are manufactured',
        distractors: ['persuade readers to buy jeans', 'compare jeans with other clothing', 'explain why jeans are expensive'],
        solution: 'The passage describes each step of production, so its purpose is to explain how jeans are made.',
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
        text: 'The information in the passage is organized mainly as —',
        correct: 'a sequence of steps in a process',
        distractors: ['compare and contrast', 'problem and solution', 'chronological history of a company'],
        solution: 'The passage follows the manufacturing steps from cotton to finished jeans in order.',
      },
      {
        skill: 'logic',
        text: 'Which sentence would fit best after the final paragraph?',
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
        text: 'What is the main idea of the passage?',
        correct: 'Mars and Earth share some features but differ greatly, and scientists study Mars to learn about its past.',
        distractors: ['Mars has an atmosphere identical to Earth\u2019s.', 'Scientists have found living things on Mars.', 'Mars and Earth have nothing in common.'],
        solution: 'The passage covers both the similarities and differences between the planets and explains why Mars is studied.',
      },
      {
        skill: 'detail',
        text: 'According to the passage, which feature do Mars and Earth share?',
        correct: 'Polar ice caps and seasons',
        distractors: ['Thick, oxygen-rich atmospheres', 'Liquid water on the surface', 'Identical average temperatures'],
        solution: 'The first paragraph lists polar ice caps, seasons, and volcanoes as features shared by both planets.',
      },
      {
        skill: 'inference',
        text: 'It can be inferred that liquid water cannot persist on the surface of Mars today because —',
        correct: 'the surface pressure is too low',
        distractors: ['the planet receives no sunlight', 'rovers removed all the water', 'volcanoes dried the planet out'],
        solution: 'The second paragraph says surface pressure is so low that liquid water cannot persist.',
      },
      {
        skill: 'purpose',
        text: 'The author\u2019s primary purpose is to —',
        correct: 'compare Earth and Mars and explain why Mars interests scientists',
        distractors: ['argue that Mars should be left unexplored', 'describe the moons of Mars', 'explain how to build a spaceship'],
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
        text: 'The passage is organized mainly as —',
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
