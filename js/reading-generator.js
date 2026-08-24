/**
 * Procedural Reading Passage Generator
 * ----------------------------------------------------------------------------
 * Builds unique, coherent multi-paragraph reading passages and their seven
 * comprehension questions (mainIdea, detail, inference, purpose, pov,
 * organization, logic) from template banks — no AI, no external calls.
 *
 * Each passage combines a DOMAIN (10: historical_event, natural_phenomenon,
 * invention, animal_behavior, geographic_feature, cultural_practice,
 * scientific_discovery, environmental_issue, technological_advance,
 * social_movement) with a NARRATIVE STRUCTURE (5: chronological,
 * cause_effect, compare_contrast, problem_solution, process_sequence) for
 * 50 template combinations.
 *
 * Prose is written once per STRUCTURE as a framework over a normalized filler
 * schema; each DOMAIN supplies the vocabulary via its bank (casts, triggers,
 * responses, results, significances, …). Fillers are drawn with a fresh
 * random seed on every call, so no two passages share text or story. Titles
 * are re-rolled when they collide with already-used titles (session + caller
 * exclusions), making repeats effectively impossible.
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
// Filler banks — one per domain. Every bank supplies the normalized schema the
// structure frameworks read: casts, times, durations, triggers {first,later},
// challenges {first,later}, responses (gerunds), results (clauses),
// significances (sentences), failures (sentences), causes, effects, timeframes,
// titleAdj, titleNoun. Phrases are written to slot into the framework
// sentences grammatically.
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
    failures: [
      'The first efforts to recover made little headway.',
      'An early plan was abandoned when funds ran out.',
      'The initial response only made the situation worse.',
      'A promising start faded when the weather turned again.',
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
    challenges: [
      { first: 'a puzzling change in the animals\u2019 usual patterns', later: 'the puzzling change' },
      { first: 'a steady decline in the numbers being recorded', later: 'the steady decline' },
      { first: 'the difficulty of telling natural change from harm', later: 'the difficulty of interpretation' },
      { first: 'a shortage of money to continue the field work', later: 'the shortage of money' },
      { first: 'the resistance of local officials to the findings', later: 'the resistance of local officials' },
    ],
    results: [
      'the researchers had a clear picture of what was happening',
      'the cause of the change was finally understood',
      'the animals returned to their familiar patterns',
      'the region\u2019s managers could act on solid evidence',
    ],
    significances: [
      'Their findings changed how the region managed its coastline.',
      'The study became a standard reference for later research.',
      'Local officials used the data to protect the area for the future.',
      'The work drew attention from scientists around the world.',
      'The records they kept still guide conservation efforts today.',
      'The discovery reshaped what scientists thought they knew about the area.',
    ],
    failures: [
      'The first attempts to measure the change were too crude.',
      'An early survey was interrupted by bad weather.',
      'The initial records proved impossible to compare.',
      'A first round of field work ended without a clear answer.',
    ],
    causes: [
      'a slow rise in water temperature',
      'a change in the food supply far offshore',
      'the arrival of new species in the area',
      'a shift in the currents that shaped the region',
    ],
    effects: [
      'the pattern shifted by weeks each year',
      'the population thinned noticeably',
      'the seasonal cycle became harder to predict',
      'the old records no longer matched reality',
    ],
    timeframes: ['a single season', 'a few months', 'two consecutive summers', 'several years'],
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
    triggers: [
      { first: 'a chance remark from a traveling mechanic', later: 'the chance remark' },
      { first: 'a lucky accident in the workshop', later: 'the lucky accident' },
      { first: 'an order from a customer who demanded something better', later: 'the demanding customer' },
      { first: 'a small but telling failure of the old design', later: 'the failure of the old design' },
      { first: 'a suggestion buried in an old technical manual', later: 'the old technical manual' },
      { first: 'a race against a rival workshop', later: 'the rivalry with the other workshop' },
    ],
    challenges: [
      { first: 'a frustrating lack of accuracy in existing designs', later: 'the lack of accuracy in existing designs' },
      { first: 'a dangerous weakness in the equipment then in use', later: 'the weakness in the equipment' },
      { first: 'a costly inefficiency that every workshop accepted', later: 'the costly inefficiency' },
      { first: 'a problem that had defeated every attempt to solve it', later: 'the stubborn problem' },
      { first: 'a flaw that left the current devices unreliable', later: 'the flaw in the current devices' },
    ],
    responses: [
      'testing a series of new designs',
      'taking the device apart and rebuilding it piece by piece',
      'sketching dozens of variations before settling on one',
      'combining two older ideas into something entirely new',
      'keeping a careful record of every failure',
      'borrowing techniques from a completely different trade',
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
    failures: [
      'The first prototypes failed within days.',
      'An early version was too expensive to build.',
      'The first public test ended in disappointment.',
      'A promising design proved impossible to finish.',
    ],
    causes: [
      'a growing demand for greater accuracy',
      'a drop in the cost of materials',
      'a new manufacturing method',
      'pressure from customers who wanted better tools',
    ],
    effects: [
      'the old designs quickly became outdated',
      'prices fell steadily',
      'new uses appeared almost monthly',
      'rival workshops rushed to catch up',
    ],
    timeframes: ['a few months', 'a single year', 'two long seasons', 'several years'],
    titleAdj: ['Forgotten', 'Remarkable', 'Unlikely', 'Clever', 'Quiet', 'Daring', 'Simple', 'Enduring'],
    titleNoun: ['Device', 'Machine', 'Invention', 'Breakthrough', 'Design', 'Mechanism', 'Solution'],
  },

  animal_behavior: {
    casts: [
      { subject: 'a team of wildlife biologists', people: 'researchers', region: 'the Thornwood forest', regionName: 'Thornwood', animal: 'the wood thrush', habitat: 'the old-growth forest' },
      { subject: 'a group of wolf researchers', people: 'researchers', region: 'the Gray Ridge wilderness', regionName: 'Gray Ridge', animal: 'the gray wolf', habitat: 'the high ridges' },
      { subject: 'a team of marine ecologists', people: 'researchers', region: 'the sandbar coast', regionName: 'the sandbar coast', animal: 'the loggerhead turtle', habitat: 'the nesting beaches' },
      { subject: 'a pair of bat biologists', people: 'researchers', region: 'the limestone caves', regionName: 'the limestone caves', animal: 'the little brown bat', habitat: 'the cave system' },
      { subject: 'a group of grassland ecologists', people: 'researchers', region: 'the high plains', regionName: 'the high plains', animal: 'the pronghorn', habitat: 'the open grassland' },
      { subject: 'a team of river biologists', people: 'researchers', region: 'the Coldwater river', regionName: 'the Coldwater river', animal: 'the Chinook salmon', habitat: 'the spawning creeks' },
      { subject: 'a group of insect biologists', people: 'researchers', region: 'the Meadowvale orchards', regionName: 'Meadowvale', animal: 'the honeybee', habitat: 'the orchard rows' },
      { subject: 'a team of forest ecologists', people: 'researchers', region: 'the Redpine preserve', regionName: 'Redpine', animal: 'the great horned owl', habitat: 'the pine stands' },
    ],
    times: ['the late 1970s', 'the mid-1980s', 'the early 1990s', 'the late 1990s', 'the early 2000s', 'the mid-2010s'],
    durations: ['three field seasons', 'several years of study', 'two consecutive springs', 'a decade of observation', 'more than four years'],
    triggers: [
      { first: 'a sudden drop in the breeding count', later: 'the drop in the breeding count' },
      { first: 'an unusually mild winter', later: 'the mild winter' },
      { first: 'the arrival of a new predator', later: 'the arrival of the new predator' },
      { first: 'a sharp loss of nesting habitat', later: 'the loss of nesting habitat' },
      { first: 'a puzzling rise in nest failures', later: 'the rise in nest failures' },
      { first: 'a change in the animals\u2019 feeding schedule', later: 'the change in the feeding schedule' },
    ],
    challenges: [
      { first: 'a shortage of funding for the study', later: 'the shortage of funding' },
      { first: 'the difficulty of tracking animals in dense cover', later: 'the difficulty of tracking' },
      { first: 'resistance from local landowners', later: 'the resistance from local landowners' },
      { first: 'a winter that made fieldwork nearly impossible', later: 'the difficult winter' },
      { first: 'the animals\u2019 wariness of human observers', later: 'the animals\u2019 wariness' },
    ],
    responses: [
      'fitting the animals with lightweight tracking tags',
      'mapping every known nesting site',
      'watching the animals from a network of hidden blinds',
      'recording the animals\u2019 movements around the clock',
      'counting the population from the air each spring',
      'following the animals through every season of the year',
    ],
    results: [
      'the population began to recover within two seasons',
      'the team finally understood the animals\u2019 hidden habits',
      'the colony returned to its former numbers',
      'the breeding season grew longer and steadier',
      'the mystery behind the decline was solved',
    ],
    significances: [
      'The findings changed how the reserve was managed.',
      'The study became a model for tracking other species.',
      'Local landowners adopted practices that protected the animals.',
      'The research drew attention to a problem no one had noticed.',
      'The data still guide decisions about the habitat today.',
    ],
    failures: [
      'The first attempt to mark the animals failed when the tags fell off.',
      'An early survey missed most of the animals entirely.',
      'The initial counts were too small to draw any conclusion.',
      'A first round of tracking ended when the equipment froze.',
    ],
    causes: [
      'the loss of nesting habitat',
      'a change in the local climate',
      'a shortage of food in the early spring',
      'a rise in predators near the edge of the preserve',
    ],
    effects: [
      'fewer young survived to adulthood',
      'the animals moved to unfamiliar ground',
      'the breeding season shortened',
      'the population thinned each year',
    ],
    timeframes: ['a single season', 'two consecutive springs', 'a few months', 'one harsh winter'],
    titleAdj: ['Vanishing', 'Restless', 'Quiet', 'Hidden', 'Returning', 'Changing', 'Patient', 'Secret'],
    titleNoun: ['Habitats', 'Migrations', 'Nests', 'Colonies', 'Trails', 'Seasons', 'Signals'],
  },

  geographic_feature: {
    casts: [
      { subject: 'a team of geographers', people: 'researchers', region: 'the Kershaw plateau', regionName: 'the Kershaw plateau', feature: 'the sunken valleys' },
      { subject: 'a group of geologists', people: 'researchers', region: 'the western desert', regionName: 'the western desert', feature: 'the great canyon' },
      { subject: 'a team of volcanologists', people: 'researchers', region: 'the Caldera islands', regionName: 'the Caldera islands', feature: 'the ancient volcanic ridge' },
      { subject: 'a pair of coastal geologists', people: 'researchers', region: 'the Northwind shore', regionName: 'the Northwind shore', feature: 'the wandering sand dunes' },
      { subject: 'a team of cave researchers', people: 'researchers', region: 'the Marble hills', regionName: 'the Marble hills', feature: 'the limestone caverns' },
      { subject: 'a group of river geologists', people: 'researchers', region: 'the Okanee lowlands', regionName: 'the Okanee lowlands', feature: 'the shifting river delta' },
      { subject: 'a team of glacial geologists', people: 'researchers', region: 'the high country', regionName: 'the high country', feature: 'the chain of glacial lakes' },
      { subject: 'a group of desert researchers', people: 'researchers', region: 'the Miridian basin', regionName: 'the Miridian basin', feature: 'the vast salt flats' },
    ],
    times: ['the early 1900s', 'the 1920s', 'the late 1930s', 'the 1950s', 'the early 1970s', 'the late 1980s', 'the early 2000s'],
    durations: ['several field seasons', 'a decade of surveys', 'two long summers', 'more than three years', 'a generation of study'],
    triggers: [
      { first: 'a dramatic change in the landscape', later: 'the dramatic change in the landscape' },
      { first: 'a series of heavy storms', later: 'the series of heavy storms' },
      { first: 'a sudden shift in the river\u2019s course', later: 'the shift in the river\u2019s course' },
      { first: 'an unusual pattern of erosion', later: 'the unusual pattern of erosion' },
      { first: 'a discovery buried in an old survey map', later: 'the discovery in the old map' },
      { first: 'a dry season that exposed hidden ground', later: 'the dry season' },
    ],
    challenges: [
      { first: 'the difficulty of reaching the site', later: 'the difficulty of reaching the site' },
      { first: 'frequent bad weather', later: 'the frequent bad weather' },
      { first: 'a lack of reliable maps', later: 'the lack of reliable maps' },
      { first: 'the cost of bringing heavy equipment', later: 'the cost of the equipment' },
      { first: 'the sheer size of the area', later: 'the size of the area' },
    ],
    responses: [
      'mapping the terrain meter by meter',
      'drilling cores from the valley floor',
      'comparing old photographs with the present landscape',
      'measuring the movement of the ground each year',
      'charting the site from the air',
      'walking every mile of the feature to record it',
    ],
    results: [
      'the true age of the formation became clear',
      'the researchers proved the valley had been carved by ancient floods',
      'the map of the region had to be redrawn',
      'the feature turned out to be far older than anyone believed',
      'the forces that shaped the land were finally identified',
    ],
    significances: [
      'The discovery changed the textbooks about the region.',
      'The research reshaped how the area was protected.',
      'The findings drew geologists from around the world.',
      'The work settled a debate that had lasted for decades.',
      'The feature is now studied as a classic example of its kind.',
    ],
    failures: [
      'The first drill cores came up empty.',
      'Early maps placed the feature in the wrong spot.',
      'The initial survey was called off by bad weather.',
      'The first equipment run was lost in a flood.',
    ],
    causes: [
      'centuries of wind and water',
      'a series of ancient floods',
      'the slow movement of the ground itself',
      'a shift in the course of the river',
    ],
    effects: [
      'the valley grew deeper year by year',
      'the dunes crept steadily inland',
      'the coastline moved visibly over the decades',
      'the river carved a new channel',
    ],
    timeframes: ['a single season', 'a few months', 'one long summer', 'several years'],
    titleAdj: ['Hidden', 'Ancient', 'Shifting', 'Forgotten', 'Silent', 'Deep', 'Wandering', 'Quiet'],
    titleNoun: ['Valleys', 'Plateaus', 'Cliffs', 'Canyons', 'Ridges', 'Basins', 'Gorges'],
  },

  cultural_practice: {
    casts: [
      { subject: 'the people of the town of Morrow', people: 'residents', region: 'the town of Morrow', regionName: 'Morrow', practice: 'the harvest festival' },
      { subject: 'the weavers of the village of Ellerby', people: 'villagers', region: 'the village of Ellerby', regionName: 'Ellerby', practice: 'the pattern-weaving tradition' },
      { subject: 'the islanders of Parn', people: 'islanders', region: 'the island of Parn', regionName: 'Parn', practice: 'the festival of lanterns' },
      { subject: 'the storytellers of the highland hamlets', people: 'storytellers', region: 'the highland hamlets', regionName: 'the highland hamlets', practice: 'the winter storytelling nights' },
      { subject: 'the traders of the port town of Vell', people: 'traders', region: 'the port town of Vell', regionName: 'Vell', practice: 'the autumn market fair' },
      { subject: 'the dancers of the hills of Corin', people: 'dancers', region: 'the hills of Corin', regionName: 'Corin', practice: 'the midsummer folk dance' },
      { subject: 'the boat builders of the river towns', people: 'boat builders', region: 'the river towns', regionName: 'the river towns', practice: 'the annual boat race' },
      { subject: 'the singers of the fishing villages', people: 'villagers', region: 'the fishing villages of the Cape', regionName: 'the Cape', practice: 'the harbor song tradition' },
    ],
    times: ['the late 1800s', 'the early 1900s', 'the 1920s', 'the 1940s', 'the late 1950s', 'the 1970s', 'the late 1980s', 'the early 2000s'],
    durations: ['a single generation', 'nearly a decade', 'several years', 'a handful of seasons', 'the better part of a decade'],
    triggers: [
      { first: 'a new generation losing interest in the old ways', later: 'the loss of interest among the young' },
      { first: 'a change in the region\u2019s economy', later: 'the change in the economy' },
      { first: 'a ruling that threatened the tradition', later: 'the ruling against the tradition' },
      { first: 'a disaster that scattered the community', later: 'the disaster' },
      { first: 'a growing wave of outside influence', later: 'the wave of outside influence' },
    ],
    challenges: [
      { first: 'a shortage of money to keep the tradition alive', later: 'the shortage of money' },
      { first: 'the loss of the oldest members of the community', later: 'the loss of the elders' },
      { first: 'the difficulty of passing on skills to the young', later: 'the difficulty of passing on the skills' },
      { first: 'officials who saw little value in the custom', later: 'the indifference of the officials' },
    ],
    responses: [
      'teaching the craft to a new generation',
      'organizing a festival that drew the whole region',
      'recording the tradition in writing and photographs',
      'bringing the practice back to the town square',
      'forming a society to preserve the custom',
      'inviting neighboring towns to share in the celebration',
    ],
    results: [
      'the tradition found a new life among the young',
      'visitors began coming from far away to see it',
      'the community reclaimed a part of its identity',
      'the practice was written into the town\u2019s calendar for good',
      'the festival grew larger than it had ever been',
    ],
    significances: [
      'The revival reminded the region what the tradition had always meant.',
      'The practice is now passed on in schools and workshops alike.',
      'The celebration became a bridge between the generations.',
      'The tradition drew visitors and renewed the town\u2019s pride.',
      'The story of the revival spread to communities far beyond the region.',
    ],
    failures: [
      'An early effort to revive the festival drew almost no one.',
      'The first classes ended after a single winter.',
      'A museum display failed to interest the young.',
      'The first attempts to record the songs were lost.',
    ],
    causes: [
      'the departure of younger workers',
      'the closing of the old market',
      'a shift in how the region spent its free time',
      'the arrival of cheaper goods from outside',
    ],
    effects: [
      'attendance at the festival shrank year by year',
      'fewer people learned the old skills',
      'the tradition was kept alive by only a handful of elders',
      'the customs began to disappear from daily life',
    ],
    timeframes: ['a few years', 'a single generation', 'a handful of seasons', 'a decade'],
    titleAdj: ['Lasting', 'Forgotten', 'Quiet', 'Living', 'Renewed', 'Unbroken', 'Patient', 'Warm'],
    titleNoun: ['Festivals', 'Traditions', 'Customs', 'Crafts', 'Songs', 'Rituals', 'Celebrations'],
  },

  scientific_discovery: {
    casts: [
      { subject: 'a team of chemists', people: 'researchers', region: 'the university laboratory at Kern', regionName: 'the Kern laboratory', field: 'chemistry', discovery: 'a new type of catalyst' },
      { subject: 'a group of physicists', people: 'researchers', region: 'the observatory at Mount Vex', regionName: 'the Mount Vex observatory', field: 'astronomy', discovery: 'a faint new class of star' },
      { subject: 'a team of biologists', people: 'researchers', region: 'the marine station at Crant', regionName: 'the Crant marine station', field: 'marine biology', discovery: 'a previously unknown microbe' },
      { subject: 'a group of geologists', people: 'researchers', region: 'the institute at Dorn', regionName: 'the Dorn institute', field: 'geology', discovery: 'a mineral that formed under impossible conditions' },
      { subject: 'a team of materials scientists', people: 'researchers', region: 'the research center at Halden', regionName: 'Halden', field: 'materials science', discovery: 'a material that bent light' },
      { subject: 'a pair of mathematicians', people: 'researchers', region: 'the university at Bram', regionName: 'Bram', field: 'mathematics', discovery: 'a pattern hidden in old data' },
      { subject: 'a team of botanists', people: 'researchers', region: 'the field station in the Barrow hills', regionName: 'the Barrow hills', field: 'botany', discovery: 'a plant that thrived in poor soil' },
      { subject: 'a group of medical researchers', people: 'researchers', region: 'the hospital laboratory at Ell', regionName: 'the Ell laboratory', field: 'medicine', discovery: 'a compound that fought infection' },
    ],
    times: ['the early 1950s', 'the late 1960s', 'the 1970s', 'the early 1980s', 'the late 1990s', 'the early 2010s'],
    durations: ['a year of repeated testing', 'several years of experiments', 'two long winters of work', 'the better part of a decade', 'more than three years'],
    triggers: [
      { first: 'an unexpected result in a routine experiment', later: 'the unexpected result' },
      { first: 'a lucky accident in the laboratory', later: 'the lucky accident' },
      { first: 'a clue buried in an old paper', later: 'the clue in the old paper' },
      { first: 'a failed experiment that pointed the right way', later: 'the failed experiment' },
      { first: 'a chance observation during a field trip', later: 'the chance observation' },
    ],
    challenges: [
      { first: 'a shortage of funding', later: 'the shortage of funding' },
      { first: 'the skepticism of established experts', later: 'the skepticism of the experts' },
      { first: 'a long string of failed experiments', later: 'the string of failures' },
      { first: 'the difficulty of proving the result', later: 'the difficulty of proof' },
      { first: 'equipment that kept breaking down', later: 'the failing equipment' },
    ],
    responses: [
      'repeating the experiment under strict conditions',
      'building a new device to test the idea',
      'comparing the result with decades of records',
      'teaming up with another laboratory',
      'publishing the work in stages to invite criticism',
      'running the test hundreds of times to be sure',
    ],
    results: [
      'the discovery was confirmed beyond doubt',
      'the team\u2019s result held up under scrutiny',
      'the finding opened an entirely new line of research',
      'the theory that had guided the field was overturned',
      'the result was accepted by even the harshest critics',
    ],
    significances: [
      'The discovery reshaped the field within a few years.',
      'The method they developed became standard practice.',
      'The finding overturned ideas that had stood for decades.',
      'The work opened doors to applications no one had imagined.',
      'The result is still cited in classrooms today.',
    ],
    failures: [
      'The first attempts to repeat the result failed.',
      'An early version of the experiment was contaminated.',
      'The initial data were dismissed as a fluke.',
      'The first paper was rejected by the journal.',
    ],
    causes: [
      'a new piece of equipment',
      'a change in how samples were prepared',
      'a fresh set of eyes on old data',
      'a shift in the priorities of the field',
    ],
    effects: [
      'established ideas began to be questioned',
      'other laboratories rushed to repeat the work',
      'the field attracted a wave of new researchers',
      'the old textbooks had to be revised',
    ],
    timeframes: ['a few months', 'a single season', 'a year of testing', 'several years'],
    titleAdj: ['Unlikely', 'Remarkable', 'Forgotten', 'Quiet', 'Daring', 'Lucky', 'Patient', 'Enduring'],
    titleNoun: ['Discoveries', 'Experiments', 'Breakthroughs', 'Results', 'Findings', 'Claims', 'Ideas'],
  },

  environmental_issue: {
    casts: [
      { subject: 'a group of conservationists', people: 'conservationists', region: 'the Crendle marsh', regionName: 'the Crendle marsh', ecosystem: 'the marsh', species: 'the native reeds' },
      { subject: 'a team of reef ecologists', people: 'conservationists', region: 'the barrier reef', regionName: 'the barrier reef', ecosystem: 'the reef', species: 'the reef-building corals' },
      { subject: 'a group of prairie managers', people: 'conservationists', region: 'the northern grasslands', regionName: 'the northern grasslands', ecosystem: 'the grassland', species: 'the prairie wildflowers' },
      { subject: 'a team of foresters', people: 'conservationists', region: 'the eastern woodlands', regionName: 'the eastern woodlands', ecosystem: 'the woodland', species: 'the red oaks' },
      { subject: 'a group of river keepers', people: 'conservationists', region: 'the lower Alden river', regionName: 'the Alden river', ecosystem: 'the river', species: 'the freshwater mussels' },
      { subject: 'a team of moorland wardens', people: 'conservationists', region: 'the western moor', regionName: 'the western moor', ecosystem: 'the moor', species: 'the heather' },
      { subject: 'a group of lake biologists', people: 'conservationists', region: 'Lake Thorne', regionName: 'Lake Thorne', ecosystem: 'the lake', species: 'the deep-water fish' },
      { subject: 'a team of coastal guardians', people: 'conservationists', region: 'the nesting coast', regionName: 'the nesting coast', ecosystem: 'the shoreline', species: 'the nesting shorebirds' },
    ],
    times: ['the early 1980s', 'the late 1980s', 'the early 1990s', 'the late 1990s', 'the early 2000s', 'the mid-2010s'],
    durations: ['a decade of restoration', 'several years of work', 'three growing seasons', 'the better part of a decade', 'more than five years'],
    triggers: [
      { first: 'a steady rise in pollution', later: 'the rise in pollution' },
      { first: 'the arrival of an invasive species', later: 'the arrival of the invasive species' },
      { first: 'a new development near the water\u2019s edge', later: 'the new development' },
      { first: 'a long series of dry years', later: 'the dry years' },
      { first: 'a change in the way the land was used upstream', later: 'the change in land use upstream' },
    ],
    challenges: [
      { first: 'a shortage of money for restoration', later: 'the shortage of money' },
      { first: 'opposition from businesses that used the land', later: 'the opposition from the businesses' },
      { first: 'the slow pace of natural recovery', later: 'the slow pace of recovery' },
      { first: 'the difficulty of undoing decades of damage', later: 'the difficulty of the work' },
    ],
    responses: [
      'planting native species along the damaged banks',
      'working with local landowners to reduce runoff',
      'restoring the water flow to its natural path',
      'setting aside protected zones for the wildlife',
      'removing the invasive species by hand',
      'rebuilding the eroded shoreline with natural materials',
    ],
    results: [
      'the ecosystem slowly returned to health',
      'the native species began to thrive again',
      'the water cleared within a few seasons',
      'wildlife returned to parts of the area that had been empty',
      'the damage was finally halted and then reversed',
    ],
    significances: [
      'The restoration became a model for other regions.',
      'The project showed what careful, patient work could achieve.',
      'The recovered area now shelters species that had nearly vanished.',
      'The success changed how the region thought about its waterways.',
      'The work is still cited as proof that damaged land can be healed.',
    ],
    failures: [
      'The first planting washed away in a flood.',
      'Early attempts to remove the invasive species only spread it.',
      'A first restoration project ran out of money.',
      'The initial cleanup barely made a difference.',
    ],
    causes: [
      'years of unchecked runoff',
      'the spread of the invasive species',
      'a shift in the water level',
      'the loss of the plants that held the soil',
    ],
    effects: [
      'the native species thinned each year',
      'the water grew murky and warm',
      'the wildlife moved away',
      'the ecosystem became harder to restore',
    ],
    timeframes: ['a single season', 'a few summers', 'one long winter', 'several years'],
    titleAdj: ['Restored', 'Vanishing', 'Quiet', 'Recovering', 'Fragile', 'Living', 'Patient', 'Renewed'],
    titleNoun: ['Waters', 'Marshes', 'Reefs', 'Woodlands', 'Rivers', 'Coasts', 'Lands'],
  },

  technological_advance: {
    casts: [
      { subject: 'a team of engineers', people: 'engineers', region: 'the research center at Halden', regionName: 'Halden', field: 'telecommunications', advance: 'a faster data cable' },
      { subject: 'a group of battery researchers', people: 'engineers', region: 'the power laboratory at Venn', regionName: 'the Venn laboratory', field: 'portable power', advance: 'a longer-lasting battery' },
      { subject: 'a team of sensor designers', people: 'engineers', region: 'the weather institute at Orl', regionName: 'the Orl institute', field: 'weather forecasting', advance: 'a more sensitive pressure sensor' },
      { subject: 'a group of engine builders', people: 'engineers', region: 'the aircraft works at Dray', regionName: 'Dray', field: 'aviation', advance: 'a quieter jet engine' },
      { subject: 'a team of display makers', people: 'engineers', region: 'the electronics plant at Corr', regionName: 'Corr', field: 'consumer electronics', advance: 'a sharper, thinner screen' },
      { subject: 'a group of pump designers', people: 'engineers', region: 'the irrigation office at Mell', regionName: 'Mell', field: 'agriculture', advance: 'a far more efficient water pump' },
      { subject: 'a team of imaging specialists', people: 'engineers', region: 'the medical workshop at Stane', regionName: 'Stane', field: 'medical imaging', advance: 'a faster scanner' },
      { subject: 'a group of chip designers', people: 'engineers', region: 'the computing lab at Prent', regionName: 'the Prent computing lab', field: 'computing', advance: 'a smaller, cooler processor' },
    ],
    times: ['the early 1950s', 'the late 1960s', 'the 1970s', 'the early 1980s', 'the late 1990s', 'the early 2010s'],
    durations: ['nearly a decade', 'several years of development', 'two years of round-the-clock work', 'the better part of a decade', 'more than three years'],
    triggers: [
      { first: 'a demand from customers for something better', later: 'the demand from customers' },
      { first: 'a breakthrough in a related field', later: 'the breakthrough in the related field' },
      { first: 'a costly failure of the old technology', later: 'the failure of the old technology' },
      { first: 'a deadline that forced the team to hurry', later: 'the pressing deadline' },
      { first: 'a suggestion from an unexpected source', later: 'the unexpected suggestion' },
    ],
    challenges: [
      { first: 'a tight budget', later: 'the tight budget' },
      { first: 'a series of failed prototypes', later: 'the series of failed prototypes' },
      { first: 'the skepticism of the industry', later: 'the skepticism of the industry' },
      { first: 'a rival team working on the same idea', later: 'the rival team' },
      { first: 'materials that did not yet exist', later: 'the missing materials' },
    ],
    responses: [
      'testing dozens of prototype designs',
      'combining two older technologies in a new way',
      'working with a supplier to build the parts',
      'running the device through thousands of trials',
      'sharing early results with other teams',
      'rebuilding the design from scratch when it failed',
    ],
    results: [
      'the new technology outperformed every rival',
      'costs fell enough for wide use',
      'the device found its way into homes and factories',
      'the industry adopted the design within a few years',
      'the advance made the old technology obsolete',
    ],
    significances: [
      'The advance opened the door to uses no one had imagined.',
      'The design became the standard for the whole industry.',
      'The technology changed daily life for millions of people.',
      'The work inspired a new generation of engineers.',
      'The advance is still built into the devices used today.',
    ],
    failures: [
      'The first prototypes failed within days.',
      'An early version was too expensive to build.',
      'The first public test ended in embarrassment.',
      'A promising design proved impossible to manufacture.',
    ],
    causes: [
      'a growing demand for speed',
      'a drop in the cost of materials',
      'a new manufacturing method',
      'pressure from customers who wanted more',
    ],
    effects: [
      'the old technology quickly became outdated',
      'prices fell steadily',
      'new uses appeared almost monthly',
      'competitors rushed to catch up',
    ],
    timeframes: ['a few months', 'a single year', 'two long seasons', 'several years'],
    titleAdj: ['Faster', 'Smaller', 'Quiet', 'Unlikely', 'Enduring', 'Clever', 'Daring', 'Simple'],
    titleNoun: ['Devices', 'Machines', 'Cables', 'Chips', 'Sensors', 'Engines', 'Scanners'],
  },

  social_movement: {
    casts: [
      { subject: 'the residents of the hill towns', people: 'residents', region: 'the hill towns of the north', regionName: 'the hill towns', cause: 'the fight for a reliable water supply' },
      { subject: 'the parents of the valley districts', people: 'parents', region: 'the valley districts', regionName: 'the valley districts', cause: 'the campaign for better school funding' },
      { subject: 'the dock workers of the port', people: 'workers', region: 'the port city of Orne', regionName: 'Orne', cause: 'the demand for fair wages' },
      { subject: 'the readers of the mill towns', people: 'residents', region: 'the mill towns', regionName: 'the mill towns', cause: 'the fight for a public library' },
      { subject: 'the shopkeepers of the old quarter', people: 'shopkeepers', region: 'the old quarter', regionName: 'the old quarter', cause: 'the drive for safer streets' },
      { subject: 'the growers of the farming villages', people: 'growers', region: 'the farming villages', regionName: 'the farming villages', cause: 'the campaign to save the local market' },
      { subject: 'the commuters of the river communities', people: 'commuters', region: 'the river communities', regionName: 'the river communities', cause: 'the demand for a repaired bridge' },
      { subject: 'the families of the eastern wards', people: 'families', region: 'the eastern wards of the city', regionName: 'the eastern wards', cause: 'the push for a public clinic' },
    ],
    times: ['the early 1900s', 'the 1920s', 'the late 1930s', 'the 1940s', 'the late 1950s', 'the 1970s', 'the late 1980s', 'the early 2000s'],
    durations: ['a single year of organizing', 'nearly two years', 'the better part of a decade', 'several long winters', 'more than three years'],
    triggers: [
      { first: 'a decision by distant officials that ignored local needs', later: 'the decision by the officials' },
      { first: 'a public meeting that ended in frustration', later: 'the frustrated public meeting' },
      { first: 'an incident that drew attention to the problem', later: 'the incident' },
      { first: 'a new rule that made the situation worse', later: 'the new rule' },
      { first: 'a report that laid out the damage', later: 'the report' },
    ],
    challenges: [
      { first: 'the indifference of those in power', later: 'the indifference of those in power' },
      { first: 'a shortage of money and time', later: 'the shortage of money and time' },
      { first: 'disagreements inside the movement itself', later: 'the disagreements inside the movement' },
      { first: 'opposition from groups with more influence', later: 'the opposition from powerful groups' },
      { first: 'a long stretch with little visible progress', later: 'the long stretch of slow progress' },
    ],
    responses: [
      'organizing public meetings across the district',
      'gathering signatures on a petition',
      'forming a committee to speak for the community',
      'staging peaceful demonstrations in the town square',
      'publishing a newsletter to spread the word',
      'inviting experts to explain the problem to the public',
    ],
    results: [
      'the authorities finally agreed to act',
      'the community won its long fight',
      'the change brought real improvement to daily life',
      'the movement\u2019s demands were written into local policy',
      'the promised work was carried out within a few years',
    ],
    significances: [
      'The campaign became an example for other communities.',
      'The victory showed what organized citizens could achieve.',
      'The change lasted long after the campaign had ended.',
      'The movement brought together people who had rarely worked as one.',
      'The story is still told in the region as a turning point.',
    ],
    failures: [
      'The first petition was ignored.',
      'An early meeting was poorly attended.',
      'The first proposal was rejected outright.',
      'A promising compromise fell apart at the last moment.',
    ],
    causes: [
      'years of neglect by distant officials',
      'a steady decline in local services',
      'the closing of the community meeting hall',
      'a new fee that fell hardest on the poorest',
    ],
    effects: [
      'services in the district grew worse',
      'more families began to speak up',
      'the community became harder to ignore',
      'the old grievances came to a head',
    ],
    timeframes: ['a few months', 'a single year', 'two long winters', 'several years'],
    titleAdj: ['Quiet', 'Long', 'Unbroken', 'Determined', 'Growing', 'Renewed', 'Patient', 'Steady'],
    titleNoun: ['Campaigns', 'Fights', 'Movements', 'Protests', 'Petitions', 'Struggles', 'Victories'],
  },
};

// ---------------------------------------------------------------------------
// Domain flavor — phrasing used by the shared question builders so questions
// match each domain's story.
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
  animal_behavior: {
    toneCorrect: (F) => `respectful of the researchers\u2019 careful work`,
    toneWrongs: (F) => [
      'dismissive of the research as unimportant',
      'sentimental about the animals without any evidence',
      'amused by the researchers\u2019 methods',
    ],
    toneWhy: (F) => `The passage describes the team\u2019s patient observation and the value of their findings, so the tone is respectful.`,
    purpose: (F) => `explain how researchers came to understand ${F.animal} and what their study revealed`,
    purposeWrongs: (F) => [
      `persuade readers to visit ${F.regionName}`,
      `argue that the animals needed no protection`,
      `compare ${F.animal} with animals in other countries`,
    ],
    inferenceCorrect: (F) => `the change in ${F.animal} would have gone unnoticed for much longer, and the habitat might have been harmed before anyone acted`,
    inferenceWrongs: (F) => [
      `the researchers would have reached the same conclusion much sooner`,
      `the animals would have recovered on their own without any study`,
      `the findings would have mattered even more than they did`,
    ],
    inferenceWhy: (F) => `the study of ${F.animal} began only after ${F.trigger.later} drew the researchers\u2019 attention`,
    titleSummary: (F) => `the hidden habits of ${F.animal} and what researchers learned about them`,
  },
  geographic_feature: {
    toneCorrect: (F) => `interested in the landscape\u2019s long history`,
    toneWrongs: (F) => [
      'dismissive of the researchers\u2019 conclusions',
      'alarmed by the landscape without offering evidence',
      'indifferent to the history of the region',
    ],
    toneWhy: (F) => `The passage traces the slow forces that shaped the land and the evidence researchers uncovered, so the tone is one of genuine interest.`,
    purpose: (F) => `explain how ${F.feature} in ${F.regionName} came to be and what its history revealed`,
    purposeWrongs: (F) => [
      `persuade readers to travel to ${F.regionName}`,
      `argue that the landscape has never changed`,
      `compare ${F.regionName} with regions in other countries`,
    ],
    inferenceCorrect: (F) => `the true history of ${F.feature} might have remained unknown, and the region would have kept relying on the old explanations`,
    inferenceWrongs: (F) => [
      `the researchers would have reached the same conclusion much sooner`,
      `the landscape would have revealed its history without any study`,
      `the old maps would have been just as accurate`,
    ],
    inferenceWhy: (F) => `the researchers\u2019 attention was drawn to ${F.feature} only after ${F.trigger.later}`,
    titleSummary: (F) => `the long history of ${F.feature} in ${F.regionName} and how researchers uncovered it`,
  },
  cultural_practice: {
    toneCorrect: (F) => `admiring of the community\u2019s dedication to the tradition`,
    toneWrongs: (F) => [
      'dismissive of the tradition as outdated',
      'angry about the changes in the region',
      'completely uninterested in the community\u2019s customs',
    ],
    toneWhy: (F) => `The passage emphasizes how the community worked to keep its tradition alive, so the author\u2019s attitude is admiring.`,
    purpose: (F) => `explain how ${F.practice} survived a difficult period and what it means to ${F.regionName}`,
    purposeWrongs: (F) => [
      `persuade readers to move to ${F.regionName}`,
      `argue that the tradition should have been abandoned`,
      `compare ${F.practice} with traditions in other countries`,
    ],
    inferenceCorrect: (F) => `the tradition might have died out entirely, and ${F.regionName} would have lost a part of its identity`,
    inferenceWrongs: (F) => [
      `the tradition would have survived without any effort`,
      `the community would have grown stronger by letting it go`,
      `the practice would have continued exactly as before`,
    ],
    inferenceWhy: (F) => `the tradition came under threat only after ${F.trigger.later}, and it was the community\u2019s response that saved it`,
    titleSummary: (F) => `the survival of ${F.practice} in ${F.regionName} and the community\u2019s efforts to keep it alive`,
  },
  scientific_discovery: {
    toneCorrect: (F) => `respectful of the researchers\u2019 persistence`,
    toneWrongs: (F) => [
      'skeptical that the discovery was worth the effort',
      'dismissive of the researchers\u2019 methods',
      'indifferent to the discovery\u2019s later impact',
    ],
    toneWhy: (F) => `The passage highlights the long, careful work behind the finding and its impact, so the tone is respectful.`,
    purpose: (F) => `explain how ${F.discovery} was made and why it mattered`,
    purposeWrongs: (F) => [
      `persuade readers to fund more research`,
      `criticize the laboratories that rejected the finding`,
      `compare ${F.discovery} with discoveries in other fields`,
    ],
    inferenceCorrect: (F) => `${F.discovery} might never have been confirmed, and the field would have kept following the old theory`,
    inferenceWrongs: (F) => [
      `the discovery would have been made much earlier without the delay`,
      `the old theory would have worked just as well`,
      `the researchers would have abandoned the work and moved on`,
    ],
    inferenceWhy: (F) => `the breakthrough came only after ${F.trigger.later} pointed the research in a new direction`,
    titleSummary: (F) => `the long road to ${F.discovery} and the change it brought to ${F.field}`,
  },
  environmental_issue: {
    toneCorrect: (F) => `concerned about the ecosystem and hopeful about its recovery`,
    toneWrongs: (F) => [
      'indifferent to the damage done to the area',
      'angry at the conservationists for interfering',
      'confident that the ecosystem needed no help',
    ],
    toneWhy: (F) => `The passage describes real damage but also a successful recovery, so the tone is both concerned and hopeful.`,
    purpose: (F) => `explain the damage to ${F.ecosystem} in ${F.regionName} and the efforts to restore it`,
    purposeWrongs: (F) => [
      `persuade readers to visit ${F.regionName}`,
      `argue that the damage was never serious`,
      `compare ${F.ecosystem} with ecosystems in other countries`,
    ],
    inferenceCorrect: (F) => `the damage to ${F.ecosystem} would have continued unchecked, and ${F.species} might have disappeared from ${F.regionName} entirely`,
    inferenceWrongs: (F) => [
      `the ecosystem would have recovered on its own even faster`,
      `the conservationists made the damage worse`,
      `the damage was never really a problem`,
    ],
    inferenceWhy: (F) => `the restoration work began only after ${F.trigger.later} made the damage impossible to ignore`,
    titleSummary: (F) => `the decline of ${F.ecosystem} in ${F.regionName} and the long effort to restore it`,
  },
  technological_advance: {
    toneCorrect: (F) => `admiring of the engineers\u2019 ingenuity`,
    toneWrongs: (F) => [
      'skeptical that the advance was worth the effort',
      'dismissive of the engineers\u2019 methods',
      'indifferent to the technology\u2019s later impact',
    ],
    toneWhy: (F) => `The passage highlights the long development and the widespread adoption of the technology, so the tone is admiring.`,
    purpose: (F) => `explain how ${F.advance} was developed and how it changed ${F.field}`,
    purposeWrongs: (F) => [
      `persuade readers to buy the new technology`,
      `criticize the companies that resisted the change`,
      `compare ${F.advance} with technologies in other countries`,
    ],
    inferenceCorrect: (F) => `${F.advance} might have taken years longer to appear, and ${F.field} would have kept relying on the old technology`,
    inferenceWrongs: (F) => [
      `the technology would have appeared even earlier without the delay`,
      `the old technology would have worked just as well`,
      `the engineers would have abandoned the project and moved on`,
    ],
    inferenceWhy: (F) => `the development of ${F.advance} was pushed forward by ${F.trigger.later}`,
    titleSummary: (F) => `the development of ${F.advance} and the change it brought to ${F.field}`,
  },
  social_movement: {
    toneCorrect: (F) => `respectful of the community\u2019s determination`,
    toneWrongs: (F) => [
      'dismissive of the campaign as unimportant',
      'angry about the community\u2019s demands',
      'completely uninterested in the outcome',
    ],
    toneWhy: (F) => `The passage emphasizes the patience and organization behind the campaign and its success, so the tone is respectful.`,
    purpose: (F) => `explain how the campaign for ${F.cause} succeeded and what it changed in ${F.regionName}`,
    purposeWrongs: (F) => [
      `persuade readers to move to ${F.regionName}`,
      `criticize the community for making demands`,
      `compare ${F.regionName} with regions in other countries`,
    ],
    inferenceCorrect: (F) => `the campaign might have stalled, and the problems behind ${F.cause} would have continued unresolved in ${F.regionName}`,
    inferenceWrongs: (F) => [
      `the officials would have acted without any pressure`,
      `the community would have been better off staying silent`,
      `the problems would have solved themselves eventually`,
    ],
    inferenceWhy: (F) => `the campaign grew out of ${F.trigger.later}, and the community\u2019s organized response made the difference`,
    titleSummary: (F) => `the long campaign for ${F.cause} in ${F.regionName} and what it achieved`,
  },
};

// ---------------------------------------------------------------------------
// Shared question builders — one per Kaplan reading skill. Each reads the
// derived fields on F that deriveCommon populated.
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
// Shared derived-question data — computed from the same fillers the passage
// text uses so answers are always correct.
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
      para: F.responsePara || 2,
    },
    {
      q: `According to the passage, what event set these changes in motion?`,
      a: cap(F.trigger.first),
      wrongs: pickN(triggerWrongs, 3, rng),
      para: F.triggerPara || 2,
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
// Titles
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

// ---------------------------------------------------------------------------
// Structure frameworks — the four-paragraph prose skeletons shared by every
// domain. Each reads the normalized F filler fields (which the domain bank
// supplies) and sets the question-data patterns. The paragraph index flags
// (durationPara / responsePara / triggerPara) keep the detail questions'
// "paragraph N" hints aligned with where each fact appears in the text.
// ---------------------------------------------------------------------------

const STRUCTURES = {
  chronological: {
    durationPara: 3,
    responsePara: 2,
    triggerPara: 2,
    paragraphs(F) {
      return [
        `In ${F.time}, ${F.subject} faced ${F.challenge.first}. The situation threatened to undo years of steady progress.`,
        `The turning point came with ${F.trigger.first}. ${cap(F.subject)} responded by ${F.response}, even though ${F.challenge.later} made the work slow and difficult.`,
        `Progress came slowly. Over ${F.duration}, the effort moved forward step by step, and by the end ${F.result}.`,
        `The changes reached far beyond ${F.regionName}. ${F.significance}`,
      ];
    },
    thesisPattern(F) {
      return `the passage explains how ${F.subject} responded to ${F.trigger.later} and what came of that effort in ${F.regionName}`;
    },
    thesisWrongPatterns(F) {
      return [
        `the passage argues that ${F.trigger.later} had no real effect on ${F.regionName}`,
        `the passage focuses only on the difficulties the ${F.people} faced and nothing else`,
        `the passage claims that the changes in ${F.regionName} happened by pure luck`,
      ];
    },
    organizationCorrect: 'It presents the events in the order in which they happened.',
    organizationWrongs: [
      'It compares two different places or situations.',
      'It lists the causes of a problem and then describes its effects.',
      'It explains a problem first and then offers a step-by-step solution.',
    ],
    organizationWhy: 'The passage moves from the early situation to the turning point, the long effort, and finally the outcome — a chronological arrangement.',
  },

  cause_effect: {
    durationPara: 4,
    responsePara: 4,
    triggerPara: 2,
    paragraphs(F) {
      return [
        `For years, ${F.subject} had followed the same familiar routines. Few people expected anything to change.`,
        `Then ${F.trigger.first} changed everything. Several pressures combined at once: ${F.cause2}, along with ${F.cause3}, left little room to adapt.`,
        `The effects were felt almost immediately. Within ${F.timeframe}, ${F.effect1}, and soon after, ${F.effect2}.`,
        `In time, however, the situation was turned around. After ${F.duration}, ${F.subject} succeeded by ${F.response}, and ${F.result}. ${F.significance}`,
      ];
    },
    thesisPattern(F) {
      return `the passage explains the pressures that changed ${F.regionName} and the effects that followed`;
    },
    thesisWrongPatterns(F) {
      return [
        `the passage argues that ${F.regionName} was never seriously affected by ${F.trigger.later}`,
        `the passage focuses only on the causes and never mentions the outcome`,
        `the passage claims that ${F.trigger.later} was the only reason for every change in the region`,
      ];
    },
    organizationCorrect: 'It first explains the causes of a problem and then describes its effects.',
    organizationWrongs: [
      'It presents events strictly in the order in which they happened.',
      'It compares two different places or situations.',
      'It describes a single event without discussing why it happened.',
    ],
    organizationWhy: 'The passage starts with the forces that created the change and then shows the effects that followed — a cause-and-effect arrangement.',
  },

  compare_contrast: {
    durationPara: 3,
    responsePara: 3,
    triggerPara: 1,
    paragraphs(F) {
      return [
        `For years, things in ${F.regionName} had followed the same familiar pattern. Then ${F.trigger.first} changed the rules.`,
        `Under the old way of doing things, little changed from year to year. ${cap(F.challenge.first)} was simply accepted as part of the routine.`,
        `The new approach could hardly have been more different. ${cap(F.subject)} responded by ${F.response}, and after ${F.duration} the results spoke for themselves: ${F.result}.`,
        `The contrast between the two periods could not have been starker. ${F.significance}`,
      ];
    },
    thesisPattern(F) {
      return `the passage compares the way things were in ${F.regionName} before ${F.trigger.later} with the way they became afterward`;
    },
    thesisWrongPatterns(F) {
      return [
        `the passage argues that nothing changed in ${F.regionName}`,
        `the passage compares ${F.regionName} with a completely different region`,
        `the passage describes only the newest events and ignores the past`,
      ];
    },
    organizationCorrect: 'It compares the situation before the change with the situation after it.',
    organizationWrongs: [
      'It presents events in the order in which they happened.',
      'It explains the causes of a problem and then its effects.',
      'It describes the steps of a process in order.',
    ],
    organizationWhy: 'The passage sets the old way of doing things against the new way — a compare-and-contrast structure.',
  },

  problem_solution: {
    durationPara: 4,
    responsePara: 3,
    triggerPara: 2,
    paragraphs(F) {
      return [
        `In ${F.time}, ${F.subject} faced ${F.challenge.first}. The problem grew worse with each passing season.`,
        `The usual remedies were tried first. ${cap(F.failure)} Then ${F.trigger.first} showed that a different approach was needed.`,
        `The real answer came only after much thought. ${cap(F.response)} proved to be the solution, and slowly the situation began to improve.`,
        `After ${F.duration}, the results were clear: ${F.result}. ${F.significance}`,
      ];
    },
    thesisPattern(F) {
      return `the passage explains the problem facing ${F.subject} in ${F.regionName} and how ${F.response} solved it`;
    },
    thesisWrongPatterns(F) {
      return [
        `the passage argues that the problem never really existed`,
        `the passage focuses only on the failed attempts and never mentions a solution`,
        `the passage claims that the problem solved itself without any effort`,
      ];
    },
    organizationCorrect: 'It presents a problem and then describes how it was solved.',
    organizationWrongs: [
      'It compares two different places or situations.',
      'It presents events in the order in which they happened.',
      'It describes the steps of a process in order.',
    ],
    organizationWhy: 'The passage opens with the problem, shows why the early attempts failed, and ends with the solution that worked — a problem-and-solution structure.',
  },

  process_sequence: {
    durationPara: 3,
    responsePara: 2,
    triggerPara: 1,
    paragraphs(F) {
      return [
        `In ${F.time}, ${F.subject} set out to address ${F.challenge.later}. ${cap(F.trigger.first)} had made the old ways impossible, so a new approach had to be worked out in careful stages.`,
        `The first stage involved ${F.response}. It was slow, exacting work, but it laid the groundwork for everything that followed.`,
        `Next came the longest stage. Over ${F.duration}, the effort advanced in small steps until ${F.result}.`,
        `The final stage brought the whole process to a close, and the results spoke for themselves. ${F.significance}`,
      ];
    },
    thesisPattern(F) {
      return `the passage describes the step-by-step process by which ${F.subject} addressed ${F.challenge.later} in ${F.regionName}`;
    },
    thesisWrongPatterns(F) {
      return [
        `the passage claims that the task was completed in a single day`,
        `the passage focuses only on the final stage and ignores the earlier work`,
        `the passage argues that the process had no clear purpose`,
      ];
    },
    organizationCorrect: 'It describes the steps of a process in the order they were carried out.',
    organizationWrongs: [
      'It compares two different places or situations.',
      'It explains the causes of a problem and then its effects.',
      'It presents a problem and then a solution.',
    ],
    organizationWhy: 'The passage follows the work from the first stage through the middle stages to the final outcome — a process-sequence structure.',
  },
};

// ---------------------------------------------------------------------------
// Assembly — pick a domain + structure, fill the slots, write the passage.
// ---------------------------------------------------------------------------

function pickFillers(b, rng) {
  const cause2 = pick(b.causes, rng);
  const cause3 = pick(b.causes.filter((c) => c !== cause2), rng);
  const effect1 = pick(b.effects, rng);
  const effect2 = pick(b.effects.filter((e) => e !== effect1), rng);
  return {
    time: pick(b.times, rng),
    duration: pick(b.durations, rng),
    trigger: pick(b.triggers, rng),
    challenge: pick(b.challenges, rng),
    response: pick(b.responses, rng),
    result: pick(b.results, rng),
    significance: pick(b.significances, rng),
    failure: pick(b.failures, rng),
    cause2,
    cause3,
    effect1,
    effect2,
    timeframe: pick(b.timeframes, rng),
  };
}

function makePassage(domain, structure, rng) {
  const F = { domain };
  const b = BANKS[domain];
  Object.assign(F, pickCast(domain, rng), pickFillers(b, rng));
  F.title = makeTitle(F, rng);

  const S = STRUCTURES[structure];
  F.durationPara = S.durationPara;
  F.responsePara = S.responsePara;
  F.triggerPara = S.triggerPara;
  F.thesisPattern = () => S.thesisPattern(F);
  F.thesisWrongPatterns = () => S.thesisWrongPatterns(F);
  F.organizationCorrectPattern = S.organizationCorrect;
  F.organizationWrongPatterns = S.organizationWrongs;
  F.organizationWhyPattern = S.organizationWhy;
  F.text = S.paragraphs(F).join('\n\n');

  deriveCommon(F, rng);
  return { title: F.title, text: F.text, questions: buildQuestions(F, rng) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const DOMAINS = [
  'historical_event',
  'natural_phenomenon',
  'invention',
  'animal_behavior',
  'geographic_feature',
  'cultural_practice',
  'scientific_discovery',
  'environmental_issue',
  'technological_advance',
  'social_movement',
];

const STRUCTURE_KEYS = ['chronological', 'cause_effect', 'compare_contrast', 'problem_solution', 'process_sequence'];

const TEMPLATES = [];
for (const domain of DOMAINS) {
  for (const structure of STRUCTURE_KEYS) {
    TEMPLATES.push({ domain, structure });
  }
}

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
    const { domain, structure } = pick(TEMPLATES, rng);
    const candidate = makePassage(domain, structure, rng);
    if (!exclude.has(candidate.title) && !sessionTitles.has(candidate.title)) {
      passage = candidate;
      break;
    }
  }
  if (!passage) {
    // Extremely unlikely: all titles collided. Force a fresh title on the
    // last candidate so generation never fails.
    const rng = freshRng();
    const { domain, structure } = pick(TEMPLATES, rng);
    passage = makePassage(domain, structure, rng);
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
