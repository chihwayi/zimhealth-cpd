# Sprints 13–14 — WhatsApp Bot Foundation & Learning Flow

---

# Sprint 13 — WhatsApp Bot Foundation

**Phase:** 2 — WhatsApp Bot
**Duration:** 1 week
**Goal:** Twilio webhook receiver, Redis session manager, bot router. Every incoming WhatsApp message is correctly parsed and routed.

---

## Inputs
- [ ] S01–S12 complete
- [ ] Twilio account set up with WhatsApp Business number
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` in `.env`

---

## Tasks

### T13.1 — WhatsApp bot package scaffold

CREATE FILE: `apps/whatsapp-bot/package.json`
```json
{
  "name": "@nursepro/whatsapp-bot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "@nursepro/ai-client": "workspace:*",
    "@nursepro/types": "workspace:*",
    "bull": "^4.12.0",
    "express": "^4.19.0",
    "ioredis": "^5.3.0",
    "twilio": "^5.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "nodemon": "^3.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0"
  }
}
```

CREATE FILE: `apps/whatsapp-bot/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

### T13.2 — Twilio client wrapper

CREATE FILE: `apps/whatsapp-bot/src/twilio.ts`
```typescript
import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

export const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER!;

/**
 * Send a WhatsApp message to a phone number.
 * Phone must be in format: "whatsapp:+263771234567"
 */
export async function sendMessage(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  await twilioClient.messages.create({
    from: FROM_NUMBER,
    to: toFormatted,
    body,
  });
}

/**
 * Send a WhatsApp message with a media URL (audio, image).
 */
export async function sendMediaMessage(to: string, body: string, mediaUrl: string): Promise<void> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  await twilioClient.messages.create({
    from: FROM_NUMBER,
    to: toFormatted,
    body,
    mediaUrl: [mediaUrl],
  });
}

/**
 * Validate Twilio webhook signature to prevent spoofed requests.
 */
export function validateWebhookSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}
```

---

### T13.3 — Session manager (Redis)

CREATE FILE: `apps/whatsapp-bot/src/sessionManager.ts`
```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const SESSION_TTL = 60 * 60 * 24; // 24 hours inactivity

export type BotState =
  | 'MENU'
  | 'LEARNING'
  | 'QUIZ'
  | 'AI_TUTOR'
  | 'PAYMENT'
  | 'AWAITING_REGISTRATION';

export interface BotSession {
  phone: string;
  userId?: string;          // null until linked
  state: BotState;
  quizState?: {
    quizId: string;
    questions: Array<{ id: string; text: string; options: Array<{ id: string; text: string }>; correctId: string }>;
    currentIndex: number;
    answers: Record<string, string>;
    score: number;
  };
  lastActivity: number;
}

function key(phone: string): string {
  return `bot:session:${phone}`;
}

export async function getSession(phone: string): Promise<BotSession> {
  const raw = await redis.get(key(phone));
  if (raw) {
    await redis.expire(key(phone), SESSION_TTL); // reset TTL on activity
    return JSON.parse(raw) as BotSession;
  }
  // Default new session
  return { phone, state: 'MENU', lastActivity: Date.now() };
}

export async function saveSession(session: BotSession): Promise<void> {
  session.lastActivity = Date.now();
  await redis.setex(key(session.phone), SESSION_TTL, JSON.stringify(session));
}

export async function clearSession(phone: string): Promise<void> {
  await redis.del(key(phone));
}
```

---

### T13.4 — Message templates

CREATE FILE: `apps/whatsapp-bot/src/templates.ts`
```typescript
export const TEMPLATES = {
  MAIN_MENU: `Welcome to *NursePro CPD* 🏥

Reply with a number:
1️⃣ Learn — today's lesson
2️⃣ Take a quiz
3️⃣ My CPD points
4️⃣ Ask a clinical question
5️⃣ Subscribe / upgrade
6️⃣ Help

_Reply STOP to pause notifications_`,

  NOT_REGISTERED: `You're not registered on NursePro CPD yet.

To register, visit:
👉 https://nursepro.co.zw/register

Or reply *REG* to register via WhatsApp.`,

  HELP: `*NursePro CPD Help*

Commands:
• *menu* — main menu
• *points* — your CPD balance
• *cert* — download certificate
• *stop* — pause notifications

