/**
 * Verify reading generation integration: static pool first, procedural fill,
 * cross-round uniqueness, passageTitle tagging.
 * Usage: node tests/verify-procedural-integration.mjs
 */
import { generateKaplanReadingQuestions, getReadingPassageTitles } from '../js/question-generator.js';

const all = getReadingPassageTitles();

// 1) clean pool -> 6 static passages, 42 questions
const q1 = generateKaplanReadingQuestions(null, 6, []);
const t1 = new Set(q1.map((q) => q.passageTitle));
const cleanAllStatic = [...t1].every((t) => all.includes(t));

// 2) static bank fully excluded -> all procedural, still 42 questions
const q2 = generateKaplanReadingQuestions(null, 6, all);
const t2 = new Set(q2.map((q) => q.passageTitle));
const exhaustedAllProcedural = [...t2].every((t) => !all.includes(t));

// 3) 8 excluded -> 2 static + 4 procedural
const q3 = generateKaplanReadingQuestions(null, 6, all.slice(0, 8));
const t3 = new Set(q3.map((q) => q.passageTitle));
const partialStatic = [...t3].filter((t) => all.includes(t)).length;

// 4) two procedural rounds never share a passage
const a = generateKaplanReadingQuestions(null, 6, all);
const b = generateKaplanReadingQuestions(null, 6, all);
const overlap = a.filter((q) => b.some((x) => x.passage === q.passage)).length;

// 5) every generated question carries passage + passageTitle
const allTagged = [...q2].every((q) => q.passageTitle && q.passage);

console.log(`clean: ${q1.length}q / ${t1.size} passages (all static: ${cleanAllStatic})`);
console.log(`exhausted: ${q2.length}q / ${t2.size} passages (all procedural: ${exhaustedAllProcedural})`);
console.log(`8 excluded: ${q3.length}q / ${t3.size} passages (static ${partialStatic} + procedural ${6 - partialStatic})`);
console.log(`two procedural rounds overlap: ${overlap} | tagged: ${allTagged}`);

const pass =
  q1.length === 42 && t1.size === 6 && cleanAllStatic &&
  q2.length === 42 && t2.size === 6 && exhaustedAllProcedural &&
  q3.length === 42 && t3.size === 6 && partialStatic === 2 &&
  overlap === 0 && allTagged;
console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
