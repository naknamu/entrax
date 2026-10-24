#!/usr/bin/env node
/**
 * fix-reading-exams.cjs — Delete and re-upload exams with missing reading questions.
 * Uses the same question generation as batch-create-exams.cjs but only regenerates
 * the affected exam types.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'entrax-878a1';
const COLLECTION = 'exams';
const ADMIN_UID = 'W0uB5Wa8F30CdPufmIB5tAZdHobN';

// ─── OAuth token ──────────────────────────────────────────────────────────────
function getAccessToken() {
  const cfgPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config', 'configstore', 'firebase-tools.json'
  );
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return cfg.tokens.access_token;
}

// ─── Firestore REST helpers ───────────────────────────────────────────────────
function toFirestoreFields(obj) {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (typeof obj === 'number') return Number.isInteger(obj) ? { integerValue: String(obj) } : { doubleValue: obj };
  if (typeof obj === 'string') return { stringValue: obj };
  if (Array.isArray(obj)) return { arrayValue: { values: obj.map(toFirestoreFields) } };
  if (obj instanceof Date) return { timestampValue: obj.toISOString() };
  if (typeof obj === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) fields[k] = toFirestoreFields(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}

function deleteDocument(docId, token) {
  return new Promise((resolve, reject) => {
    const url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${docId}`;
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      method: 'DELETE',
      path: url,
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function createDocument(docId, data, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields: toFirestoreFields(data).mapValue.fields });
    const url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?documentId=${docId}`;
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      method: 'POST',
      path: url,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fetchAllDocs(token) {
  return new Promise((resolve, reject) => {
    let docs = [];
    function fetchPage(nextPageToken) {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}?pageSize=100` + (nextPageToken ? '&pageToken=' + nextPageToken : '');
      https.get(url, { headers: { Authorization: `Bearer ${token}` } }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          const body = JSON.parse(d);
          docs = docs.concat(body.documents || []);
          if (body.nextPageToken) fetchPage(body.nextPageToken);
          else resolve(docs);
        });
      }).on('error', reject);
    }
    fetchPage('');
  });
}

// ─── Question generators (copied from batch-create-exams.cjs) ─────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SECTIONS = {
  math: { id: 'sec-math', title: 'MATH', description: 'Conversions, Operations, Ratios, Word problems' },
  reading: { id: 'sec-reading', title: 'READING', description: 'Determining the logic of a passage, Comprehending details, Drawing basic inferences, Identifying the purpose of a passage' },
  writing: { id: 'sec-writing', title: 'WRITING', description: 'Language use, Conventions of Standard English, Knowledge of Language, Sentence structure, Paragraph composition' },
  science: { id: 'sec-science', title: 'SCIENCE', description: 'Scientific Reasoning, Data Interpretation, Experimental Design, Life Science, Physical Science, Earth and Space Science' },
};

// Reading passages - full list
const READING_PASSAGES = [
  {
    title: 'The History of Vaccination',
    text: `Edward Jenner's development of the smallpox vaccine in 1796 marked a turning point in medical history. By observing that milkmaids who had contracted cowpox seemed immune to smallpox, Jenner hypothesized that exposure to a milder disease could protect against a more deadly one. He tested this by inoculating a young boy with cowpox material and later exposing him to smallpox; the boy did not develop the disease.\n\nJenner's work laid the foundation for modern immunology. Over the following centuries, vaccines were developed for diseases including polio, measles, and tetanus. The World Health Organization declared smallpox eradicated in 1980, a testament to the power of widespread vaccination programs.\n\nToday, vaccine development continues to evolve. mRNA technology, initially developed for COVID-19 vaccines, is being explored for influenza, HIV, and even certain cancers. The principles Jenner established — using a weakened or modified agent to stimulate immunity — remain central to vaccine science.`,
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
    text: `Recent neuroscience research has revealed that sleep plays a critical role in memory consolidation — the process by which short-term memories are transformed into long-term ones. During deep sleep stages, the brain replays neural patterns that were active during waking experiences, strengthening synaptic connections and transferring information from the hippocampus to the cortex.\n\nStudies have shown that students who sleep after studying retain significantly more information than those who stay awake for the same period. One landmark experiment found that participants who slept between learning sessions improved their performance by 10-40%, while those who remained awake showed no improvement. Sleep deprivation, conversely, impairs the hippocampus's ability to encode new memories.\n\nThe implications extend beyond academic performance. Healthcare professionals working long shifts may be at risk for memory-related errors. Research suggests that even a short 20-minute nap can partially restore cognitive function, supporting the case for structured rest periods in high-stakes environments like hospitals.`,
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
    text: `The water cycle — the continuous movement of water through evaporation, condensation, and precipitation — is fundamental to life on Earth. Solar energy drives evaporation from oceans, lakes, and rivers, converting liquid water into vapor that rises into the atmosphere. As this vapor cools, it condenses into clouds and eventually falls as precipitation, replenishing water sources on land.\n\nClimate change is disrupting this delicate cycle in measurable ways. Rising global temperatures increase evaporation rates, leading to more moisture in the atmosphere. This intensifies precipitation events, causing more severe flooding in some regions while paradoxically contributing to drought in others. Warmer air holds more moisture — for every 1°C increase in temperature, the atmosphere can hold approximately 7% more water vapor.\n\nThese changes have profound implications for agriculture and water management. Regions dependent on glacial meltwater face a double threat: glaciers are retreating, reducing long-term water storage, while changing rainfall patterns make water availability less predictable. Farmers must adapt to these shifting conditions through improved irrigation techniques and drought-resistant crop varieties.`,
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
    text: `Antibiotic resistance occurs when bacteria evolve mechanisms to survive exposure to drugs that once killed them. This natural evolutionary process has been dramatically accelerated by the overuse and misuse of antibiotics in both human medicine and agriculture. When antibiotics are prescribed unnecessarily — often for viral infections like the common cold — or when patients fail to complete their full course of treatment, bacteria have more opportunities to develop resistance.\n\nThe consequences are already being felt worldwide. The World Health Organization has identified antibiotic resistance as one of the greatest threats to global health. Infections caused by resistant bacteria, such as MRSA, are more difficult and expensive to treat. Some patients face infections that respond to no available antibiotics.\n\nAddressing this crisis requires a multifaceted approach. Healthcare providers must prescribe antibiotics more judiciously. Patients need education about the importance of completing prescribed courses. Agricultural use of antibiotics must be reduced. Investment in research for new antibiotics and alternative treatments, such as bacteriophage therapy, is urgently needed.`,
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
    text: `The human gut contains approximately 100 trillion microorganisms — collectively known as the gut microbiome — that play a far more significant role in overall health than previously understood. Research over the past two decades has revealed a bidirectional communication pathway between the gut and the brain, often called the "gut-brain axis." This connection operates through the vagus nerve, immune signaling molecules, and neurotransmitter production.\n\nRemarkably, about 95% of the body's serotonin — a neurotransmitter crucial for mood regulation — is produced in the gut. Studies in mice have shown that altering the gut microbiome can change behavior, reducing anxiety-like responses. In humans, correlations have been found between gut microbiome composition and conditions including depression, anxiety, and even autism spectrum disorder.\n\nThese findings are reshaping medical approaches to mental health. Probiotics and dietary interventions are being studied as complementary treatments for depression and anxiety. While the field is still young, the gut-brain axis represents a promising frontier in understanding the complex relationship between physical and mental health.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central theme of this passage?', correct: 'The gut microbiome communicates bidirectionally with the brain, influencing mental health in significant ways.', distractors: ['Serotonin is only produced in the brain.', 'Probiotics can cure all mental illnesses.', 'Mouse studies are unreliable for human medicine.'] },
      { skill: 'detail', text: 'According to the passage, approximately what percentage of serotonin is produced in the gut?', correct: '95%', distractors: ['50%', '75%', '10%'] },
      { skill: 'inference', text: 'What can be inferred about the future of mental health treatment?', correct: 'Dietary and probiotic interventions may become standard complementary treatments.', distractors: ['Traditional medications will be completely replaced.', 'Mental health has no connection to physical health.', 'Gut research will be abandoned.'] },
      { skill: 'purpose', text: 'Why does the author mention mouse studies?', correct: 'To provide experimental evidence that the gut microbiome can influence behavior.', distractors: ['To suggest mice and humans are identical.', 'To criticize animal research.', 'To argue for more mouse experiments.'] },
      { skill: 'pov', text: 'The author\'s perspective on the gut-brain axis is:', correct: 'Cautiously optimistic about its potential.', distractors: ['Highly skeptical.', 'Completely convinced it cures diseases.', 'Uninterested in further research.'] },
      { skill: 'organization', text: 'How is the information in this passage structured?', correct: 'Introduction of the concept → evidence from research → implications for treatment.', distractors: ['Cause and effect.', 'Chronological history.', 'Problem-solution.'] },
      { skill: 'logic', text: 'Which finding would strengthen the passage\'s argument about the gut-brain connection?', correct: 'A clinical trial showing probiotics reduce depression symptoms.', distractors: ['A study on gut bacteria in plants.', 'Research showing serotonin is only in the brain.', 'A study on antibiotic use.'] },
    ]
  },
  {
    title: 'Telemedicine and Rural Healthcare',
    text: `Access to quality healthcare remains a significant challenge for rural communities worldwide. In the United States, rural residents are more likely to die from heart disease, cancer, unintentional injury, and chronic lower respiratory disease compared to their urban counterparts. Geographic isolation, physician shortages, and limited transportation options create barriers that contribute to these health disparities.\n\nTelemedicine has emerged as a powerful tool for bridging this gap. Through video consultations, remote patient monitoring, and digital health platforms, patients in rural areas can access specialists without traveling long distances. During the COVID-19 pandemic, telemedicine usage surged by over 4,000%, accelerating adoption that might otherwise have taken decades.\n\nHowever, telemedicine is not a complete solution. The "digital divide" — disparities in internet access and technology literacy — can exclude the very populations that need telemedicine most. Elderly patients, those with limited English proficiency, and communities without broadband infrastructure may be unable to benefit fully. Addressing these barriers requires investment in digital infrastructure and culturally competent telehealth services.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main idea of this passage?', correct: 'Telemedicine can help address rural healthcare disparities but faces significant accessibility barriers.', distractors: ['Rural healthcare is beyond help.', 'Telemedicine has completely replaced in-person care.', 'The digital divide has been solved.'] },
      { skill: 'detail', text: 'By how much did telemedicine usage surge during COVID-19?', correct: 'Over 4,000%', distractors: ['Over 100%', 'Over 500%', 'Over 10,000%'] },
      { skill: 'inference', text: 'What can be inferred about elderly rural patients?', correct: 'They may struggle to use telemedicine due to technology barriers.', distractors: ['They prefer telemedicine over in-person visits.', 'They have the best internet access.', 'They do not need healthcare.'] },
      { skill: 'purpose', text: 'Why does the author mention the "digital divide"?', correct: 'To highlight that telemedicine may not reach those who need it most.', distractors: ['To argue against using technology in healthcare.', 'To suggest rural areas have better internet.', 'To praise current broadband policies.'] },
      { skill: 'pov', text: 'The author\'s stance on telemedicine is:', correct: 'Supportive but aware of its limitations.', distractors: ['Completely opposed.', 'Unreservedly enthusiastic.', 'Indifferent.'] },
      { skill: 'organization', text: 'What structure does this passage follow?', correct: 'Problem → solution → limitations of solution.', distractors: ['Chronological narrative.', 'Compare and contrast.', 'Definition → examples.'] },
      { skill: 'logic', text: 'Which investment would most directly address the passage\'s identified barriers?', correct: 'Expanding broadband internet access in rural areas.', distractors: ['Building more hospitals in cities.', 'Training more surgeons.', 'Developing new medications.'] },
    ]
  },
  {
    title: 'The Placebo Effect',
    text: `The placebo effect — a measurable improvement in health that cannot be attributed to an actual medical treatment — has fascinated researchers for decades. In clinical trials, patients receiving an inert substance often report symptom relief comparable to those receiving active medication. This phenomenon demonstrates the powerful connection between mind and body in the healing process.\n\nNeuroimaging studies have revealed that placebos can trigger real physiological changes. When patients believe they are receiving treatment, the brain releases endorphins and dopamine — natural chemicals that reduce pain and improve mood. Some studies have shown that placebo surgeries for knee osteoarthritis produced outcomes nearly as positive as actual surgical procedures.\n\nThe ethical implications are complex. While deception is generally considered unethical in medicine, some researchers argue that placebos could be used transparently — explaining to patients that placebos have demonstrated real benefits even when patients know they are receiving one. This "open-label placebo" approach has shown promise in treating chronic pain and irritable bowel syndrome.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central idea of this passage?', correct: 'The placebo effect produces real physiological changes through mind-body connections and raises complex ethical questions.', distractors: ['Placebos are always more effective than medication.', 'All surgery is unnecessary.', 'Patients should always be deceived.'] },
      { skill: 'detail', text: 'What chemicals does the brain release during the placebo effect?', correct: 'Endorphins and dopamine', distractors: ['Adrenaline and cortisol', 'Serotonin and melatonin', 'Insulin and glucagon'] },
      { skill: 'inference', text: 'What can be inferred about open-label placebos?', correct: 'Patients may benefit from placebos even when aware they are receiving one.', distractors: ['They are less effective than deceptive placebos.', 'They are illegal in most countries.', 'They only work on children.'] },
      { skill: 'purpose', text: 'Why does the author mention placebo surgeries?', correct: 'To demonstrate that belief in treatment can produce outcomes similar to actual procedures.', distractors: ['To criticize surgeons.', 'To suggest all surgery is placebo.', 'To argue against clinical trials.'] },
      { skill: 'pov', text: 'The author\'s view of the placebo effect is:', correct: 'Scientifically grounded and open to ethical exploration.', distractors: ['Dismissive and skeptical.', 'Emotional and unscientific.', 'Completely opposed to its use.'] },
      { skill: 'organization', text: 'How is the passage organized?', correct: 'Definition and evidence → physiological explanation → ethical considerations.', distractors: ['Chronological history.', 'Compare and contrast.', 'Problem-solution.'] },
      { skill: 'logic', text: 'Which scenario best illustrates the placebo effect?', correct: 'A patient\'s pain decreases after taking a sugar pill they believe is pain medication.', distractors: ['A patient recovers after surgery.', 'A patient feels better after exercising.', 'A patient\'s symptoms worsen from stress.'] },
    ]
  },
  {
    title: 'Social Media and Adolescent Mental Health',
    text: `The relationship between social media use and adolescent mental health has become one of the most debated topics in public health research. Multiple large-scale studies have found correlations between heavy social media use and increased rates of depression, anxiety, and loneliness among teenagers. However, establishing causation has proven challenging, as the relationship appears to be complex and bidirectional.\n\nSocial media platforms are designed to maximize engagement through features like infinite scrolling, push notifications, and variable reward schedules — mechanisms borrowed from slot machine design. For adolescents, whose prefrontal cortex is still developing impulse control, these features can be particularly compelling and difficult to moderate.\n\nNot all effects are negative. Social media can provide community for isolated teens, including LGBTQ+ youth and those with rare medical conditions. It can facilitate creative expression and civic engagement. The challenge lies in promoting healthy digital habits while mitigating risks. Experts recommend limiting screen time, curating positive content, and maintaining open conversations about online experiences.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the main argument of this passage?', correct: 'Social media has both positive and negative effects on adolescents, requiring a balanced approach to digital health.', distractors: ['Social media is entirely harmful to teens.', 'Social media has no effect on mental health.', 'Adults should ban all social media.'] },
      { skill: 'detail', text: 'What brain region is mentioned as still developing in adolescents?', correct: 'Prefrontal cortex', distractors: ['Cerebellum', 'Hippocampus', 'Amygdala'] },
      { skill: 'inference', text: 'Why might social media be harder for teens to moderate than adults?', correct: 'Because their brain\'s impulse control center is still developing.', distractors: ['Because teens have more free time.', 'Because adults don\'t use social media.', 'Because teens are less intelligent.'] },
      { skill: 'purpose', text: 'Why does the author mention LGBTQ+ youth?', correct: 'To show that social media can have positive effects for some isolated teens.', distractors: ['To argue that social media is only for minorities.', 'To suggest LGBTQ+ teens are more depressed.', 'To promote specific social media platforms.'] },
      { skill: 'pov', text: 'The author\'s overall perspective on social media and teens is:', correct: 'Balanced, acknowledging both benefits and risks.', distractors: ['Strongly negative.', 'Strongly positive.', 'Indifferent.'] },
      { skill: 'organization', text: 'How does the passage present its argument?', correct: 'Negative evidence → counterarguments showing benefits → recommendations.', distractors: ['Chronological history.', 'Definition only.', 'Problem-solution without evidence.'] },
      { skill: 'logic', text: 'Which recommendation would best address the mechanisms described in the second paragraph?', correct: 'Disabling push notifications and setting time limits for app usage.', distractors: ['Encouraging more social media use.', 'Deleting all social media accounts.', 'Only following news accounts.'] },
    ]
  },
  {
    title: 'Microplastics in the Ocean',
    text: `Microplastics — plastic fragments smaller than 5 millimeters — have become ubiquitous in the world's oceans. Sources include the breakdown of larger plastic debris, synthetic fibers shed during laundry, and microbeads from personal care products. Current estimates suggest that over 14 million tons of microplastics sit on the ocean floor alone, with additional amounts floating at the surface and suspended throughout the water column.\n\nThe ecological impact is extensive. Marine organisms from zooplankton to whales ingest microplastics, which can cause physical harm, block digestive tracts, and leach toxic chemicals. Research has shown that microplastics accumulate in the food chain through a process called biomagnification — organisms at higher trophic levels contain greater concentrations of these particles.\n\nAddressing microplastic pollution requires action at multiple levels. Individual consumers can reduce single-use plastic consumption and choose natural fiber clothing. Municipalities can improve wastewater treatment to capture microfibers. International agreements are needed to regulate plastic production and hold manufacturers accountable for the lifecycle of their products.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the primary focus of this passage?', correct: 'Microplastics are a pervasive ocean pollutant with significant ecological impacts requiring multi-level solutions.', distractors: ['Plastic is always recyclable.', 'Ocean pollution is unsolvable.', 'Only large plastic debris is harmful.'] },
      { skill: 'detail', text: 'How much microplastic is estimated to be on the ocean floor?', correct: 'Over 14 million tons', distractors: ['Over 1 million tons', 'Over 50 million tons', 'Over 100 million tons'] },
      { skill: 'inference', text: 'What can be inferred about eating seafood?', correct: 'Humans may consume microplastics through biomagnification in the food chain.', distractors: ['Seafood is completely safe from contamination.', 'Only bottom-dwelling fish are affected.', 'Cooking removes all microplastics.'] },
      { skill: 'purpose', text: 'Why does the author explain biomagnification?', correct: 'To show that microplastic concentrations increase at higher levels of the food chain.', distractors: ['To define a scientific term for its own sake.', 'To suggest small fish are unaffected.', 'To argue against ocean research.'] },
      { skill: 'pov', text: 'The author views microplastic pollution as:', correct: 'A serious problem requiring coordinated global action.', distractors: ['A minor inconvenience.', 'An unsolvable issue.', 'Someone else\'s responsibility.'] },
      { skill: 'organization', text: 'What is the structure of this passage?', correct: 'Sources and extent → ecological impact → solutions at multiple levels.', distractors: ['Chronological history.', 'Compare and contrast.', 'Narrative storytelling.'] },
      { skill: 'logic', text: 'Which action would most directly reduce microplastic pollution at its source?', correct: 'Using washing machine filters that capture synthetic microfibers.', distractors: ['Recycling more plastic bottles.', 'Cleaning beaches monthly.', 'Reducing paper usage.'] },
    ]
  },
  {
    title: 'Cognitive Behavioral Therapy',
    text: `Cognitive Behavioral Therapy (CBT) is one of the most extensively researched forms of psychotherapy. Developed by Aaron Beck in the 1960s, CBT is based on the principle that psychological distress is largely maintained by unhelpful patterns of thinking and behavior. Unlike earlier psychoanalytic approaches that explored unconscious motivations, CBT focuses on identifying and changing specific thought patterns in the present.\n\nThe effectiveness of CBT is well-documented across a range of conditions. Meta-analyses have demonstrated its efficacy for depression, generalized anxiety disorder, panic disorder, social anxiety, PTSD, OCD, and eating disorders. For many conditions, CBT produces outcomes comparable to medication, with lower relapse rates after treatment ends. It is now recommended as a first-line treatment by multiple clinical guidelines worldwide.\n\nCBT has evolved to include several specialized approaches. Dialectical Behavior Therapy (DBT) combines CBT with mindfulness for borderline personality disorder. Acceptance and Commitment Therapy (ACT) emphasizes psychological flexibility. These adaptations demonstrate the versatility of the core cognitive-behavioral model in addressing diverse psychological needs.`,
    questions: [
      { skill: 'mainIdea', text: 'What is the central idea of this passage?', correct: 'CBT is an effective, versatile, and well-researched psychotherapy that has spawned multiple specialized approaches.', distractors: ['CBT has replaced all other forms of therapy.', 'Psychotherapy is ineffective.', 'Medication is always better than therapy.'] },
      { skill: 'detail', text: 'Who developed Cognitive Behavioral Therapy?', correct: 'Aaron Beck', distractors: ['Sigmund Freud', 'Carl Jung', 'B.F. Skinner'] },
      { skill: 'inference', text: 'What can be inferred about CBT\'s relapse rates compared to medication?', correct: 'Patients treated with CBT may be less likely to relapse after treatment stops.', distractors: ['CBT has higher relapse rates than medication.', 'Relapse rates are identical.', 'CBT causes more side effects.'] },
      { skill: 'purpose', text: 'Why does the author mention DBT and ACT?', correct: 'To show that the CBT framework has been successfully adapted for various conditions.', distractors: ['To suggest CBT is outdated.', 'To argue that all therapies are the same.', 'To criticize specialized approaches.'] },
      { skill: 'pov', text: 'The author\'s attitude toward CBT is:', correct: 'Positive and evidence-based, supported by research data.', distractors: ['Skeptical and dismissive.', 'Emotional and biased.', 'Neutral with no evaluation.'] },
      { skill: 'organization', text: 'How is the passage structured?', correct: 'Definition and history → evidence of effectiveness → modern adaptations.', distractors: ['Problem-solution.', 'Compare and contrast.', 'Narrative storytelling.'] },
      { skill: 'logic', text: 'What distinguishes CBT from psychoanalytic approaches?', correct: 'CBT focuses on changing present thought patterns rather than exploring unconscious motivations.', distractors: ['CBT takes longer than psychoanalysis.', 'CBT only works for anxiety.', 'Psychoanalysis is more evidence-based.'] },
    ]
  },
];

function generateReadingQuestions(count) {
  const skills = ['mainIdea', 'detail', 'inference', 'purpose', 'pov', 'organization', 'logic'];
  const questions = [];
  let passageIdx = 0;

  while (questions.length < count) {
    const passage = READING_PASSAGES[passageIdx % READING_PASSAGES.length];
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
    if (passageIdx > READING_PASSAGES.length * 3) break;
  }
  return questions.slice(0, count);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const token = getAccessToken();
  console.log('🔍 Fetching all exams from production...\n');

  const docs = await fetchAllDocs(token);

  // Find broken exams: reading-only with 0 questions, or reading-writing/mock with fewer questions than expected
  const broken = [];
  for (const doc of docs) {
    const f = doc.fields;
    const type = f?.examType?.stringValue;
    const qCount = f?.questions?.arrayValue?.values?.length || 0;
    const docId = doc.name.split('/').pop();
    const title = f?.title?.stringValue;

    if (type === 'reading' && qCount === 0) {
      broken.push({ docId, title, type, qCount, expected: 22, setNumber: f?.setNumber?.integerValue });
    } else if (type === 'reading-writing' && qCount < 40) {
      broken.push({ docId, title, type, qCount, expected: 43, setNumber: f?.setNumber?.integerValue });
    } else if (type === 'mock' && qCount < 80) {
      broken.push({ docId, title, type, qCount, expected: 91, setNumber: f?.setNumber?.integerValue });
    }
  }

  console.log(`Found ${broken.length} broken exams to fix:`);
  broken.forEach(b => console.log(`  ❌ ${b.title} (${b.type}): ${b.qCount}/${b.expected} questions`));

  if (broken.length === 0) {
    console.log('No broken exams found!');
    return;
  }

  // Delete broken exams
  console.log('\n🗑️  Deleting broken exams...');
  for (const b of broken) {
    try {
      await deleteDocument(b.docId, token);
      console.log(`  Deleted: ${b.title}`);
    } catch (err) {
      console.error(`  Failed to delete ${b.title}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Regenerate and re-upload
  console.log('\n📝 Regenerating fixed exams...');

  for (const b of broken) {
    const setNum = parseInt(b.setNumber, 10);
    let examData;

    if (b.type === 'reading') {
      const questions = generateReadingQuestions(22);
      const readingPassages = [...new Set(questions.map(q => q.passageTitle))];
      examData = {
        title: b.title,
        description: `Kaplan Nursing Entrance Exam - Reading Comprehension Practice Set ${setNum}. Tests main idea, supporting details, inference, author's purpose, point of view, and passage organization.`,
        timeLimitMinutes: 60,
        passingPercent: 70,
        showResultsToStudent: true,
        randomizeQuestions: true,
        allowPrevious: true,
        sections: [{ ...SECTIONS.reading }],
        questions,
        readingPassages,
        examType: 'reading',
        setNumber: setNum,
      };
    } else if (b.type === 'reading-writing') {
      const readQ = generateReadingQuestions(22);
      const readingPassages = [...new Set(readQ.map(q => q.passageTitle))];
      // We don't have writing questions here, so we need to get the existing writing questions from the broken doc
      // Actually, we'll just regenerate the whole thing. For now, let's skip writing regeneration.
      // The broken doc had 21 writing questions. We need to keep those.
      // Let me fetch the original data first.
      const origDoc = docs.find(d => d.name.split('/').pop() === b.docId);
      const origQuestions = origDoc.fields?.questions?.arrayValue?.values || [];
      // Extract existing writing questions (those without passageTitle)
      const writingQuestions = origQuestions.filter(v => {
        const fields = v.mapValue?.fields;
        return fields && !fields.passageTitle;
      }).map(v => {
        const f = v.mapValue.fields;
        return {
          text: f.text?.stringValue || '',
          category: f.category?.stringValue || '',
          choices: (f.choices?.arrayValue?.values || []).map(c => c.stringValue || ''),
          correctIndex: parseInt(f.correctIndex?.integerValue || '0', 10),
          solution: f.solution?.stringValue || '',
          sectionId: f.sectionId?.stringValue || '',
        };
      });

      const allQuestions = [...readQ, ...writingQuestions];
      examData = {
        title: b.title,
        description: `Kaplan Nursing Entrance Exam - Reading and Writing Practice ${setNum}. Tests reading comprehension, inference, writing mechanics, and passage development.`,
        timeLimitMinutes: 90,
        passingPercent: 70,
        showResultsToStudent: true,
        randomizeQuestions: true,
        allowPrevious: true,
        sections: [{ ...SECTIONS.reading }, { ...SECTIONS.writing }],
        questions: allQuestions,
        readingPassages,
        examType: 'reading-writing',
        setNumber: setNum,
      };
    } else if (b.type === 'mock') {
      const readQ = generateReadingQuestions(22);
      const readingPassages = [...new Set(readQ.map(q => q.passageTitle))];
      // Keep existing non-reading questions
      const origDoc = docs.find(d => d.name.split('/').pop() === b.docId);
      const origQuestions = origDoc.fields?.questions?.arrayValue?.values || [];
      const nonReadQuestions = origQuestions.filter(v => {
        const f = v.mapValue?.fields;
        return f && f.sectionId?.stringValue !== 'sec-reading';
      }).map(v => {
        const f = v.mapValue.fields;
        return {
          text: f.text?.stringValue || '',
          category: f.category?.stringValue || '',
          choices: (f.choices?.arrayValue?.values || []).map(c => c.stringValue || ''),
          correctIndex: parseInt(f.correctIndex?.integerValue || '0', 10),
          solution: f.solution?.stringValue || '',
          sectionId: f.sectionId?.stringValue || '',
          ...(f.passage?.stringValue ? { passage: f.passage.stringValue } : {}),
          ...(f.passageTitle?.stringValue ? { passageTitle: f.passageTitle.stringValue } : {}),
        };
      });

      const allQuestions = [...readQ, ...nonReadQuestions];
      examData = {
        title: b.title,
        description: `Kaplan Nursing Entrance Exam - Full Mock Exam ${setNum}. Comprehensive practice exam covering Reading, Math, Writing, and Science sections, simulating the actual Kaplan entrance exam format.`,
        timeLimitMinutes: 165,
        passingPercent: 70,
        showResultsToStudent: true,
        randomizeQuestions: true,
        allowPrevious: true,
        sections: [{ ...SECTIONS.reading }, { ...SECTIONS.math }, { ...SECTIONS.writing }, { ...SECTIONS.science }],
        questions: allQuestions,
        readingPassages,
        examType: 'mock',
        setNumber: setNum,
      };
    }

    try {
      const docId = Math.random().toString(36).substring(2, 15);
      await createDocument(docId, {
        ...examData,
        createdBy: ADMIN_UID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'published',
      }, token);
      console.log(`  ✅ Uploaded: ${b.title} (${examData.questions.length} questions)`);
    } catch (err) {
      console.error(`  ❌ Failed to upload ${b.title}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});