Support: support@nursepro.co.zw
Web: https://nursepro.co.zw`,

  POINTS: (points: number, required: number, deadline: string) =>
    `*Your CPD Points*\n\n✅ Earned: *${points}* pts\n📋 Required: *${required}* pts\n⏰ Deadline: ${deadline}\n\n${
      points >= required
        ? '🎉 You\'ve completed your CPD requirements!'
        : `You need *${required - points} more points*. Reply 1 to start learning.`
    }`,

  RENEWAL_REMINDER: (name: string, days: number, points: number) =>
    `Hi ${name} 👋\n\nYour CPD renewal is in *${days} days*.\nYou need *${points} more points*.\n\nReply *1* to start learning now.`,

  CERT_READY: (link: string) =>
    `🎓 Your CPD certificate is ready!\n\nDownload here:\n${link}\n\nValid for NCZ renewal submission.`,
};
```

---

### T13.5 — Bot router

CREATE FILE: `apps/whatsapp-bot/src/botRouter.ts`
```typescript
import { getSession, saveSession } from './sessionManager';
import { sendMessage } from './twilio';
import { TEMPLATES } from './templates';
import { handleMenu } from './handlers/menuHandler';
import { handleLearn } from './handlers/learnHandler';
import { handleQuiz } from './handlers/quizHandler';
import { handlePoints } from './handlers/pointsHandler';
import { handleAiTutor } from './handlers/aiTutor';
import { handlePayment } from './handlers/paymentHandler';

export interface IncomingMessage {
  from: string;    // "whatsapp:+263771234567"
  body: string;    // raw message text
  profileName?: string;
}

export async function routeMessage(msg: IncomingMessage): Promise<void> {
  const phone = msg.from.replace('whatsapp:', '');
  const text = msg.body.trim().toLowerCase();
  const session = await getSession(phone);

  // Global commands — work from any state
  if (['menu', 'hi', 'hello', 'start', '0'].includes(text)) {
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
    return;
  }

  if (text === 'stop') {
    await sendMessage(msg.from, 'You\'ve paused NursePro notifications. Reply *START* to resume.');
    return;
  }

  if (text === 'points') {
    await handlePoints(msg, session);
    return;
  }

  if (text === 'cert') {
    // TODO S12: send certificate download link
    await sendMessage(msg.from, 'Visit https://nursepro.co.zw/certificates to download your certificate.');
    return;
  }

  if (text === 'help') {
    await sendMessage(msg.from, TEMPLATES.HELP);
    return;
  }

  // State-based routing
  switch (session.state) {
    case 'QUIZ':
      await handleQuiz(msg, session);
      break;
    case 'AI_TUTOR':
      await handleAiTutor(msg, session);
      break;
    case 'LEARNING':
      await handleLearn(msg, session);
      break;
    default:
      await handleMenu(msg, session);
  }
}
```

---

### T13.6 — Handler stubs

CREATE FILE: `apps/whatsapp-bot/src/handlers/menuHandler.ts`
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';
import { TEMPLATES } from '../templates';
import { handleLearn } from './learnHandler';
import { handlePoints } from './pointsHandler';
import { handleAiTutor } from './aiTutor';
import { handlePayment } from './paymentHandler';

export async function handleMenu(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim();

  switch (text) {
    case '1':
      session.state = 'LEARNING';
      await saveSession(session);
      await handleLearn(msg, session);
      break;
    case '2':
      session.state = 'QUIZ';
      await saveSession(session);
      await sendMessage(msg.from, '📝 Starting a quiz... Reply with the number of your answer.\n\nType *menu* anytime to go back.');
      break;
    case '3':
      await handlePoints(msg, session);
      break;
    case '4':
      session.state = 'AI_TUTOR';
      await saveSession(session);
      await sendMessage(msg.from, '🤖 *AI Clinical Tutor*\n\nAsk me any clinical question — drug doses, procedures, protocols, or guidelines.\n\nType your question now:');
      break;
    case '5':
      await handlePayment(msg, session);
      break;
    case '6':
      await sendMessage(msg.from, TEMPLATES.HELP);
      break;
    default:
      await sendMessage(msg.from, TEMPLATES.MAIN_MENU);
  }
}
```

