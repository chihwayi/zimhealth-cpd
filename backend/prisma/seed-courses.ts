import {
  PrismaClient,
  CPDCategory,
  Difficulty,
  Language,
  SpecialtyTrack,
  ContentType,
  QuestionType,
  CourseStatus,
} from '@prisma/client';

// Additional specialty-track courses, seeded so the course library actually
// reflects the tracks named in the partnership proposal (previously only one
// generic course existed). Zimbabwe-only for now (targets NCZ + MDPCZ) —
// other countries don't have a real council on the platform yet, so we don't
// invent content for them (see docs/sprints/03-seed-course-content.md).

interface SeedQuestion {
  text: string;
  options: Array<{ text: string; isCorrect: boolean }>;
}

interface SeedModule {
  title: string;
  sectionTitle: string;
  content: string;
}

interface SeedCourse {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: CPDCategory;
  specialtyTrack: SpecialtyTrack;
  difficulty: Difficulty;
  estimatedMinutes: number;
  tags: string[];
  points: number;
  modules: [SeedModule, SeedModule];
  quizTitle: string;
  questions: [SeedQuestion, SeedQuestion, SeedQuestion];
}

const COURSES: SeedCourse[] = [
  {
    slug: 'midwifery-essential-newborn-care',
    title: 'Essential Newborn Care and the Golden Hour',
    subtitle: 'Immediate care and early breastfeeding support for every birth',
    description:
      'Covers the WHO-recommended practices for the first hour of a newborn\'s life — thermal protection, cord care, and early breastfeeding initiation — and the warning signs that require escalation.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.MIDWIFERY,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 75,
    tags: ['midwifery', 'newborn care', 'breastfeeding', 'golden hour'],
    points: 3,
    modules: [
      {
        title: 'Module 1: Immediate Newborn Care',
        sectionTitle: 'The First Minutes of Life',
        content:
          '<h2>Immediate Newborn Care</h2><p>Immediately after birth, dry the newborn thoroughly and place them skin-to-skin on the mother\'s chest, covering both with a warm dry cloth. Delay cord clamping by at least one minute unless the newborn needs resuscitation. Skin-to-skin contact supports thermal regulation, early bonding, and breastfeeding initiation.</p><p>Avoid unnecessary separation of mother and baby in the first hour. Routine suctioning is not recommended for a vigorous newborn breathing normally.</p>',
      },
      {
        title: 'Module 2: Early Breastfeeding Support',
        sectionTitle: 'Supporting the First Feed',
        content:
          '<h2>Early Breastfeeding Support</h2><p>Most newborns are ready to breastfeed within the first hour. Look for feeding cues — rooting, hand-to-mouth movements, lip smacking — and support the mother to achieve a good latch: a wide-open mouth, more areola visible above the lip than below, and rhythmic swallowing.</p><p>Refer promptly if the newborn shows danger signs: poor feeding, grunting, chest indrawing, lethargy, or a temperature outside the normal range — these require immediate escalation per your institution\'s protocol.</p>',
      },
    ],
    quizTitle: 'Newborn Care Assessment',
    questions: [
      {
        text: 'How long should cord clamping be delayed for a vigorous newborn who does not need resuscitation?',
        options: [
          { text: 'At least 1 minute', isCorrect: true },
          { text: 'Immediately after birth', isCorrect: false },
          { text: '10 minutes', isCorrect: false },
          { text: 'Only after the placenta is delivered', isCorrect: false },
        ],
      },
      {
        text: 'Which of these is a feeding cue suggesting a newborn is ready to breastfeed?',
        options: [
          { text: 'Rooting and hand-to-mouth movements', isCorrect: true },
          { text: 'Deep sleep with no movement', isCorrect: false },
          { text: 'Crying continuously for over an hour', isCorrect: false },
          { text: 'Cold extremities', isCorrect: false },
        ],
      },
      {
        text: 'Which of these is a newborn danger sign requiring immediate escalation?',
        options: [
          { text: 'Chest indrawing', isCorrect: true },
          { text: 'Rooting reflex', isCorrect: false },
          { text: 'Skin-to-skin contact', isCorrect: false },
          { text: 'Rhythmic swallowing during a feed', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'midwifery-postpartum-haemorrhage',
    title: 'Recognizing and Responding to Postpartum Haemorrhage',
    subtitle: 'Early recognition and first response for the leading cause of maternal death',
    description:
      'Builds skill in recognizing risk factors and early signs of postpartum haemorrhage, and the correct initial response and escalation pathway while awaiting senior review.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.MIDWIFERY,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 90,
    tags: ['midwifery', 'postpartum haemorrhage', 'obstetric emergency'],
    points: 3,
    modules: [
      {
        title: 'Module 1: Risk Factors and Early Recognition',
        sectionTitle: 'Spotting PPH Early',
        content:
          '<h2>Risk Factors and Early Recognition</h2><p>Postpartum haemorrhage (PPH) is commonly caused by uterine atony, retained placental tissue, genital tract trauma, or clotting disorders. Known risk factors include prolonged labour, multiple pregnancy, previous PPH, and grand multiparity — but PPH can occur without any of these.</p><p>Estimate blood loss objectively where possible rather than by visual impression alone, and monitor maternal vital signs closely in the immediate postpartum period, as early tachycardia can precede a drop in blood pressure.</p>',
      },
      {
        title: 'Module 2: Initial Response and Escalation',
        sectionTitle: 'Acting Fast',
        content:
          '<h2>Initial Response and Escalation</h2><p>On suspecting PPH: call for help immediately, begin uterine massage, ensure the bladder is empty, and administer uterotonics per your institution\'s protocol. Establish IV access and begin fluid resuscitation as indicated.</p><p>Escalate to a senior clinician without delay if bleeding continues despite initial measures — do not wait to see if it settles. Document timings and interventions accurately as care progresses.</p>',
      },
    ],
    quizTitle: 'PPH Response Assessment',
    questions: [
      {
        text: 'What is the most common cause of postpartum haemorrhage?',
        options: [
          { text: 'Uterine atony', isCorrect: true },
          { text: 'Maternal anaemia alone', isCorrect: false },
          { text: 'Delayed cord clamping', isCorrect: false },
          { text: 'Skin-to-skin contact', isCorrect: false },
        ],
      },
      {
        text: 'What is the first action on suspecting PPH?',
        options: [
          { text: 'Call for help and begin uterine massage', isCorrect: true },
          { text: 'Wait 30 minutes to confirm the diagnosis', isCorrect: false },
          { text: 'Discharge the mother for home monitoring', isCorrect: false },
          { text: 'Delay uterotonics until a doctor arrives', isCorrect: false },
        ],
      },
      {
        text: 'Why is visual estimation of blood loss alone unreliable?',
        options: [
          { text: 'It commonly underestimates true blood loss', isCorrect: true },
          { text: 'It always overestimates blood loss', isCorrect: false },
          { text: 'It is more accurate than any other method', isCorrect: false },
          { text: 'Blood loss cannot be estimated in any way', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'ot-surgical-safety-checklist',
    title: 'Surgical Safety Checklist in Practice',
    subtitle: 'Applying the WHO checklist to prevent avoidable surgical harm',
    description:
      'Explains the three phases of the WHO Surgical Safety Checklist and how structured team communication prevents wrong-site surgery and other never events.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.OPERATING_THEATRE,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['operating theatre', 'surgical safety', 'checklist'],
    points: 2,
    modules: [
      {
        title: 'Module 1: The Three Phases',
        sectionTitle: 'Sign In, Time Out, Sign Out',
        content:
          '<h2>The Three Phases of the Checklist</h2><p>The WHO Surgical Safety Checklist has three phases: <b>Sign In</b> before anaesthesia (confirming patient identity, site, procedure, and consent), <b>Time Out</b> before skin incision (final team confirmation of patient, site, and procedure, plus anticipated critical events), and <b>Sign Out</b> before the patient leaves theatre (confirming counts, specimen labelling, and equipment concerns).</p><p>Every phase requires the full team to actively participate, not just the person reading the checklist aloud.</p>',
      },
      {
        title: 'Module 2: Team Communication and Never Events',
        sectionTitle: 'Preventing Never Events',
        content:
          '<h2>Team Communication and Never Events</h2><p>Wrong-site surgery, retained surgical items, and wrong-patient procedures are preventable "never events." Closed-loop communication — where an instruction is repeated back and confirmed — reduces the risk of miscommunication in a busy theatre environment.</p><p>Every team member, regardless of seniority, should be empowered to pause the process (a "stop the line" culture) if something appears incorrect.</p>',
      },
    ],
    quizTitle: 'Surgical Safety Assessment',
    questions: [
      {
        text: 'When does the "Time Out" phase of the checklist happen?',
        options: [
          { text: 'Before skin incision', isCorrect: true },
          { text: 'Before anaesthesia', isCorrect: false },
          { text: 'After the patient leaves theatre', isCorrect: false },
          { text: 'Only for emergency procedures', isCorrect: false },
        ],
      },
      {
        text: 'What is closed-loop communication?',
        options: [
          { text: 'Repeating an instruction back to confirm it was understood correctly', isCorrect: true },
          { text: 'Only the surgeon speaking during a procedure', isCorrect: false },
          { text: 'Writing notes instead of speaking', isCorrect: false },
          { text: 'Skipping verbal confirmation to save time', isCorrect: false },
        ],
      },
      {
        text: 'Who should be empowered to pause a procedure if something seems wrong?',
        options: [
          { text: 'Any team member, regardless of seniority', isCorrect: true },
          { text: 'Only the lead surgeon', isCorrect: false },
          { text: 'Only the theatre manager', isCorrect: false },
          { text: 'No one — the checklist cannot be interrupted', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'ot-instrument-swab-count',
    title: 'Instrument and Swab Count Accountability',
    subtitle: 'Preventing retained surgical items through disciplined counting',
    description:
      'Covers when and how instrument, swab, and sharps counts must happen, and the correct escalation process when a count discrepancy occurs.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.OPERATING_THEATRE,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['operating theatre', 'swab count', 'patient safety'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Counting Protocols',
        sectionTitle: 'When and How Counts Happen',
        content:
          '<h2>Counting Protocols</h2><p>Instrument, swab, and sharps counts should happen before the procedure begins, before closure of a cavity within a cavity, before wound closure, and at skin closure. Counts should be performed by two people, one of whom is a scrub nurse, and documented clearly and immediately.</p><p>Counting is a shared responsibility of the whole team, not just the scrub nurse — the surgeon and circulating nurse both play a role in confirming an accurate count.</p>',
      },
      {
        title: 'Module 2: Managing a Count Discrepancy',
        sectionTitle: 'When the Count Doesn\'t Match',
        content:
          '<h2>Managing a Count Discrepancy</h2><p>If a count is incorrect, stop and systematically search the field, the floor, and waste before considering closure. If the item still cannot be found, imaging (such as an X-ray) should be performed before the patient leaves theatre.</p><p>Every discrepancy, whether resolved or not, must be documented and reported through your institution\'s incident reporting system so patterns can be identified and addressed.</p>',
      },
    ],
    quizTitle: 'Count Accountability Assessment',
    questions: [
      {
        text: 'Who should be involved in performing a surgical count?',
        options: [
          { text: 'Two people, including a scrub nurse', isCorrect: true },
          { text: 'Only the surgeon', isCorrect: false },
          { text: 'One person, to save time', isCorrect: false },
          { text: 'The anaesthetist only', isCorrect: false },
        ],
      },
      {
        text: 'What should happen if an item cannot be found after a systematic search?',
        options: [
          { text: 'Imaging should be performed before the patient leaves theatre', isCorrect: true },
          { text: 'Close the wound and monitor the patient afterward', isCorrect: false },
          { text: 'Assume the count was wrong and proceed', isCorrect: false },
          { text: 'Only document it if the patient develops symptoms later', isCorrect: false },
        ],
      },
      {
        text: 'Why should every count discrepancy be reported, even if later resolved?',
        options: [
          { text: 'So patterns can be identified and prevented in future', isCorrect: true },
          { text: 'It is only necessary if the item is never found', isCorrect: false },
          { text: 'Reporting is optional and rarely useful', isCorrect: false },
          { text: 'Only the surgeon needs to know, not the institution', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'mental-health-first-aid',
    title: 'Mental Health First Aid for Frontline Nurses',
    subtitle: 'Recognizing crisis and responding with the ALGEE framework',
    description:
      'Introduces the warning signs of a mental health crisis, including suicide risk indicators, and a structured action plan for providing initial support.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.MENTAL_HEALTH,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 75,
    tags: ['mental health', 'crisis response', 'first aid'],
    points: 3,
    modules: [
      {
        title: 'Module 1: Recognizing a Mental Health Crisis',
        sectionTitle: 'Warning Signs',
        content:
          '<h2>Recognizing a Mental Health Crisis</h2><p>Warning signs of a developing crisis include withdrawal, marked changes in mood or behaviour, expressions of hopelessness, and statements about not wanting to be alive. Any mention of suicidal thoughts should always be taken seriously and never dismissed as attention-seeking.</p><p>Approach the person calmly, in a private space if possible, and use active listening — giving your full attention without interrupting or judging what they share.</p>',
      },
      {
        title: 'Module 2: The ALGEE Action Plan',
        sectionTitle: 'A Structured Response',
        content:
          '<h2>The ALGEE Action Plan</h2><p>ALGEE is a memory aid for mental health first aid: <b>A</b>ssess for risk of harm, <b>L</b>isten non-judgementally, <b>G</b>ive reassurance and information, <b>E</b>ncourage appropriate professional help, and <b>E</b>ncourage other supports (self-help and social support).</p><p>If there is an immediate risk to life, do not leave the person alone — follow your institution\'s emergency mental health protocol and escalate immediately.</p>',
      },
    ],
    quizTitle: 'Mental Health First Aid Assessment',
    questions: [
      {
        text: 'How should a statement about not wanting to be alive be treated?',
        options: [
          { text: 'Always taken seriously', isCorrect: true },
          { text: 'Dismissed if said calmly', isCorrect: false },
          { text: 'Ignored unless repeated multiple times', isCorrect: false },
          { text: 'Only addressed if a family member confirms it', isCorrect: false },
        ],
      },
      {
        text: 'What does the first "A" in ALGEE stand for?',
        options: [
          { text: 'Assess for risk of harm', isCorrect: true },
          { text: 'Advise medication immediately', isCorrect: false },
          { text: 'Avoid the situation', isCorrect: false },
          { text: 'Alert the media', isCorrect: false },
        ],
      },
      {
        text: 'What should you do if there is an immediate risk to life?',
        options: [
          { text: 'Do not leave the person alone and escalate immediately', isCorrect: true },
          { text: 'Ask them to come back tomorrow', isCorrect: false },
          { text: 'Leave them to calm down alone', isCorrect: false },
          { text: 'Wait until the end of your shift to report it', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'mental-health-deescalation',
    title: 'De-escalation Techniques in Acute Care',
    subtitle: 'Verbal and environmental strategies to safely reduce agitation',
    description:
      'Covers recognizing early signs of escalating agitation and using verbal de-escalation and environmental adjustments to reduce risk for patients and staff.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.MENTAL_HEALTH,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['mental health', 'de-escalation', 'acute care'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Understanding Escalation',
        sectionTitle: 'Triggers and Early Warning Behaviours',
        content:
          '<h2>Understanding Escalation</h2><p>Agitation often escalates gradually rather than suddenly. Early warning behaviours include pacing, raised voice, clenched fists, and refusal to engage. Environmental factors — noise, crowding, long waits — can worsen agitation.</p><p>Recognizing escalation early allows staff to intervene before a situation becomes a safety risk.</p>',
      },
      {
        title: 'Module 2: Verbal De-escalation Skills',
        sectionTitle: 'Reducing Tension Safely',
        content:
          '<h2>Verbal De-escalation Skills</h2><p>Use a calm tone, open body language, and maintain a safe distance while avoiding a confrontational stance. Offer the person choices where possible, rather than issuing demands, and validate their feelings without necessarily agreeing with their actions.</p><p>Always have an exit route and know your institution\'s protocol for calling for additional support if de-escalation is not working.</p>',
      },
    ],
    quizTitle: 'De-escalation Assessment',
    questions: [
      {
        text: 'What is an early warning behaviour of escalating agitation?',
        options: [
          { text: 'Pacing and a raised voice', isCorrect: true },
          { text: 'Calm, quiet breathing', isCorrect: false },
          { text: 'Falling asleep', isCorrect: false },
          { text: 'Asking polite questions', isCorrect: false },
        ],
      },
      {
        text: 'Which approach supports effective de-escalation?',
        options: [
          { text: 'Offering choices rather than issuing demands', isCorrect: true },
          { text: 'Standing very close and raising your voice', isCorrect: false },
          { text: 'Ignoring the person completely', isCorrect: false },
          { text: 'Arguing to prove they are wrong', isCorrect: false },
        ],
      },
      {
        text: 'What should you always ensure during a potentially escalating situation?',
        options: [
          { text: 'You have a safe exit route', isCorrect: true },
          { text: 'The door is locked behind you', isCorrect: false },
          { text: 'You are alone with the person', isCorrect: false },
          { text: 'You avoid calling for help to prevent embarrassment', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'pediatric-deteriorating-child',
    title: 'Recognizing the Deteriorating Child',
    subtitle: 'Paediatric early warning signs and structured escalation',
    description:
      'Builds skill in recognizing the physiological signs that a child is deteriorating and communicating concerns clearly using structured handover.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.PEDIATRIC,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 75,
    tags: ['pediatric', 'early warning signs', 'deteriorating patient'],
    points: 3,
    modules: [
      {
        title: 'Module 1: Paediatric Early Warning Signs',
        sectionTitle: 'What to Watch For',
        content:
          '<h2>Paediatric Early Warning Signs</h2><p>Children can compensate for illness for longer than adults before deteriorating rapidly, which makes early recognition critical. Key signs to monitor include respiratory rate and effort, work of breathing (grunting, nasal flaring, chest indrawing), capillary refill time, and level of consciousness.</p><p>A child who is unusually quiet or difficult to rouse should always raise concern, even if other signs appear reassuring.</p>',
      },
      {
        title: 'Module 2: Escalation and Communication',
        sectionTitle: 'Speaking Up Clearly',
        content:
          '<h2>Escalation and Communication</h2><p>Use a structured handover format such as SBAR (Situation, Background, Assessment, Recommendation) when raising a concern about a child\'s condition — this ensures critical information is not lost.</p><p>If your concern is not acted on and the child\'s condition is not improving, escalate to a senior clinician directly rather than waiting.</p>',
      },
    ],
    quizTitle: 'Deteriorating Child Assessment',
    questions: [
      {
        text: 'Why is early recognition of deterioration especially important in children?',
        options: [
          { text: 'Children can compensate for longer before deteriorating rapidly', isCorrect: true },
          { text: 'Children never show signs of deterioration', isCorrect: false },
          { text: 'Children deteriorate identically to adults', isCorrect: false },
          { text: 'Vital signs are not useful in children', isCorrect: false },
        ],
      },
      {
        text: 'What does the "B" in SBAR stand for?',
        options: [
          { text: 'Background', isCorrect: true },
          { text: 'Breathing', isCorrect: false },
          { text: 'Blood pressure', isCorrect: false },
          { text: 'Bedside', isCorrect: false },
        ],
      },
      {
        text: 'What should you do if your concern about a child is not acted on and their condition is not improving?',
        options: [
          { text: 'Escalate directly to a senior clinician', isCorrect: true },
          { text: 'Wait until the next scheduled review', isCorrect: false },
          { text: 'Document it and take no further action', isCorrect: false },
          { text: 'Assume the first assessment was correct', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'general-refresher-vital-signs-ews',
    title: 'Vital Signs and Early Warning Scores Refresher',
    subtitle: 'Accurate measurement and using early warning scores correctly',
    description:
      'A refresher on accurate vital signs technique and how early warning scores are used to trigger timely escalation for any deteriorating patient.',
    category: CPDCategory.CLINICAL,
    specialtyTrack: SpecialtyTrack.GENERAL_REFRESHER,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 60,
    tags: ['vital signs', 'early warning score', 'refresher'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Accurate Vital Signs Measurement',
        sectionTitle: 'Getting the Basics Right',
        content:
          '<h2>Accurate Vital Signs Measurement</h2><p>Common errors in vital signs measurement include counting respiratory rate for too short a period, estimating rather than measuring, and using incorrectly sized equipment. Vital signs should be measured at a frequency appropriate to the patient\'s clinical condition, not just a fixed routine.</p><p>Accurate measurement is the foundation of any early warning score — an incorrect input produces a misleading score.</p>',
      },
      {
        title: 'Module 2: Using Early Warning Scores',
        sectionTitle: 'From Score to Action',
        content:
          '<h2>Using Early Warning Scores</h2><p>Early warning scores combine several vital signs into a single trigger threshold that prompts a defined escalation action, such as increased monitoring frequency or urgent senior review. The score is a prompt to act, not a replacement for clinical judgement — a patient who "looks wrong" should be escalated even with a reassuring score.</p><p>Document the score and the action taken every time it is calculated, so the patient\'s trend over time is visible to the whole team.</p>',
      },
    ],
    quizTitle: 'Vital Signs Refresher Assessment',
    questions: [
      {
        text: 'What is a common error when measuring respiratory rate?',
        options: [
          { text: 'Counting for too short a period', isCorrect: true },
          { text: 'Counting for a full minute', isCorrect: false },
          { text: 'Observing chest movement', isCorrect: false },
          { text: 'Recording the result immediately', isCorrect: false },
        ],
      },
      {
        text: 'Why does an early warning score depend on accurate vital signs?',
        options: [
          { text: 'An incorrect input produces a misleading score', isCorrect: true },
          { text: 'The score ignores vital signs entirely', isCorrect: false },
          { text: 'Vital signs are unrelated to escalation', isCorrect: false },
          { text: 'Scores are calculated without any measurements', isCorrect: false },
        ],
      },
      {
        text: 'What should trigger vital signs to be measured more frequently?',
        options: [
          { text: 'A change in the patient\'s clinical condition', isCorrect: true },
          { text: 'The end of a fixed routine schedule only', isCorrect: false },
          { text: 'Staff availability alone', isCorrect: false },
          { text: 'Never — frequency should always stay the same', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'nursing-education-clinical-teaching',
    title: 'Clinical Teaching and Preceptorship Skills',
    subtitle: 'Supporting learners safely and effectively at the bedside',
    description:
      'Introduces adult learning principles and effective feedback techniques for nurses supervising students or newly qualified colleagues.',
    category: CPDCategory.MANAGEMENT,
    specialtyTrack: SpecialtyTrack.NURSING_EDUCATION,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 60,
    tags: ['nursing education', 'preceptorship', 'clinical teaching'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Principles of Adult Learning',
        sectionTitle: 'How Adults Learn Best',
        content:
          '<h2>Principles of Adult Learning</h2><p>Adult learners bring prior experience and learn best when new information connects to what they already know. Creating a psychologically safe environment — where learners feel able to ask questions and make mistakes without fear of humiliation — is essential for genuine learning to happen.</p><p>Set clear expectations at the start of a placement or shadowing period so the learner knows what they are working toward.</p>',
      },
      {
        title: 'Module 2: Giving Effective Feedback',
        sectionTitle: 'Feedback That Helps',
        content:
          '<h2>Giving Effective Feedback</h2><p>Effective feedback is specific, timely, and focused on behaviour rather than personality. The SBI model — Situation, Behaviour, Impact — helps structure feedback clearly: describe the situation, the specific behaviour observed, and its impact.</p><p>Document competency assessments honestly and promptly; vague or delayed feedback does not help a learner improve.</p>',
      },
    ],
    quizTitle: 'Clinical Teaching Assessment',
    questions: [
      {
        text: 'Why is a psychologically safe learning environment important?',
        options: [
          { text: 'It allows learners to ask questions and make mistakes without fear', isCorrect: true },
          { text: 'It removes the need for any feedback', isCorrect: false },
          { text: 'It means learners are never corrected', isCorrect: false },
          { text: 'It is only relevant for senior staff', isCorrect: false },
        ],
      },
      {
        text: 'What does the "B" in the SBI feedback model stand for?',
        options: [
          { text: 'Behaviour', isCorrect: true },
          { text: 'Belief', isCorrect: false },
          { text: 'Background', isCorrect: false },
          { text: 'Bias', isCorrect: false },
        ],
      },
      {
        text: 'What makes feedback most effective?',
        options: [
          { text: 'Being specific, timely, and focused on behaviour', isCorrect: true },
          { text: 'Being vague so it doesn\'t upset the learner', isCorrect: false },
          { text: 'Being delayed until the end of a rotation', isCorrect: false },
          { text: 'Focusing on personality rather than actions', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'nursing-administration-staffing',
    title: 'Nurse Staffing and Workload Management',
    subtitle: 'Principles of safe staffing and managing competing priorities',
    description:
      'Covers the principles of acuity-based staffing, escalating safely when short-staffed, and delegation practices that keep patients safe.',
    category: CPDCategory.MANAGEMENT,
    specialtyTrack: SpecialtyTrack.NURSING_ADMINISTRATION,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 60,
    tags: ['nursing administration', 'staffing', 'workload management'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Principles of Safe Staffing',
        sectionTitle: 'Matching Staff to Need',
        content:
          '<h2>Principles of Safe Staffing</h2><p>Safe staffing considers patient acuity and skill mix, not just headcount. A ward with fewer, higher-acuity patients may need the same or more nursing time than a ward with more, lower-acuity patients.</p><p>When staffing falls below a safe level, escalate through your institution\'s formal process rather than simply absorbing the extra workload informally — this protects both patients and staff.</p>',
      },
      {
        title: 'Module 2: Managing Competing Priorities',
        sectionTitle: 'Delegation and Handover',
        content:
          '<h2>Managing Competing Priorities</h2><p>Effective delegation means matching tasks to the skill and scope of practice of the person receiving them, and remaining accountable for the outcome. Clear, structured shift handovers reduce the risk of important information being lost between shifts.</p><p>When priorities conflict, patient safety always takes precedence over administrative tasks.</p>',
      },
    ],
    quizTitle: 'Staffing and Workload Assessment',
    questions: [
      {
        text: 'What should safe staffing decisions be based on, beyond headcount?',
        options: [
          { text: 'Patient acuity and skill mix', isCorrect: true },
          { text: 'Only the number of beds on the ward', isCorrect: false },
          { text: 'The day of the week alone', isCorrect: false },
          { text: 'Staff preference only', isCorrect: false },
        ],
      },
      {
        text: 'What should happen when staffing falls below a safe level?',
        options: [
          { text: 'Escalate through the formal process', isCorrect: true },
          { text: 'Absorb the extra workload silently', isCorrect: false },
          { text: 'Reduce documentation to save time instead', isCorrect: false },
          { text: 'Wait until the next scheduled staffing review', isCorrect: false },
        ],
      },
      {
        text: 'What takes precedence when priorities conflict?',
        options: [
          { text: 'Patient safety', isCorrect: true },
          { text: 'Administrative paperwork', isCorrect: false },
          { text: 'Finishing on time', isCorrect: false },
          { text: 'Whichever task was assigned first', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'nursing-research-ebp-fundamentals',
    title: 'Evidence-Based Practice Fundamentals',
    subtitle: 'Asking good clinical questions and applying evidence at the bedside',
    description:
      'Introduces the evidence-based practice cycle — from forming a clear clinical question to appraising evidence and applying it alongside clinical judgement.',
    category: CPDCategory.RESEARCH,
    specialtyTrack: SpecialtyTrack.NURSING_RESEARCH,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 60,
    tags: ['nursing research', 'evidence-based practice'],
    points: 2,
    modules: [
      {
        title: 'Module 1: The EBP Cycle',
        sectionTitle: 'Asking a Good Question',
        content:
          '<h2>The Evidence-Based Practice Cycle</h2><p>Evidence-based practice starts with a well-formed clinical question, often structured using PICO: Population, Intervention, Comparison, Outcome. A clear question makes it far easier to find relevant evidence.</p><p>Not all evidence carries equal weight — appraise the quality and relevance of a source before relying on it to change practice.</p>',
      },
      {
        title: 'Module 2: Applying Evidence at the Bedside',
        sectionTitle: 'From Evidence to Practice',
        content:
          '<h2>Applying Evidence at the Bedside</h2><p>Evidence-based practice integrates the best available evidence with clinical judgement and the individual patient\'s values and circumstances — none of these three alone is sufficient.</p><p>Before changing practice based on new evidence, consider your institution\'s protocols and whether local context (resources, patient population) affects how the evidence applies.</p>',
      },
    ],
    quizTitle: 'Evidence-Based Practice Assessment',
    questions: [
      {
        text: 'What does the "P" in PICO stand for?',
        options: [
          { text: 'Population', isCorrect: true },
          { text: 'Protocol', isCorrect: false },
          { text: 'Prognosis', isCorrect: false },
          { text: 'Practice', isCorrect: false },
        ],
      },
      {
        text: 'What three elements does evidence-based practice integrate?',
        options: [
          { text: 'Best evidence, clinical judgement, and patient values', isCorrect: true },
          { text: 'Evidence only, regardless of patient context', isCorrect: false },
          { text: 'Tradition, habit, and convenience', isCorrect: false },
          { text: 'Cost alone', isCorrect: false },
        ],
      },
      {
        text: 'Why should evidence be appraised before it changes practice?',
        options: [
          { text: 'Not all evidence is of equal quality or relevance', isCorrect: true },
          { text: 'All published evidence is equally reliable', isCorrect: false },
          { text: 'Appraisal is only needed for research papers', isCorrect: false },
          { text: 'It is unnecessary if the source seems credible', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'data-analytics-in-healthcare',
    title: 'Introduction to Data Analytics in Healthcare',
    subtitle: 'Reading and interpreting the data nurses generate every day',
    description:
      'Explains why nursing-generated data matters for quality improvement, and how to interpret basic reports and trends without common misreadings.',
    category: CPDCategory.RESEARCH,
    specialtyTrack: SpecialtyTrack.DATA_ANALYTICS,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['data analytics', 'quality improvement', 'health data'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Why Data Matters in Nursing',
        sectionTitle: 'From Bedside to Big Picture',
        content:
          '<h2>Why Data Matters in Nursing</h2><p>Routine nursing documentation — vital signs, incident reports, audit data — feeds into quality indicators that reveal patterns invisible at the bedside, such as rising infection rates or recurring medication errors.</p><p>Accurate, timely documentation is what makes this data trustworthy; incomplete records produce misleading analytics regardless of how sophisticated the analysis is.</p>',
      },
      {
        title: 'Module 2: Reading and Interpreting Basic Reports',
        sectionTitle: 'Avoiding Common Misreadings',
        content:
          '<h2>Reading and Interpreting Basic Reports</h2><p>A raw count (e.g. "12 falls this month") means little without context — a rate (falls per 1,000 patient-days) allows fair comparison over time or between wards. A single data point going up or down is not necessarily a trend; look for a sustained pattern using a run chart before drawing conclusions.</p><p>Correlation in data does not prove causation — a rise in two measures together does not mean one caused the other.</p>',
      },
    ],
    quizTitle: 'Data Analytics Assessment',
    questions: [
      {
        text: 'Why is a rate often more useful than a raw count?',
        options: [
          { text: 'It allows fair comparison over time or between wards', isCorrect: true },
          { text: 'It is always a smaller number', isCorrect: false },
          { text: 'Raw counts are never useful', isCorrect: false },
          { text: 'Rates remove the need for documentation', isCorrect: false },
        ],
      },
      {
        text: 'What is needed before concluding a real trend exists?',
        options: [
          { text: 'A sustained pattern over time, not one data point', isCorrect: true },
          { text: 'One month of data is always sufficient', isCorrect: false },
          { text: 'A single unusual reading', isCorrect: false },
          { text: 'Staff opinion alone', isCorrect: false },
        ],
      },
      {
        text: 'What is true about correlation between two measures?',
        options: [
          { text: 'It does not prove one causes the other', isCorrect: true },
          { text: 'It always proves causation', isCorrect: false },
          { text: 'It is the same thing as causation', isCorrect: false },
          { text: 'It should always be ignored', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'health-informatics-ehr-documentation',
    title: 'Electronic Health Records and Clinical Documentation',
    subtitle: 'Documentation practices that keep patients safe',
    description:
      'Covers the principles of good clinical documentation and how data quality in electronic records supports safe continuity of care.',
    category: CPDCategory.MANAGEMENT,
    specialtyTrack: SpecialtyTrack.HEALTH_INFORMATICS,
    difficulty: Difficulty.FOUNDATION,
    estimatedMinutes: 60,
    tags: ['health informatics', 'electronic health records', 'documentation'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Principles of Good Documentation',
        sectionTitle: 'Accurate and Timely Records',
        content:
          '<h2>Principles of Good Documentation</h2><p>Good clinical documentation is accurate, timely, and objective. Record findings as close to the time of assessment as possible — memory of details fades quickly in a busy shift.</p><p>Be cautious with "copy-forward" features in electronic records: carrying forward outdated information without review can introduce errors into a patient\'s current record.</p>',
      },
      {
        title: 'Module 2: Data Quality and Continuity of Care',
        sectionTitle: 'Why Documentation Quality Matters',
        content:
          '<h2>Data Quality and Continuity of Care</h2><p>Structured fields (checkboxes, dropdowns) make data easier to analyse and search, while free text captures nuance a structured field cannot — good records use both appropriately. Incomplete or inconsistent documentation is a leading contributor to handover errors and missed changes in a patient\'s condition.</p><p>Think of every entry as something the next clinician will rely on to make a safe decision, even if you are not there to explain it.</p>',
      },
    ],
    quizTitle: 'Documentation Assessment',
    questions: [
      {
        text: 'Why should findings be documented close to the time of assessment?',
        options: [
          { text: 'Memory of details fades quickly', isCorrect: true },
          { text: 'It is required only at the end of a shift', isCorrect: false },
          { text: 'It makes the record shorter', isCorrect: false },
          { text: 'It is not actually important', isCorrect: false },
        ],
      },
      {
        text: 'What is a risk of the "copy-forward" feature in electronic records?',
        options: [
          { text: 'Carrying forward outdated information without review', isCorrect: true },
          { text: 'It always improves accuracy', isCorrect: false },
          { text: 'It removes the need for any documentation', isCorrect: false },
          { text: 'It has no effect on data quality', isCorrect: false },
        ],
      },
      {
        text: 'Why does documentation quality matter for continuity of care?',
        options: [
          { text: 'The next clinician relies on it to understand the patient\'s status', isCorrect: true },
          { text: 'It is only relevant for billing purposes', isCorrect: false },
          { text: 'It has no impact on handover', isCorrect: false },
          { text: 'Verbal handover always replaces the need for records', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'data-protection-privacy-essentials',
    title: 'Patient Data Protection and Privacy Essentials',
    subtitle: 'Confidentiality principles and safeguarding patient information',
    description:
      'Covers core patient confidentiality principles and practical safeguards for handling both physical and digital patient records responsibly.',
    category: CPDCategory.ETHICS,
    specialtyTrack: SpecialtyTrack.DATA_PROTECTION,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['data protection', 'privacy', 'confidentiality'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Core Principles of Patient Confidentiality',
        sectionTitle: 'Need-to-Know Access',
        content:
          '<h2>Core Principles of Patient Confidentiality</h2><p>Patient information should only be accessed and shared on a need-to-know basis, even among colleagues. Sharing patient details socially, even without naming the patient, can risk identification and breaches trust.</p><p>Obtain the patient\'s consent before sharing information with family members or other parties, except where required by law or in an emergency where the patient cannot consent.</p>',
      },
      {
        title: 'Module 2: Practical Safeguards and Breach Reporting',
        sectionTitle: 'Protecting Records in Practice',
        content:
          '<h2>Practical Safeguards and Breach Reporting</h2><p>Protect physical records by not leaving them unattended in public areas, and protect digital records by never sharing login credentials and always logging out of shared devices. Follow your institution\'s policy — informed by data protection legislation — for the lawful handling of patient information.</p><p>If you suspect a data breach, report it immediately through your institution\'s formal process rather than attempting to handle it informally — early reporting limits harm and is a professional obligation.</p>',
      },
    ],
    quizTitle: 'Data Protection Assessment',
    questions: [
      {
        text: 'On what basis should patient information be accessed?',
        options: [
          { text: 'Need-to-know basis', isCorrect: true },
          { text: 'Any staff member can access any record', isCorrect: false },
          { text: 'Only if the patient is not present', isCorrect: false },
          { text: 'Based on seniority alone', isCorrect: false },
        ],
      },
      {
        text: 'What should you do before sharing patient information with a family member?',
        options: [
          { text: 'Obtain the patient\'s consent, except where law or emergency requires otherwise', isCorrect: true },
          { text: 'Share it freely with any relative who asks', isCorrect: false },
          { text: 'Always refuse, even in an emergency', isCorrect: false },
          { text: 'Only share it if asked twice', isCorrect: false },
        ],
      },
      {
        text: 'What should you do if you suspect a data breach?',
        options: [
          { text: 'Report it immediately through the formal process', isCorrect: true },
          { text: 'Handle it informally without reporting', isCorrect: false },
          { text: 'Wait to see if anyone notices', isCorrect: false },
          { text: 'Only mention it if directly asked', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'nursing-entrepreneurship-private-practice',
    title: 'Nursing Entrepreneurship: Starting a Private Practice',
    subtitle: 'Assessing feasibility and running a small practice safely',
    description:
      'Introduces the basics of assessing whether a private nursing service is feasible, the regulatory requirements involved, and safe practice outside an institutional setting.',
    category: CPDCategory.MANAGEMENT,
    specialtyTrack: SpecialtyTrack.ENTREPRENEURSHIP,
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 60,
    tags: ['entrepreneurship', 'private practice', 'small business'],
    points: 2,
    modules: [
      {
        title: 'Module 1: Assessing Feasibility',
        sectionTitle: 'Is There a Real Need?',
        content:
          '<h2>Assessing Feasibility</h2><p>Before starting a private practice, identify a genuine service gap in your community rather than assuming demand exists. Understand the regulatory registration requirements for operating independently under your council\'s rules — practicing outside your registered scope is both unsafe and unlawful.</p><p>Speak to colleagues already running similar services where possible, and be realistic about the time and resources required to establish a new practice.</p>',
      },
      {
        title: 'Module 2: Basics of Running a Small Health Practice',
        sectionTitle: 'Operating Safely and Sustainably',
        content:
          '<h2>Basics of Running a Small Health Practice</h2><p>Even outside an institutional setting, the same patient safety standards apply — accurate record-keeping, informed consent, and appropriate referral when a case is beyond your scope. Keep basic financial records separate from personal finances from the outset.</p><p>Understand your liability and insurance obligations before seeing your first client — operating without appropriate cover exposes both you and your patients to unnecessary risk.</p>',
      },
    ],
    quizTitle: 'Nursing Entrepreneurship Assessment',
    questions: [
      {
        text: 'What should be established before starting a private practice?',
        options: [
          { text: 'A genuine service gap and the relevant regulatory requirements', isCorrect: true },
          { text: 'Nothing — any nurse can start immediately', isCorrect: false },
          { text: 'Only a business name', isCorrect: false },
          { text: 'Assumed demand without research', isCorrect: false },
        ],
      },
      {
        text: 'What patient safety standards apply in a private practice setting?',
        options: [
          { text: 'The same standards as institutional practice', isCorrect: true },
          { text: 'No standards, since it is not an institution', isCorrect: false },
          { text: 'Lower standards are acceptable', isCorrect: false },
          { text: 'Standards only apply to hospitals', isCorrect: false },
        ],
      },
      {
        text: 'What should be arranged before seeing a first client independently?',
        options: [
          { text: 'Appropriate liability and insurance cover', isCorrect: true },
          { text: 'Nothing beyond enthusiasm', isCorrect: false },
          { text: 'A social media following only', isCorrect: false },
          { text: 'Cover is never necessary for nurses', isCorrect: false },
        ],
      },
    ],
  },
];

interface SeedContext {
  db: PrismaClient;
  creatorId: string;
  nczCouncilId: string;
  mdpczCouncilId: string;
  reviewerId: string;
}

export async function seedSpecialtyCourses(ctx: SeedContext): Promise<void> {
  const { db, creatorId, nczCouncilId, mdpczCouncilId, reviewerId } = ctx;

  for (const c of COURSES) {
    const courseId = `course-seed-${c.slug}`;
    const course = await db.course.upsert({
      where: { id: courseId },
      update: {
        specialtyTrack: c.specialtyTrack,
        targetCouncilIds: [nczCouncilId, mdpczCouncilId],
      },
      create: {
        id: courseId,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        category: c.category,
        specialtyTrack: c.specialtyTrack,
        targetCadres: ['NURSE', 'MIDWIFE', 'CLINICAL_OFFICER'],
        targetCouncilIds: [nczCouncilId, mdpczCouncilId],
        targetTitles: ['Registered General Nurse', 'Registered Midwife', 'Clinical Officer'],
        difficulty: c.difficulty,
        language: Language.ENGLISH,
        cpdPoints: 0,
        estimatedMinutes: c.estimatedMinutes,
        accreditationBody: 'NCZ',
        tags: c.tags,
        status: CourseStatus.PUBLISHED,
        creatorId,
      },
    });

    await db.councilCourseReview.createMany({
      skipDuplicates: true,
      data: [
        { courseId: course.id, councilId: nczCouncilId, status: 'APPROVED', points: c.points, reviewedAt: new Date(), reviewedByUserId: reviewerId },
        { courseId: course.id, councilId: mdpczCouncilId, status: 'APPROVED', points: c.points, reviewedAt: new Date(), reviewedByUserId: reviewerId },
      ],
    });

    let lastModuleId = '';
    for (let i = 0; i < c.modules.length; i++) {
      const mod = c.modules[i];
      const moduleId = `${courseId}-module-${i + 1}`;
      const dbModule = await db.module.upsert({
        where: { id: moduleId },
        update: {},
        create: {
          id: moduleId,
          courseId: course.id,
          title: mod.title,
          order: i + 1,
          isOfflineReady: true,
        },
      });
      lastModuleId = dbModule.id;

      await db.contentSection.upsert({
        where: { id: `${moduleId}-section-1` },
        update: {},
        create: {
          id: `${moduleId}-section-1`,
          moduleId: dbModule.id,
          type: ContentType.READING,
          title: mod.sectionTitle,
          order: 1,
          content: mod.content,
          completionThreshold: 1.0,
        },
      });
    }

    // Quiz attached to the final module, matching the seeded course's pattern.
    const quizId = `${courseId}-quiz`;
    const quiz = await db.quiz.upsert({
      where: { id: quizId },
      update: {},
      create: {
        id: quizId,
        moduleId: lastModuleId,
        courseId: course.id,
        title: c.quizTitle,
        passMark: 0.7,
        attemptLimit: 3,
        randomiseQuestions: false,
        showAnswersAfter: true,
      },
    });

    for (let qi = 0; qi < c.questions.length; qi++) {
      const q = c.questions[qi];
      const questionId = `${quizId}-q${qi + 1}`;
      const dbQuestion = await db.question.upsert({
        where: { id: questionId },
        update: {},
        create: {
          id: questionId,
          quizId: quiz.id,
          type: QuestionType.MULTIPLE_CHOICE,
          text: q.text,
          points: 1,
          order: qi + 1,
          topicTag: c.slug,
        },
      });

      await db.questionOption.createMany({
        skipDuplicates: true,
        data: q.options.map((opt, oi) => ({
          id: `${questionId}-opt${oi + 1}`,
          questionId: dbQuestion.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
      });
    }
  }

  console.log(`✅ Seeded ${COURSES.length} specialty-track courses`);
}
