/**
 * Verify procedural reading passage generation quality + uniqueness.
 * Usage: node tests/verify-procedural-reading.mjs
 * Checks 150 generations: unique titles & texts, 4 paragraphs, all 7 skills,
 * 4 distinct choices per question, solutions present, and detail-question
 * answers appearing verbatim in the passage text.
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
}

console.log(`templates: ${readingTemplateCount()} (3 domains × 2 structures)`);
console.log(`unique titles: ${titles.size}/150 | unique texts: ${texts.size}/150`);
console.log(`paraIssues: ${para} | skillIssues: ${skill} | choiceIssues: ${choice} | solIssues: ${sol} | detailFactMisses: ${fact}`);

const pass =
  titles.size === 150 &&
  texts.size === 150 &&
  para === 0 &&
  skill === 0 &&
  choice === 0 &&
  sol === 0 &&
  fact === 0;
console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