CREATE FILE: `apps/whatsapp-bot/src/handlers/pointsHandler.ts`
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { sendMessage } from '../twilio';
import { TEMPLATES } from '../templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function handlePoints(msg: IncomingMessage, session: BotSession): Promise<void> {
  if (!session.userId) {
    await sendMessage(msg.from, TEMPLATES.NOT_REGISTERED);
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/points/summary`, {
      headers: { 'x-bot-secret': process.env.BOT_SECRET ?? '' },
      // Internal bot-to-API call — use service token, not user JWT
    });
    const data: any = await res.json();
    const deadline = `Dec 31, ${data.cycleYear}`;
    await sendMessage(msg.from, TEMPLATES.POINTS(data.totalPoints, data.requiredPoints, deadline));
  } catch {
    await sendMessage(msg.from, 'Could not fetch your points right now. Please try again later.');
  }
}
```

CREATE FILE: `apps/whatsapp-bot/src/handlers/paymentHandler.ts`
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const WEB_URL = process.env.WEB_URL ?? 'https://nursepro.co.zw';

export async function handlePayment(_msg: IncomingMessage, _session: BotSession): Promise<void> {
  await sendMessage(_msg.from,
    `*NursePro CPD Plans*\n\n` +
    `🆓 *Free* — WhatsApp only, up to 12 pts/year\n` +
    `⭐ *Standard* — $5/year, full course library\n` +
    `🌍 *Diaspora* — $15/year, full library\n\n` +
    `To upgrade, visit:\n${WEB_URL}/subscription\n\n` +
    `Or reply with *PAY5* to pay $5 via EcoCash.`
  );
}
```

CREATE FILE: `apps/whatsapp-bot/src/handlers/helpHandler.ts`
```typescript
import type { IncomingMessage } from '../botRouter';
import { sendMessage } from '../twilio';
import { TEMPLATES } from '../templates';

export async function handleHelp(msg: IncomingMessage): Promise<void> {
  await sendMessage(msg.from, TEMPLATES.HELP);
}
```

---

### T13.7 — Webhook receiver

CREATE FILE: `apps/whatsapp-bot/src/webhook.ts`
```typescript
import { Router } from 'express';
import { routeMessage } from './botRouter';
import { validateWebhookSignature } from './twilio';

const router = Router();

// POST /webhook — Twilio sends all incoming WhatsApp messages here
router.post('/', async (req, res) => {
  // In production: validate Twilio signature
  if (process.env.NODE_ENV === 'production') {
    const sig = req.headers['x-twilio-signature'] as string;
    const url = `${process.env.BOT_URL}/webhook`;
    const valid = validateWebhookSignature(
      process.env.TWILIO_AUTH_TOKEN!,
      url,
      req.body,
      sig,
    );
    if (!valid) return res.status(403).send('Forbidden');
  }

  // Twilio sends form-encoded body
  const from: string = req.body.From ?? '';
  const body: string = req.body.Body ?? '';
  const profileName: string = req.body.ProfileName ?? '';

  if (!from || !body) return res.status(400).send('Bad request');

  // Acknowledge immediately (Twilio requires fast response)
  res.status(200).send('<Response></Response>');

  // Process asynchronously
  routeMessage({ from, body, profileName }).catch((err) =>
    console.error('[Bot] routeMessage error:', err.message),
  );
});

export default router;
```

---

### T13.8 — Bot entry point

CREATE FILE: `apps/whatsapp-bot/src/index.ts`
```typescript
import 'dotenv/config';
import express from 'express';
import webhookRouter from './webhook';

const app = express();
const PORT = process.env.BOT_PORT ?? 4100;

app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nursepro-whatsapp-bot' });
});

app.listen(PORT, () => {
  console.log(`WhatsApp Bot running on port ${PORT}`);
  console.log(`Webhook: POST http://localhost:${PORT}/webhook`);
});
```

---

## Validation Checklist (S13)

- [ ] `pnpm dev` in `apps/whatsapp-bot` starts on port 4100
- [ ] `GET http://localhost:4100/health` returns `{ status: "ok" }`
- [ ] Sending a POST to `/webhook` with `Body=hi&From=whatsapp:+263771234567` returns 200 immediately
- [ ] Redis session is created for the phone number after first message
- [ ] `menu` command returns MAIN_MENU template text
- [ ] Reply `6` sends HELP text
- [ ] Reply `stop` sends pause confirmation
- [ ] All handler stubs are in place (no import errors)

**Sign-off:** Claude Code validates webhook receipt and routing before S14 begins.

---

# Sprint 14 — Bot Learning & Quiz Flow

**Phase:** 2 — WhatsApp Bot
**Duration:** 1 week
**Goal:** Functional learning flow (micro-lessons) and stateful quiz with CPD point crediting via the bot.

---

## Tasks

