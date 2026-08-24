/**
 * Verify procedural reading passage generation quality + uniqueness.
 * Usage: node tests/verify-procedural-reading.mjs
 * Checks 150 generations: unique titles & texts, 4 paragraphs, all 7 skills,
 * 4 distinct choices per question, solutions present, detail-question answers
 * appearing verbatim in the passage text, no double-region sentences, and the
 * full 10-domain × 5-structure template surface.
 */
import { generateProceduralReadingPassage, readingTemplateCount } from '../js/reading-generator.js';

const allSkills = ['mainIdea', 'detail', 'inference', 'purpose', 'pov', 'organization', 'logic'];
const titles = new Set();
const texts = new Set();
let para = 0;
let skill = 0;
let choice = 0;
let sol = 0;
let fact = 0;
let doubleRegion = 0;
const structs = new Set();
const tones = new Set();

for (let i = 0; i < 150; i++) {
  const p = generateProceduralReadingPassage();
  titles.add(p.title);
  texts.add(p.text);
  if (p.text.split('\n\n').length !== 4) para++;
  const skills = p.questions.map((q) => q.skill);
  if (skills.length !== 7 || !allSkills.every((s) => skills.includes(s))) skill++;
  const low = p.text.toLowerCase();
  for (const q of p.questions) {
    if (new Set([q.correct, ...q.distractors]).size !== 4) choice++;
    if (!q.solution) sol++;
    if (q.skill === 'detail' && !low.includes(q.correct.toLowerCase())) fact++;
  }
  // no "the farmers of Millbrook Valley in the Millbrook Valley" style repeats
  if (/ of [A-Z][a-z]+ in (the )?[A-Z]/.test(p.text)) doubleRegion++;
  structs.add(p.questions.find((q) => q.skill === 'organization').correct);
  tones.add(p.questions.find((q) => q.skill === 'pov').correct);
}

const templateCount = readingTemplateCount();
console.log(`templates: ${templateCount} (expected 50 = 10 domains × 5 structures)`);
console.log(`structures reached: ${structs.size}/5`);
console.log(`distinct tone answers (domain coverage proxy): ${tones.size}`);
console.log(`unique titles: ${titles.size}/150 | unique texts: ${texts.size}/150`);
console.log(`paraIssues: ${para} | skillIssues: ${skill} | choiceIssues: ${choice} | solIssues: ${sol} | detailFactMisses: ${fact} | doubleRegion: ${doubleRegion}`);

const pass =
  templateCount === 50 &&
  structs.size === 5 &&
  titles.size === 150 &&
  texts.size === 150 &&
  para === 0 &&
  skill === 0 &&
  choice === 0 &&
  sol === 0 &&
  fact === 0 &&
  doubleRegion === 0;
console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
