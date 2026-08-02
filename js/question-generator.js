/**
 * Kaplan Math Question Generator
 * ----------------------------------------------------------------------------
 * Generates ORIGINAL, randomized math questions in the style of the Kaplan
 * Nursing Entrance Exam (Math section). Topics:
 *
 *   fractions (+ - x /), simplifying fractions, fraction word problems,
 *   exponents, algebra, ratio & proportion, decimals, unit conversions,
 *   percentages.
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
function buildQuestion(category, text, correct, distractors) {
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
  };
}

// ---------------------------------------------------------------------------
// Topic generators. Each returns an array of { text, category, correct, distractors }.
// ---------------------------------------------------------------------------

/** Addition / subtraction / multiplication / division of fractions. */
function genFractionOperations(count) {
  const out = [];
  const ops = [
    {
      name: 'add',
      symbol: '+',
      compute: (a, b, c, d) => a * d + c * b,
      den: (a, b, c, d) => b * d,
      extra: (a, b, c, d) => [[a + c, b + d], [a * c, b * d], [a * d - c * b, b * d]],
    },
    {
      name: 'subtract',
      symbol: '-',
      compute: (a, b, c, d) => a * d - c * b,
      den: (a, b, c, d) => b * d,
      extra: (a, b, c, d) => [[a + c, b + d], [a * c, b * d], [a * d + c * b, b * d]],
    },
    {
      name: 'multiply',
      symbol: '×',
      compute: (a, b, c, d) => a * c,
      den: (a, b, c, d) => b * d,
      extra: (a, b, c, d) => [[a * c, b + d], [a + c, b + d], [a * d + c * b, b * d]],
    },
    {
      name: 'divide',
      symbol: '÷',
      compute: (a, b, c, d) => a * d,
      den: (a, b, c, d) => b * c,
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
      };
    },
    (k) => {
      const total = 60 * k;
      return {
        text: `Of the ${total} patients in a ward, 2/5 are scheduled for morning procedures. How many patients is that?`,
        correct: (2 * total) / 5,
        distractors: [total / 5, (3 * total) / 5, (2 * total) / 3],
      };
    },
    (k) => {
      const total = 8 * k;
      return {
        text: `A nurse completes 3/4 of a ${total}-hour shift before taking a break. How many hours were completed?`,
        correct: (3 * total) / 4,
        distractors: [total / 4, (total * 2) / 3, total],
      };
    },
    (k) => {
      const total = 100 * k;
      return {
        text: `A patient drinks 7/10 of a ${total} mL glass of water. How many mL were consumed?`,
        correct: (7 * total) / 10,
        distractors: [(3 * total) / 10, total / 10, total],
      };
    },
  ];
  for (let n = 0; n < count; n++) {
    const t = templates[rndInt(0, templates.length - 1)](rndInt(1, 4));
    out.push({
      text: t.text,
      category: 'Fractions (Word Problems)',
      correct: String(t.correct),
      distractors: t.distractors.map(String),
    });
  }
  return out;
}

/** Exponents: evaluate powers and order-of-operations expressions. */
function genExponents(count) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const kind = rndInt(0, 2);
    if (kind === 0) {
      const base = rndInt(2, 10);
      const exp = rndInt(2, 4);
      const correct = Math.pow(base, exp);
      out.push({
        text: `Evaluate: ${base}^${exp}`,
        category: 'Exponents',
        correct: String(correct),
        distractors: [String(base * exp), String(Math.pow(base, exp - 1)), String(Math.pow(base, exp + 1))],
      });
    } else if (kind === 1) {
      const base = rndInt(2, 6);
      const exp = rndInt(2, 3);
      const add = rndInt(1, 9);
      const correct = add + Math.pow(base, exp);
      out.push({
        text: `Evaluate: ${add} + ${base}^${exp}`,
        category: 'Exponents',
        correct: String(correct),
        distractors: [String(Math.pow(add + base, exp)), String(add + base * exp), String(correct - 1)],
      });
    } else {
      const base = rndInt(2, 6);
      const exp = rndInt(2, 3);
      const sub = rndInt(1, 9);
      const correct = Math.pow(base, exp) - sub;
      out.push({
        text: `Evaluate: ${base}^${exp} − ${sub}`,
        category: 'Exponents',
        correct: String(correct),
        distractors: [String(Math.pow(base, exp) + sub), String(Math.pow(base - sub, exp)), String(correct + 1)],
      });
    }
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
        category: 'Algebra',
        correct: String(x),
        distractors: [String(x + 1), String(x - 1), String(c - b - a)],
      });
    } else if (kind === 1) {
      const x = rndInt(2, 9);
      const a = rndInt(2, 6);
      const b = rndInt(1, 9);
      const correct = a * x - b;
      out.push({
        text: `If x = ${x}, evaluate ${a}x − ${b}`,
        category: 'Algebra',
        correct: String(correct),
        distractors: [String(a * x + b), String(x - b), String(a * x)],
      });
    } else {
      const x = rndInt(2, 9);
      const d = rndInt(2, 6);
      const correct = x * d;
      out.push({
        text: `Solve for x: x/${d} = ${x}`,
        category: 'Algebra',
        correct: String(correct),
        distractors: [String(x + d), String(x * d + 1), String(d)],
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
        category: 'Ratio & Proportion',
        correct: String(x),
        distractors: [String(x + b), String(x - a), String(a)],
      });
    } else if (kind === 1) {
      const nurses = rndInt(2, 6);
      const patients = rndInt(4, 10);
      const k = rndInt(3, 8);
      out.push({
        text: `The nurse-to-patient ratio is ${nurses}:${patients}. How many nurses are needed for ${patients * k} patients?`,
        category: 'Ratio & Proportion',
        correct: String(nurses * k),
        distractors: [String(patients * k / nurses), String(nurses * k + 1), String(nurses + k)],
      });
    } else {
      const a = rndInt(2, 5);
      const b = rndInt(2, 5);
      const k = rndInt(2, 6);
      out.push({
        text: `A solution mixes ${a} parts saline to ${b} parts water. If the total volume is ${(a + b) * k} mL, how many mL are saline?`,
        category: 'Ratio & Proportion',
        correct: String(a * k),
        distractors: [String(b * k), String((a + b) * k / a), String(a * k + 1)],
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
      category: 'Conversions',
      correct,
      distractors: [
        fmtDec(u.div ? value * u.factor : value / u.factor),
        fmtDec(Number(correct) * 10),
        fmtDec(Number(correct) / 10),
      ].filter((v) => v !== correct),
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
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const KAPLAN_MATH_TOPICS = [
  { id: 'fractions', label: 'Fractions (+ − × ÷)', gen: genFractionOperations },
  { id: 'simplify', label: 'Simplifying Fractions', gen: genSimplifyFractions },
  { id: 'fractionWords', label: 'Fraction Word Problems', gen: genFractionWordProblems },
  { id: 'exponents', label: 'Exponents', gen: genExponents },
  { id: 'algebra', label: 'Algebra', gen: genAlgebra },
  { id: 'ratio', label: 'Ratio & Proportion', gen: genRatioProportion },
  { id: 'decimals', label: 'Decimals', gen: genDecimals },
  { id: 'conversions', label: 'Conversions', gen: genConversions },
  { id: 'percentages', label: 'Percentages', gen: genPercentages },
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
      questions.push(buildQuestion(q.category, q.text, q.correct, q.distractors));
    }
  }
  return questions;
}