### T14.1 — Internal bot API service token

The bot needs to call the backend API on behalf of learners. Add a shared service secret.

EDIT FILE: `.env.example`
Add:
```bash
# Internal service secret (backend validates this for bot-to-API calls)
BOT_SECRET=change-me-to-a-long-secret
```

EDIT FILE: `backend/src/middleware/auth.middleware.ts`
Add a second exported function:
```typescript
export function requireBotSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers['x-bot-secret'];
  if (secret !== process.env.BOT_SECRET) {
    return res.status(401).json({ error: 'Invalid bot secret' });
  }
  next();
}
```

---

### T14.2 — Bot-specific API endpoints on backend

EDIT FILE: `backend/src/routes/points.ts`
Add a bot-accessible endpoint:
```typescript
import { requireBotSecret } from '../middleware/auth.middleware';

// GET /api/points/bot/:phone — bot queries learner points by phone
router.get('/bot/:phone', requireBotSecret, async (req, res) => {
  try {
    const learner = await db.user.findUnique({ where: { phone: req.params.phone } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const summary = await getLearnerCPDSummary(learner.id);
    res.json({ ...summary, learnerId: learner.id, fullName: learner.fullName });
  } catch {
    res.status(500).json({ error: 'Could not fetch points' });
  }
});

// POST /api/points/bot/credit — bot credits WhatsApp quiz points
router.post('/bot/credit', requireBotSecret, async (req, res) => {
  try {
    const { phone, quizScore } = req.body;
    const learner = await db.user.findUnique({ where: { phone } });
    if (!learner) return res.status(404).json({ error: 'Learner not found' });
    const result = await creditPoints({
      learnerId: learner.id,
      activityType: 'WHATSAPP_QUIZ',
      quizScore,
    });
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Could not credit points' });
  }
});
```

---

### T14.3 — Learn handler (micro-lessons)

EDIT FILE: `apps/whatsapp-bot/src/handlers/learnHandler.ts`
Replace stub with:
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

// Simple micro-lesson library (in production, fetch from backend API)
const MICRO_LESSONS = [
  {
    id: 'ml-001',
    title: 'Hand Hygiene — 5 Moments',
    content:
      `📚 *Lesson: The 5 Moments of Hand Hygiene*\n\n` +
      `The WHO identifies 5 critical moments:\n\n` +
      `1️⃣ *Before* patient contact\n` +
      `2️⃣ *Before* aseptic procedure\n` +
      `3️⃣ *After* exposure to body fluid risk\n` +
      `4️⃣ *After* patient contact\n` +
      `5️⃣ *After* contact with patient surroundings\n\n` +
      `Correct hand hygiene reduces HAI by up to 50%.\n\n` +
      `_Reply *quiz* to test yourself, or *menu* to go back._`,
  },
  {
    id: 'ml-002',
    title: 'EDLIZ — Essential Medicines',
    content:
      `📚 *Lesson: EDLIZ Essential Medicines*\n\n` +
      `The Essential Drugs List for Zimbabwe (EDLIZ) is updated every 3 years by MOHCC.\n\n` +
      `Key principles:\n` +
      `• Only use drugs listed in EDLIZ unless specialist-approved\n` +
      `• Follow standard treatment guidelines (STGs)\n` +
      `• Report adverse drug reactions to MCAZ\n\n` +
      `_Reply *quiz* to earn 1 CPD point, or *menu* to go back._`,
  },
];

