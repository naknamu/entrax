/**
 * Procedural Reading Passage Generator
 * ----------------------------------------------------------------------------
 * Builds unique, coherent multi-paragraph reading passages and their seven
 * comprehension questions (mainIdea, detail, inference, purpose, pov,
 * organization, logic) from template banks — no AI, no external calls.
 *
 * Each template pairs a DOMAIN (historical_event, natural_phenomenon,
 * invention) with a NARRATIVE STRUCTURE (chronological, cause_effect).
 * Fillers are drawn from per-domain banks with a fresh random seed on every
 * call, so no two passages share text or story. Titles are re-rolled when
 * they collide with already-used titles, and the combinator space is large
 * enough that repeats are effectively impossible.
 *
 * This is the incremental milestone: 3 domains × 2 structures = 6 templates.
 * Extend DOMAINS/TEMPLATES and the banks below to expand.
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32). Returns a function producing [0,1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [0,1) — unique seed per call so every passage differs. */
function freshRng() {
  return mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Pick n distinct items, never including `exclude` (when given). */
function pickN(pool, n, rng, exclude = []) {
  const ex = new Set(exclude.map(String));
  const avail = pool.filter((x) => !ex.has(x));
  const out = [];
  while (out.length < n && avail.length) {
    const i = Math.floor(rng() * avail.length);
    out.push(avail.splice(i, 1)[0]);
  }
  return out;
}

/** Shuffle a copy of an array. */
function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Capitalize the first letter of a string. */
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Pick 3 plausible-but-wrong options from a bank of phrases. */
function wrongs(pool, correct, rng) {
  return pickN(pool, 3, rng, [correct]).map((w) => (typeof w === 'object' ? w.text : w));
}

// ---------------------------------------------------------------------------
// Shared question stems (varied phrasing per skill)
// ---------------------------------------------------------------------------

const STEMS = {
  mainIdea: [
    'Which of the following BEST expresses the main idea of the passage?',
    'What is the passage mainly about?',
  ],
  purpose: [
    'What is the author\u2019s main purpose in writing this passage?',
    'Why did the author write this passage?',
  ],
  pov: [
    'The author\u2019s attitude toward the subject is best described as —',
    'The author\u2019s tone in this passage is best described as —',
  ],
  organization: [
    'How is this passage primarily organized?',
    'Which statement BEST describes the structure of this passage?',
  ],
  logic: [
    'Which of the following would be the BEST title for this passage?',
    'Which title best fits this passage?',
  ],
};

// ---------------------------------------------------------------------------
// Filler banks — one per domain. Phrases are written to slot into the
// template sentences grammatically (past-tense clauses, gerunds, etc.).
// ---------------------------------------------------------------------------

const BANKS = {
  historical_event: {
    casts: [
      { subject: 'the farmers of Millbrook Valley', people: 'farmers', region: 'the Millbrook Valley', regionName: 'Millbrook Valley', livelihood: 'farming the rich bottomland' },
      { subject: 'the merchants of Port Harrow', people: 'merchants', region: 'the coastal town of Port Harrow', regionName: 'Port Harrow', livelihood: 'shipping goods along the river' },
      { subject: 'the settlers of the Wind River basin', people: 'settlers', region: 'the Wind River basin', regionName: 'the Wind River basin', livelihood: 'working the new homesteads' },
      { subject: 'the weavers of Ashford', people: 'weavers', region: 'the town of Ashford', regionName: 'Ashford', livelihood: 'making cloth for the surrounding counties' },
      { subject: 'the miners of Copper Falls', people: 'miners', region: 'Copper Falls', regionName: 'Copper Falls', livelihood: 'digging ore from the nearby hills' },
      { subject: 'the millers of Grey Hollow', people: 'millers', region: 'the Grey Hollow valley', regionName: 'Grey Hollow', livelihood: 'grinding grain for the valley towns' },
      { subject: 'the fishers of the Salt Coast', people: 'fishers', region: 'the Salt Coast', regionName: 'the Salt Coast', livelihood: 'harvesting the inshore waters' },
      { subject: 'the orchard keepers of Redfield', people: 'orchard keepers', region: 'the Redfield hills', regionName: 'Redfield', livelihood: 'tending the apple orchards' },
    ],
    times: ['the early 1800s', 'the mid-1880s', 'the late 1890s', 'the 1910s', 'the early 1920s', 'the 1930s', 'the late 1940s', 'the 1950s', 'the early 1960s', 'the mid-1970s', 'the late 1980s', 'the early 2000s'],
    durations: ['nearly a decade', 'about three years', 'a little more than two winters', 'the better part of a decade', 'almost five years', 'a single harsh season', 'roughly a generation', 'two long planting seasons'],
    triggers: [
      { first: 'a severe drought', later: 'the severe drought' },
      { first: 'a sudden collapse in market prices', later: 'the collapse in market prices' },
      { first: 'a devastating flood', later: 'the devastating flood' },
      { first: 'a heavy new tax on their trade', later: 'the heavy new tax' },
      { first: 'a failed harvest', later: 'the failed harvest' },
      { first: 'the sudden closing of the region\u2019s main rail line', later: 'the closed rail line' },
      { first: 'a prolonged frost', later: 'the prolonged frost' },
      { first: 'an outbreak of disease among the livestock', later: 'the outbreak of disease' },
      { first: 'a bitter dispute over water rights', later: 'the dispute over water rights' },
      { first: 'a sudden surge of newcomers', later: 'the surge of newcomers' },
    ],
    challenges: [
      { first: 'a shortage of tools and materials', later: 'the shortage of tools and materials' },
      { first: 'a stubbornly rocky terrain', later: 'the rocky terrain' },
      { first: 'resistance from distant officials', later: 'the resistance from distant officials' },
      { first: 'a winter that refused to end', later: 'the long winter' },
      { first: 'a lack of skilled labor', later: 'the lack of skilled labor' },
      { first: 'constant breakdowns of their equipment', later: 'the constant breakdowns' },
      { first: 'a rival community that undercut their prices', later: 'the rival community' },
      { first: 'deepening debts', later: 'the deepening debts' },
    ],
    responses: [
      'organizing a shared system of irrigation canals',
      'pooling their savings and rebuilding the workshops',
      'experimenting with new methods of cultivation',
      'establishing a cooperative market of their own',
      'negotiating a truce with their rivals',
      'turning to a forgotten trade route',
      'rebuilding the settlement on higher ground',
      'forming a committee to manage the water supply',
    ],
    results: [
      'harvests doubled within two seasons',
      'the town\u2019s fortunes were restored within a few years',
      'prices stabilized and trade returned to the region',
      'the settlement grew into a bustling market town',
      'their goods were soon sought after across the province',
      'the community became known for its quiet resilience',
    ],
    significances: [
      'The story of the recovery became a model for neighboring communities.',
      'The methods they developed were later adopted far beyond the region.',
      'The episode reshaped how the district managed its resources.',
      'Historians still point to the period as a turning point for the region.',
      'The experience laid the groundwork for decades of steady growth.',
      'The change left a lasting mark on the region\u2019s identity.',
    ],
    causes: [
      'a sharp rise in the cost of supplies',
      'the loss of their usual markets',
      'a series of unusually hard winters',
      'new rules that favored larger competitors',
    ],
    effects: [
      'food became scarce and prices climbed',
      'work slowed and savings ran low',
      'families began to leave the district',
      'the fields and workshops fell silent',
    ],
    timeframes: ['a single season', 'a few months', 'one harsh winter', 'a matter of weeks'],
    titleAdj: ['Unlikely', 'Great', 'Quiet', 'Remarkable', 'Ambitious', 'Lasting', 'Stubborn', 'Forgotten'],
    titleNoun: ['Recovery', 'Rebuilding', 'Comeback', 'Resurgence', 'Transformation', 'Renaissance', 'Rebirth'],
  },

  natural_phenomenon: {
    casts: [
      { subject: 'a team of marine biologists', people: 'researchers', region: 'the Gray Coast', regionName: 'the Gray Coast', phenomenon: 'the migrating whales' },
      { subject: 'a group of ecologists', people: 'researchers', region: 'the Tanabe Islands', regionName: 'the Tanabe Islands', phenomenon: 'the coral reefs' },
      { subject: 'a small expedition of glaciologists', people: 'researchers', region: 'the northern mountain range', regionName: 'the northern range', phenomenon: 'the valley glaciers' },
      { subject: 'a team of field botanists', people: 'researchers', region: 'the eastern delta', regionName: 'the eastern delta', phenomenon: 'the salt marshes' },
      { subject: 'a pair of entomologists', people: 'researchers', region: 'the river valley', regionName: 'the river valley', phenomenon: 'the firefly swarms' },
      { subject: 'a group of coastal ecologists', people: 'researchers', region: 'Blackrock Cove', regionName: 'Blackrock Cove', phenomenon: 'the tide pools' },
      { subject: 'a team of ornithologists', people: 'researchers', region: 'the outer islands', regionName: 'the outer islands', phenomenon: 'the seabird colonies' },
      { subject: 'a group of freshwater biologists', people: 'researchers', region: 'Lake Verdan', regionName: 'Lake Verdan', phenomenon: 'the lake\u2019s clear-water algae' },
    ],
    times: ['the early 1960s', 'the late 1970s', 'the mid-1980s', 'the early 1990s', 'the late 1990s', 'the early 2000s', 'the mid-2010s', 'the late 2010s'],
    durations: ['three field seasons', 'several years of study', 'a decade of careful observation', 'two consecutive summers', 'more than five years'],
    responses: [
      'tracking the animals closely each season',
      'comparing new records with data from earlier decades',
      'mapping the changes across the whole region',
      'following the pattern year after year',
      'testing samples from many different sites',
      'revisiting the same locations at the same time each year',
    ],
    triggers: [
      { first: 'a dramatic drop in the annual count', later: 'the dramatic drop in the annual count' },
      { first: 'an unusually warm stretch of seasons', later: 'the unusually warm stretch' },
      { first: 'a sudden shift in the animals\u2019 usual route', later: 'the shift in the animals\u2019 route' },
      { first: 'a series of storms that battered the coastline', later: 'the series of storms' },
      { first: 'a sharp increase in visitors to the area', later: 'the sharp increase in visitors' },
      { first: 'a puzzling change in the water itself', later: 'the puzzling change in the water' },
      { first: 'the sudden appearance of a new predator', later: 'the sudden appearance of the new predator' },
    ],
    findings: [
      'the creatures were taking a different route every year',
      'the population had dropped sharply in a single season',
      'the growth patterns had shifted by several weeks',
      'the numbers were recovering in some parts of the area and collapsing in others',
      'the change was linked to conditions far out at sea',
      'the pattern repeated at the same time each year, but grew weaker over time',
    ],
    confirmations: [
      'the change was tied to a slow rise in water temperature',
      'the timing of the yearly cycle had drifted by nearly a month',
      'the animals were responding to a shift in the food supply',
      'the damage had been caused by activity much closer to shore',
    ],
    significances: [
      'Their findings changed how the region managed its coastline.',
      'The study became a standard reference for later research.',
      'Local officials used the data to protect the area for the future.',
      'The work drew attention from scientists around the world.',
      'The records they kept still guide conservation efforts today.',
      'The discovery reshaped what scientists thought they knew about the area.',
    ],
    titleAdj: ['Vanishing', 'Restless', 'Silent', 'Changing', 'Hidden', 'Shifting', 'Quiet', 'Returning'],
    titleNoun: ['Migrations', 'Patterns', 'Cycles', 'Signals', 'Waters', 'Seasons', 'Tides'],
  },

  invention: {
    casts: [
      { subject: 'a young watchmaker in the town of Brindle', people: 'inventor', region: 'the town of Brindle', regionName: 'Brindle', craft: 'watchmaking', object: 'a new kind of timepiece' },
      { subject: 'a retired rail engineer in Darwen', people: 'inventor', region: 'the city of Darwen', regionName: 'Darwen', craft: 'railway engineering', object: 'a safer braking system' },
      { subject: 'a farm mechanic from the Hillcrest district', people: 'inventor', region: 'the Hillcrest district', regionName: 'Hillcrest', craft: 'farm machinery', object: 'a lighter harvesting tool' },
      { subject: 'a schoolteacher in the port city of Orman', people: 'inventor', region: 'the port city of Orman', regionName: 'Orman', craft: 'instrument making', object: 'a more accurate measuring device' },
      { subject: 'a tinkerer working out of a shed in Coalbrook', people: 'inventor', region: 'the mill town of Coalbrook', regionName: 'Coalbrook', craft: 'machine repair', object: 'a self-regulating engine valve' },
      { subject: 'a young chemist in the factory district of Kern', people: 'inventor', region: 'the factory district of Kern', regionName: 'Kern', craft: 'industrial chemistry', object: 'a longer-lasting dye' },
      { subject: 'a signal operator on the North Line', people: 'inventor', region: 'the North Line railway', regionName: 'the North Line', craft: 'signaling', object: 'an automatic warning device' },
      { subject: 'a cooper in the harbor town of Sedgewick', people: 'inventor', region: 'the harbor town of Sedgewick', regionName: 'Sedgewick', craft: 'barrel making', object: 'a watertight container for long voyages' },
    ],
    times: ['the 1840s', 'the 1860s', 'the late 1870s', 'the 1890s', 'the early 1900s', 'the 1920s', 'the late 1930s', 'the 1950s', 'the early 1960s', 'the mid-1980s'],
    durations: ['nearly a decade', 'several years', 'about two years', 'more than three years', 'a long series of winters', 'the better part of a decade'],
    problems: [
      { first: 'a frustrating lack of accuracy in existing designs', later: 'the lack of accuracy in existing designs' },
      { first: 'a dangerous weakness in the equipment then in use', later: 'the weakness in the equipment' },
      { first: 'a costly inefficiency that every workshop accepted', later: 'the costly inefficiency' },
      { first: 'a problem that had defeated every attempt to solve it', later: 'the stubborn problem' },
      { first: 'a flaw that left the current devices unreliable', later: 'the flaw in the current devices' },
    ],
    triggers: [
      { first: 'a chance remark from a traveling mechanic', later: 'the chance remark' },
      { first: 'a lucky accident in the workshop', later: 'the lucky accident' },
      { first: 'an order from a customer who demanded something better', later: 'the demanding customer' },
      { first: 'a small but telling failure of the old design', later: 'the failure of the old design' },
      { first: 'a suggestion buried in an old technical manual', later: 'the old technical manual' },
      { first: 'a race against a rival workshop', later: 'the rivalry with the other workshop' },
    ],
    responses: [
      'testing a series of new designs',
      'taking the device apart and rebuilding it piece by piece',
      'sketching dozens of variations before settling on one',
      'combining two older ideas into something entirely new',
      'keeping a careful record of every failure',
      'borrowing techniques from a completely different trade',
    ],
    detailSentences: [
      'Each version was lighter and more reliable than the last.',
      'The first attempts failed, but each failure pointed the way forward.',
      'What seemed like a small improvement turned out to be the key.',
      'The design looked simple, yet it had taken years to perfect.',
      'Friends doubted the project would ever work.',
    ],
    results: [
      'the device worked better than anyone had expected',
      'orders began arriving from workshops far outside the town',
      'the invention was soon copied across the country',
      'the new design cut the old costs in half',
      'the workshop could barely keep up with demand',
    ],
    significances: [
      'The invention changed the trade forever.',
      'Its principles were later applied to dozens of other machines.',
      'The story became an example of what patient tinkering could achieve.',
      'Within a decade, the design was standard equipment everywhere.',
      'The device outlasted every rival that appeared in its first years.',
    ],
    titleAdj: ['Forgotten', 'Remarkable', 'Unlikely', 'Clever', 'Quiet', 'Daring', 'Simple', 'Enduring'],
    titleNoun: ['Device', 'Machine', 'Invention', 'Breakthrough', 'Design', 'Mechanism', 'Solution'],
  },
};

// ---------------------------------------------------------------------------
// Domain flavor — phrasing used by the shared question builders so questions
// match each domain's story (recovery / discovery / invention).
// ---------------------------------------------------------------------------

const FLAVOR = {
  historical_event: {
    toneCorrect: (F) => `admiring of the community\u2019s determination`,
    toneWrongs: (F) => [
      'dismissive of the community\u2019s efforts',
      'angry about the region\u2019s mistakes',
      'completely uninterested in the region\u2019s history',
    ],
    toneWhy: (F) => `The passage emphasizes how the people worked together to overcome hardship, so the author\u2019s attitude is admiring.`,
    purpose: (F) => `explain how ${F.trigger.later} threatened ${F.regionName} and how ${F.subject} rebuilt the region\u2019s fortunes`,
    purposeWrongs: (F) => [
      `persuade readers to move to ${F.regionName}`,
      `criticize the leaders of ${F.regionName} for their decisions`,
      `compare ${F.regionName} with regions that never faced such difficulties`,
    ],
    inferenceCorrect: (F) => `the ${F.people} would have continued to struggle, and ${F.regionName} would not have seen the recovery described in the passage`,
    inferenceWrongs: (F) => [
      `the ${F.people} would have prospered without making any changes`,
      `${F.regionName} would have recovered even faster on its own`,
      `the ${F.people} would have abandoned ${F.regionName} altogether`,
    ],
    inferenceWhy: (F) => `the events of the passage were set in motion by ${F.trigger.later} and the community\u2019s response to it`,
    titleSummary: (F) => `the way ${F.subject} recovered from ${F.trigger.later}`,
  },
  natural_phenomenon: {
    toneCorrect: (F) => `respectful of the researchers\u2019 careful work`,
    toneWrongs: (F) => [
      'dismissive of the research as unimportant',
      'alarmed without offering any evidence',
      'amused by the researchers\u2019 efforts',
    ],
    toneWhy: (F) => `The passage describes the team\u2019s careful observations and the value of their findings, so the tone is respectful.`,
    purpose: (F) => `explain how researchers came to understand ${F.phenomenon} and why the discovery mattered`,
    purposeWrongs: (F) => [
      `persuade readers to visit ${F.regionName}`,
      `argue that the researchers wasted their time`,
      `compare ${F.regionName} with regions in other countries`,
    ],
    inferenceCorrect: (F) => `the change to ${F.phenomenon} would have gone unnoticed for much longer, and the region might not have protected the area in time`,
    inferenceWrongs: (F) => [
      `the researchers would have reached the same conclusion much sooner`,
      `${F.phenomenon} would have recovered on their own without any study`,
      `the findings would have mattered even more than they did`,
    ],
    inferenceWhy: (F) => `the study of ${F.phenomenon} began only after ${F.trigger.later} drew the researchers\u2019 attention`,
    titleSummary: (F) => `the changing patterns of ${F.phenomenon} and what researchers discovered about them`,
  },
  invention: {
    toneCorrect: (F) => `admiring of the inventor\u2019s patience and skill`,
    toneWrongs: (F) => [
      'skeptical that the invention was worth the effort',
      'dismissive of the inventor\u2019s methods',
      'indifferent to the invention\u2019s later impact',
    ],
    toneWhy: (F) => `The passage highlights the inventor\u2019s persistence and the device\u2019s lasting success, so the tone is admiring.`,
    purpose: (F) => `explain how ${F.object} came to be invented and why it mattered`,
    purposeWrongs: (F) => [
      `persuade readers to buy ${F.object}`,
      `criticize the workshops that rejected the new design`,
      `compare ${F.object} with modern machines`,
    ],
    inferenceCorrect: (F) => `${F.object} might never have been built, and the trade would have kept struggling with the same old problems`,
    inferenceWrongs: (F) => [
      `the invention would have appeared even earlier without the delay`,
      `the old designs would have worked just as well`,
      `the inventor would have abandoned the project and moved on`,
    ],
    inferenceWhy: (F) => `the inventor\u2019s breakthrough came only after ${F.trigger.later} pushed the work forward`,
    titleSummary: (F) => `the long effort behind ${F.object} and the change it brought to ${F.craft}`,
  },
};

// ---------------------------------------------------------------------------
// Shared question builders — one per Kaplan reading skill. Each reads the
// derived fields on F that the template's make() populated.
// ---------------------------------------------------------------------------

function buildMainIdea(F, rng) {
  return {
    skill: 'mainIdea',
    text: pick(STEMS.mainIdea, rng),
    correct: cap(F.thesis),
    distractors: F.thesisWrongs.map(cap),
    solution: `The passage traces how ${F.trigger.later} affected ${F.regionName} and explains the response, so the best statement of the main idea is: ${F.thesis}.`,
  };
}

function buildDetail(F, rng) {
  const d = pick(F.detailQA, rng);
  return {
    skill: 'detail',
    text: d.q,
    correct: d.a,
    distractors: d.wrongs,
    solution: `Paragraph ${d.para} of the passage states that ${d.a}.`,
  };
}

function buildInference(F, rng) {
  const inf = F.inference;
  return {
    skill: 'inference',
    text: inf.q,
    correct: cap(inf.correct),
    distractors: inf.wrongs.map(cap),
    solution: `The passage explains that ${inf.why}, so without the events described, the outcome would have been different.`,
  };
}

function buildPurpose(F, rng) {
  const f = FLAVOR[F.domain];
  return {
    skill: 'purpose',
    text: pick(STEMS.purpose, rng),
    correct: cap(f.purpose(F)),
    distractors: f.purposeWrongs(F).map((w) => cap(w)),
    solution: `The author explains what happened and why it mattered, so the purpose is to ${f.purpose(F)}.`,
  };
}

function buildPOV(F, rng) {
  const f = FLAVOR[F.domain];
  return {
    skill: 'pov',
    text: pick(STEMS.pov, rng),
    correct: f.toneCorrect(F),
    distractors: f.toneWrongs(F),
    solution: f.toneWhy(F),
  };
}

function buildOrganization(F, rng) {
  return {
    skill: 'organization',
    text: pick(STEMS.organization, rng),
    correct: F.organizationCorrect,
    distractors: F.organizationWrongs,
    solution: F.organizationWhy,
  };
}

function buildLogic(F, rng) {
  const f = FLAVOR[F.domain];
  return {
    skill: 'logic',
    text: pick(STEMS.logic, rng),
    correct: F.title,
    distractors: F.titleWrongs,
    solution: `The passage centers on ${f.titleSummary(F)}, which is exactly what the best title captures.`,
  };
}

function buildQuestions(F, rng) {
  return [
    buildMainIdea(F, rng),
    buildDetail(F, rng),
    buildInference(F, rng),
    buildPurpose(F, rng),
    buildPOV(F, rng),
    buildOrganization(F, rng),
    buildLogic(F, rng),
  ];
}

// ---------------------------------------------------------------------------
// Shared derived-question data — the fields every template needs, computed
// from the same fillers the passage text uses so answers are always correct.
// ---------------------------------------------------------------------------

function deriveCommon(F, rng) {
  const f = FLAVOR[F.domain];

  // --- detail questions (answers appear verbatim in the passage) ---
  const durationWrongs = pickN(BANKS[F.domain].durations, 3, rng, [F.duration]);
  const responseWrongs = pickN(BANKS[F.domain].responses, 3, rng, [F.response]);
  const triggerWrongs = BANKS[F.domain].triggers
    .filter((t) => t.first !== F.trigger.first)
    .map((t) => cap(t.first));
  F.detailQA = [
    {
      q: `According to the passage, how long did the effort take?`,
      a: cap(F.duration),
      wrongs: durationWrongs.map(cap),
      para: F.durationPara || 3,
    },
    {
      q: `According to the passage, what did ${F.subject} do in response to the situation?`,
      a: cap(F.response),
      wrongs: responseWrongs.map(cap),
      para: 2,
    },
    {
      q: `According to the passage, what event set these changes in motion?`,
      a: cap(F.trigger.first),
      wrongs: pickN(triggerWrongs, 3, rng),
      para: 2,
    },
  ];

  // --- inference (counterfactual on the trigger) ---
  F.inference = {
    q: `Based on the passage, what would most likely have happened if ${F.trigger.later} had never occurred?`,
    correct: f.inferenceCorrect(F),
    wrongs: f.inferenceWrongs(F),
    why: f.inferenceWhy(F),
  };

  // --- thesis (main idea) ---
  F.thesis = F.thesisPattern(F);
  F.thesisWrongs = F.thesisWrongPatterns(F);

  // --- purpose / tone ---
  F.purpose = f.purpose(F);
  F.purposeWrongs = f.purposeWrongs(F);
  F.tone = f.toneCorrect(F);
  F.toneWrongs = f.toneWrongs(F);
  F.toneWhy = f.toneWhy(F);

  // --- organization ---
  F.organizationCorrect = F.organizationCorrectPattern;
  F.organizationWrongs = F.organizationWrongPatterns;
  F.organizationWhy = F.organizationWhyPattern;

  // --- logic (best title) ---
  F.titleWrongs = makeTitleWrongs(F, rng);
}

/** Make 3 wrong titles from fragments so they sound plausible but wrong. */
function makeTitleWrongs(F, rng) {
  const b = BANKS[F.domain];
  const adjPool = b.titleAdj.filter((a) => F.title.indexOf(a) === -1);
  const nounPool = b.titleNoun.filter((n) => F.title.indexOf(n) === -1);
  const a1 = pick(adjPool, rng);
  const n1 = pick(nounPool, rng);
  const n2 = pick(nounPool.filter((n) => n !== n1), rng);
  const a2 = pick(adjPool.filter((a) => a !== a1), rng);
  const other = titleRegion(F);
  return [
    `The ${a1} ${n1} of ${other}`,
    `The ${a2} ${n2} of ${other}`,
    `The ${cap(F.people)} Who Changed ${other}`,
  ];
}

// ---------------------------------------------------------------------------
// Templates — one per (domain × structure). Each make(rng) picks its fillers,
// writes the four paragraphs, sets the derived question fields, and returns
// { title, text, questions }.
// ---------------------------------------------------------------------------

function pickCast(domain, rng) {
  return pick(BANKS[domain].casts, rng);
}

/** Region name suitable for a title: no leading article, title-cased. */
function titleRegion(F) {
  const clean = F.regionName.replace(/^the\s+/i, '');
  return clean.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function makeTitle(F, rng) {
  const b = BANKS[F.domain];
  const adj = pick(b.titleAdj, rng);
  const noun = pick(b.titleNoun, rng);
  return `The ${adj} ${noun} of ${titleRegion(F)}`;
}

// ---- historical_event × chronological ----

function historicalChronological(rng) {
  const F = { domain: 'historical_event' };
  const b = BANKS.historical_event;
  const cast = pickCast('historical_event', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    duration: pick(b.durations, rng),
    trigger: pick(b.triggers, rng),
    challenge: pick(b.challenges, rng),
    response: pick(b.responses, rng),
    result: pick(b.results, rng),
    significance: pick(b.significances, rng),
  });
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `the passage explains how ${F.subject} recovered from ${F.trigger.later} by working together and restored the fortunes of ${F.regionName}`;
  F.thesisWrongPatterns = () => [
    `the passage argues that ${F.trigger.later} had no real effect on ${F.regionName}`,
    `the passage focuses only on the hardships the ${F.people} endured and nothing else`,
    `the passage claims that ${F.regionName} prospered simply because of good luck`,
  ];
  F.organizationCorrectPattern = 'It presents the events in the order in which they happened.';
  F.organizationWrongPatterns = [
    'It compares two different regions and their histories.',
    'It lists the causes of a problem and then describes its effects.',
    'It explains a problem first and then offers a step-by-step solution.',
  ];
  F.organizationWhyPattern = 'The passage moves from the early situation to the turning point, the long effort, and finally the outcome — a chronological arrangement.';

  const paras = [
    `In ${F.time}, ${F.subject} faced ${F.challenge.first}. The community had long depended on ${F.livelihood}, and the sudden pressure threatened to undo years of steady work.`,
    `The turning point came with ${F.trigger.first}. ${cap(F.subject)} responded by ${F.response}, even though ${F.challenge.later} made the work slow and difficult.`,
    `Progress came slowly. Over ${F.duration}, the community pushed ahead, repairing what could be saved and building anew where it could not. By the end, ${F.result}.`,
    `The changes reached far beyond ${F.regionName}. ${F.significance} Looking back, the period stands out as a turning point for the whole district.`,
  ];
  F.text = paras.join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---- historical_event × cause_effect ----

function historicalCauseEffect(rng) {
  const F = { domain: 'historical_event' };
  const b = BANKS.historical_event;
  const cast = pickCast('historical_event', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    trigger: pick(b.triggers, rng),
    response: pick(b.responses, rng),
    result: pick(b.results, rng),
    significance: pick(b.significances, rng),
    cause2: pick(b.causes, rng),
    cause3: pick(b.causes.filter((c) => c !== F.cause2), rng),
    effect1: pick(b.effects, rng),
    effect2: pick(b.effects.filter((e) => e !== F.effect1), rng),
    timeframe: pick(b.timeframes, rng),
  });
  F.duration = pick(b.durations, rng);
  F.challenge = F.trigger;
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `the passage explains how ${F.trigger.later} and other pressures hurt ${F.regionName} and how ${F.subject} turned the situation around`;
  F.thesisWrongPatterns = () => [
    `the passage argues that ${F.regionName} was never seriously affected by ${F.trigger.later}`,
    `the passage focuses only on the causes and never mentions the outcome`,
    `the passage claims that ${F.trigger.later} was the only reason for every change in the region`,
  ];
  F.organizationCorrectPattern = 'It first explains the causes of a problem and then describes its effects.';
  F.organizationWrongPatterns = [
    'It presents events strictly in the order in which they happened.',
    'It compares two different regions and their histories.',
    'It describes a single object or place without discussing change over time.',
  ];
  F.organizationWhyPattern = 'The passage starts with the forces that created the crisis, then shows the effects that followed — a cause-and-effect arrangement.';

  const paras = [
    `For years, ${F.subject} had prospered quietly. Their livelihood depended on ${F.livelihood}, and the district had grown used to steady, predictable seasons.`,
    `Then ${F.trigger.first} changed everything. Several pressures combined at once: ${F.cause2}, along with ${F.cause3}, left the community with few good options.`,
    `The effects were felt almost immediately. Within ${F.timeframe}, ${F.effect1}, and soon after, ${F.effect2}.`,
    `In time, however, the community adapted. After ${F.duration}, the ${F.people} succeeded by ${F.response}, and ${F.result}. ${F.significance}`,
  ];
  F.text = paras.join('\n\n');
  F.durationPara = 4;

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---- natural_phenomenon × chronological ----

function naturalChronological(rng) {
  const F = { domain: 'natural_phenomenon' };
  const b = BANKS.natural_phenomenon;
  const cast = pickCast('natural_phenomenon', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    duration: pick(b.durations, rng),
    trigger: pick(b.triggers, rng),
    finding: pick(b.findings, rng),
    confirmation: pick(b.confirmations, rng),
    significance: pick(b.significances, rng),
  });
  F.response = `tracking ${F.phenomenon} season after season`;
  F.result = `the researchers had a clear picture of what was happening`;
  F.challenge = { first: 'a shortage of funding for the study', later: 'the shortage of funding' };
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `researchers studying ${F.phenomenon} near ${F.regionName} discovered that ${F.trigger.later} was changing a familiar pattern, and their findings led to real change`;
  F.thesisWrongPatterns = () => [
    `researchers proved that ${F.phenomenon} never changed at all`,
    `the passage is mainly about how researchers built their laboratory`,
    `the passage argues that the researchers wasted their time on the study`,
  ];
  F.organizationCorrectPattern = 'It describes a sequence of events in the order they unfolded.';
  F.organizationWrongPatterns = [
    'It compares two rival theories about the same subject.',
    'It lists the causes of a problem and then its effects.',
    'It presents a problem and then argues for one solution.',
  ];
  F.organizationWhyPattern = 'The passage follows the researchers from their first observations through the long study to the final findings — a chronological account.';

  const paras = [
    `In ${F.time}, ${F.subject} began to notice something strange about ${F.phenomenon} near ${F.regionName}. What had once been a predictable pattern was slowly changing.`,
    `The turning point came with ${F.trigger.first}. The team responded by ${F.response}, and soon found that ${F.finding}.`,
    `Over ${F.duration}, the group gathered measurements and compared records from earlier years. The pattern was unmistakable: ${F.confirmation}.`,
    `Their findings changed how the region managed ${F.phenomenon}. ${F.significance}`,
  ];
  F.text = paras.join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---- natural_phenomenon × cause_effect ----

function naturalCauseEffect(rng) {
  const F = { domain: 'natural_phenomenon' };
  const b = BANKS.natural_phenomenon;
  const cast = pickCast('natural_phenomenon', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    trigger: pick(b.triggers, rng),
    confirmation: pick(b.confirmations, rng),
    finding: pick(b.findings, rng),
    significance: pick(b.significances, rng),
    effect2: pick(b.findings.filter((x) => x !== F.finding), rng),
  });
  F.duration = pick(b.durations, rng);
  F.response = `tracing the change back to its source`;
  F.result = `the cause of the shift was finally understood`;
  F.challenge = F.trigger;
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `the passage explains what caused the changes in ${F.phenomenon} near ${F.regionName} and what effects those changes had`;
  F.thesisWrongPatterns = () => [
    `the passage argues that the changes to ${F.phenomenon} had no clear cause`,
    `the passage is mainly about the history of ${F.regionName}, not about the environment`,
    `the passage claims that human activity was the only cause of every change`,
  ];
  F.organizationCorrectPattern = 'It explains the causes of a change first and then describes its effects.';
  F.organizationWrongPatterns = [
    'It tells the story in the order the events happened.',
    'It compares two different species and their habitats.',
    'It describes a single event without discussing why it happened.',
  ];
  F.organizationWhyPattern = 'The passage opens with the forces behind the change and then traces what followed — a cause-and-effect structure.';

  const paras = [
    `${cap(F.phenomenon)} in ${F.regionName} had drawn little attention for years. That changed in ${F.time}, when ${F.subject} began recording the area in detail.`,
    `The first clue was ${F.trigger.first}. The team responded by ${F.response} and soon settled on one explanation: ${F.confirmation}.`,
    `Over ${F.duration}, the effects became visible. ${cap(F.finding)}, and in the years that followed, ${F.effect2}.`,
    `The findings reshaped how the region was managed. ${F.significance}`,
  ];
  F.text = paras.join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---- invention × chronological ----

function inventionChronological(rng) {
  const F = { domain: 'invention' };
  const b = BANKS.invention;
  const cast = pickCast('invention', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    duration: pick(b.durations, rng),
    problem: pick(b.problems, rng),
    trigger: pick(b.triggers, rng),
    response: pick(b.responses, rng),
    detail: pick(b.detailSentences, rng),
    result: pick(b.results, rng),
    significance: pick(b.significances, rng),
  });
  F.challenge = F.problem;
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `the passage explains how ${F.object} came to be invented after a long effort and how it changed ${F.craft}`;
  F.thesisWrongPatterns = () => [
    `the passage argues that ${F.object} was invented entirely by accident in a single day`,
    `the passage is mainly about the history of ${F.regionName}, not about the invention`,
    `the passage claims that ${F.object} was a failure and was soon forgotten`,
  ];
  F.organizationCorrectPattern = 'It describes the steps of the invention in the order they happened.';
  F.organizationWrongPatterns = [
    'It compares two competing inventions from different countries.',
    'It lists the causes of a problem and then its effects.',
    'It argues for a single opinion about a controversial topic.',
  ];
  F.organizationWhyPattern = 'The passage moves from the original problem to the breakthrough, the long development, and finally the impact — a chronological account.';

  const paras = [
    `In ${F.time}, ${F.subject} faced ${F.problem.first}. The difficulty had frustrated people in the trade for years, and most had simply learned to live with it.`,
    `The breakthrough came with ${F.trigger.first}. Working quietly, the inventor began ${F.response}, convinced that a better way existed.`,
    `Over ${F.duration}, ${F.object} slowly took shape. ${F.detail}`,
    `When the finished device was finally shown to the public, ${F.result}. ${F.significance}`,
  ];
  F.text = paras.join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---- invention × cause_effect ----

function inventionCauseEffect(rng) {
  const F = { domain: 'invention' };
  const b = BANKS.invention;
  const cast = pickCast('invention', rng);
  Object.assign(F, cast, {
    time: pick(b.times, rng),
    problem: pick(b.problems, rng),
    trigger: pick(b.triggers, rng),
    response: pick(b.responses, rng),
    detail: pick(b.detailSentences, rng),
    result: pick(b.results, rng),
    significance: pick(b.significances, rng),
    cause2: pick(b.problems, rng).first,
  });
  F.duration = pick(b.durations, rng);
  F.challenge = F.problem;
  F.title = makeTitle(F, rng);
  F.thesisPattern = () =>
    `the passage explains the reasons ${F.object} was invented and the effects it had on ${F.craft} and beyond`;
  F.thesisWrongPatterns = () => [
    `the passage argues that ${F.object} was invented for no particular reason`,
    `the passage is mainly about the inventor\u2019s childhood rather than the invention`,
    `the passage claims that the invention had no effect on the trade`,
  ];
  F.organizationCorrectPattern = 'It explains why the invention was created and then describes what resulted from it.';
  F.organizationWrongPatterns = [
    'It tells the story of the invention in strict chronological order.',
    'It compares two inventors who worked on the same problem.',
    'It describes a natural process without mentioning people at all.',
  ];
  F.organizationWhyPattern = 'The passage first lays out the reasons behind the invention and then traces its consequences — a cause-and-effect structure.';

  const paras = [
    `In ${F.time}, ${F.craft} had reached a standstill. ${cap(F.subject)} knew the old ways were no longer good enough, and ${F.problem.first} made the need for a change obvious.`,
    `Several factors pushed the work forward. ${cap(F.trigger.first)} gave the inventor a new direction, while ${F.cause2} made a fresh approach necessary. The inventor pressed on by ${F.response}.`,
    `The effects of the breakthrough came quickly. ${cap(F.detail)} After ${F.duration}, ${F.result}.`,
    `The impact reached beyond one workshop. ${F.significance}`,
  ];
  F.text = paras.join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const TEMPLATES = [
  historicalChronological,
  historicalCauseEffect,
  naturalChronological,
  naturalCauseEffect,
  inventionChronological,
  inventionCauseEffect,
];

const MAX_TITLE_ATTEMPTS = 20;

// Titles generated during this browser session, so not even a title repeats
// within a session (exams persist titles via readingPassages across sessions).
const sessionTitles = new Set();

/**
 * Generate one unique procedural reading passage.
 * @param {Set<string>|string[]} skills - Kaplan reading skills to include
 *   (e.g. 'mainIdea'); all 7 are generated when omitted.
 * @param {string[]} excludeTitles - passage titles that must not be reused.
 * @returns {{ title: string, text: string, questions: Array }} passage object
 *   shaped like a READING_PASSAGES entry ({ skill, text, correct,
 *   distractors, solution } per question).
 */
export function generateProceduralReadingPassage(skills = null, excludeTitles = []) {
  const skillSet = new Set(skills || []);
  const exclude = new Set(excludeTitles || []);
  let passage = null;
  for (let attempt = 0; attempt < MAX_TITLE_ATTEMPTS; attempt++) {
    const rng = freshRng();
    const make = pick(TEMPLATES, rng);
    const candidate = make(rng);
    if (!exclude.has(candidate.title) && !sessionTitles.has(candidate.title)) {
      passage = candidate;
      break;
    }
  }
  if (!passage) {
    // Extremely unlikely: all titles collided. Force a fresh title on the
    // last candidate so generation never fails.
    const rng = freshRng();
    passage = pick(TEMPLATES, rng)(rng);
    passage.title = `${passage.title} (${Math.floor(rng() * 9999)})`;
  }
  sessionTitles.add(passage.title);
  if (skillSet.size) {
    passage.questions = passage.questions.filter((q) => skillSet.has(q.skill));
  }
  return passage;
}

/** Number of available template variants (domains × structures). */
export function readingTemplateCount() {
  return TEMPLATES.length;
}