export async function handleLearn(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toLowerCase();

  if (text === 'quiz') {
    session.state = 'QUIZ';
    await saveSession(session);
    await sendMessage(msg.from, '📝 Starting quiz... type *menu* anytime to exit.');
    return;
  }

  // Deliver next lesson (cycle through)
  const lessonIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % MICRO_LESSONS.length;
  const lesson = MICRO_LESSONS[lessonIndex];

  await sendMessage(msg.from, lesson.content);
}
```

---

### T14.4 — Quiz handler (stateful)

EDIT FILE: `apps/whatsapp-bot/src/handlers/quizHandler.ts`
Replace stub with full implementation:
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';

// Static micro-quiz bank (production: fetch from backend)
const QUIZ_BANK = [
  {
    id: 'q1',
    text: 'How many moments of hand hygiene does WHO recommend?',
    options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
    correct: 'C',
    explanation: 'WHO recommends 5 moments of hand hygiene.',
  },
  {
    id: 'q2',
    text: 'Standard precautions apply to which patients?',
    options: ['A) Only infected patients', 'B) Only surgical patients', 'C) ICU patients only', 'D) ALL patients'],
    correct: 'D',
    explanation: 'Standard precautions apply to ALL patients regardless of infection status.',
  },
  {
    id: 'q3',
    text: 'EDLIZ is updated how often?',
    options: ['A) Every year', 'B) Every 2 years', 'C) Every 3 years', 'D) Every 5 years'],
    correct: 'C',
    explanation: 'EDLIZ is updated every 3 years by the MOHCC.',
  },
];

function formatQuestion(q: typeof QUIZ_BANK[0], index: number, total: number): string {
  return (
    `❓ *Question ${index + 1} of ${total}*\n\n${q.text}\n\n` +
    q.options.map((o) => o).join('\n') +
    `\n\n_Reply A, B, C, or D_`
  );
}

export async function handleQuiz(msg: IncomingMessage, session: BotSession): Promise<void> {
  const text = msg.body.trim().toUpperCase();

  // Start quiz if no active quiz state
  if (!session.quizState) {
    // Shuffle and pick 3 questions
    const questions = [...QUIZ_BANK].sort(() => 0.5 - Math.random()).slice(0, 3);
    session.quizState = {
      quizId: 'whatsapp-micro',
      questions: questions as any,
      currentIndex: 0,
      answers: {},
      score: 0,
    };
    await saveSession(session);
    await sendMessage(msg.from, formatQuestion(questions[0], 0, questions.length));
    return;
  }

  const { quizState } = session;
  const currentQ = QUIZ_BANK.find((q) => q.id === quizState.questions[quizState.currentIndex]?.id)
    ?? quizState.questions[quizState.currentIndex] as any;

  // Validate answer
  if (!['A', 'B', 'C', 'D'].includes(text)) {
    await sendMessage(msg.from, 'Please reply with A, B, C, or D.');
    return;
  }

  // Record answer
  quizState.answers[currentQ.id] = text;
  const isCorrect = text === currentQ.correct;
  if (isCorrect) quizState.score++;

  const feedback = isCorrect
    ? `✅ Correct!\n\n_${currentQ.explanation}_`
    : `❌ Incorrect. The answer is *${currentQ.correct}*.\n\n_${currentQ.explanation}_`;

  // Move to next question or finish
  quizState.currentIndex++;

  if (quizState.currentIndex >= quizState.questions.length) {
    // Quiz complete
    const score = quizState.score;
    const total = quizState.questions.length;
    const passed = score >= Math.ceil(total * 0.7);

    delete session.quizState;
    session.state = 'MENU';
    await saveSession(session);

    let resultMsg = `${feedback}\n\n`;
    resultMsg += `📊 *Quiz Result*\n`;
    resultMsg += `Score: ${score}/${total}\n\n`;

    if (passed) {
      // Credit 1 CPD point via backend
      try {
        await fetch(`${API_URL}/api/points/bot/credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bot-secret': BOT_SECRET },
          body: JSON.stringify({ phone: msg.from.replace('whatsapp:', ''), quizScore: score / total }),
        });
        resultMsg += `🎉 You passed! *+1 CPD point* awarded.\n\nReply *menu* for more options.`;
      } catch {
        resultMsg += `🎉 You passed! Reply *menu* for more options.`;
      }
    } else {
      resultMsg += `You need 70% to earn a CPD point. Keep learning!\n\nReply *1* to study more.`;
    }

    await sendMessage(msg.from, resultMsg);
  } else {
    // Send feedback + next question
    const nextQ = quizState.questions[quizState.currentIndex] as any;
    await saveSession(session);
    await sendMessage(
      msg.from,
      `${feedback}\n\n${formatQuestion(nextQ, quizState.currentIndex, quizState.questions.length)}`,
    );
  }
}
```

---

## Validation Checklist (S14)

- [ ] Replying `1` from menu delivers a micro-lesson
- [ ] Replying `quiz` from lesson state starts a 3-question quiz
- [ ] Each correct answer gives positive feedback, incorrect gives explanation
- [ ] Score shown at end of quiz
- [ ] Passing (≥70%) credits 1 CPD point via backend API
- [ ] CPDRecord with `activityType: WHATSAPP_QUIZ` created in database
- [ ] Quiz state persists in Redis between messages
- [ ] `menu` command resets to main menu at any point

**Sign-off:** Claude Code validates full quiz flow end-to-end (must see CPD record created in DB).
