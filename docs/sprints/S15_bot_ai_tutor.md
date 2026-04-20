# Sprint 15 — Bot AI Tutor (Multi-Provider)

**Phase:** 2 — WhatsApp Bot
**Duration:** 1 week
**Goal:** The AI clinical tutor fully working in WhatsApp. Uses the multi-provider AI client — defaults to Anthropic Claude but can be switched to OpenAI, Gemini, or Ollama via env config.

---

## Inputs
- [ ] S13 and S14 complete
- [ ] `packages/ai-client` built (AIClient, SYSTEM_PROMPTS)
- [ ] At least one AI API key in `.env` (ANTHROPIC_API_KEY or OPENAI_API_KEY or OLLAMA running locally)

---

## Tasks

### T15.1 — AI client singleton for the bot

CREATE FILE: `apps/whatsapp-bot/src/ai.ts`
```typescript
import { AIClient, type AIProviderConfig, type AIProvider } from '@nursepro/ai-client';

function buildConfig(): AIProviderConfig {
  const config: AIProviderConfig = {};

  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Keep this aligned with `.env.example`
      defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620',
    };
  }

  if (process.env.OPENAI_API_KEY) {
    config.openai = {
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
    };
  }

  if (process.env.GEMINI_API_KEY) {
    config.gemini = {
      apiKey: process.env.GEMINI_API_KEY,
      defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
    };
  }

  if (process.env.OLLAMA_BASE_URL) {
    config.ollama = {
      baseUrl: process.env.OLLAMA_BASE_URL,
      defaultModel: process.env.OLLAMA_MODEL ?? 'llama3',
    };
  }

  return config;
}

const defaultProvider = (process.env.AI_PROVIDER_DEFAULT ?? 'anthropic') as AIProvider;

export const aiClient = new AIClient(buildConfig(), defaultProvider);
```

---

### T15.2 — Redis response cache helper

CREATE FILE: `apps/whatsapp-bot/src/cache.ts`
```typescript
import { Redis } from 'ioredis';
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const CACHE_TTL = 60 * 60 * 24; // 24 hours

/**
 * Optional runtime override for the active AI provider.
 * Written by the backend admin endpoint to: `config:ai:provider`
 */
export async function getAIProviderOverride(): Promise<string | null> {
  return redis.get('config:ai:provider');
}

export function cacheKey(question: string): string {
  return `ai:cache:${crypto.createHash('sha256').update(question.toLowerCase().trim()).digest('hex')}`;
}

export async function getCached(question: string): Promise<string | null> {
  return redis.get(cacheKey(question));
}

export async function setCached(question: string, answer: string): Promise<void> {
  await redis.setex(cacheKey(question), CACHE_TTL, answer);
}
```

---

### T15.3 — AI Tutor handler (full implementation)

EDIT FILE: `apps/whatsapp-bot/src/handlers/aiTutor.ts`
Replace stub with:
```typescript
import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../twilio';
import { aiClient } from '../ai';
import { getAIProviderOverride, getCached, setCached } from '../cache';
import { SYSTEM_PROMPTS } from '@nursepro/ai-client';
import { TEMPLATES } from '../templates';

// Safety: block non-clinical questions
const OFF_TOPIC_KEYWORDS = [
  'politics', 'sport', 'soccer', 'football', 'weather',
  'recipe', 'cooking', 'movie', 'music', 'joke',
];

function isOffTopic(text: string): boolean {
  const lower = text.toLowerCase();
  return OFF_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
}

// Enforce WhatsApp-friendly length (max 300 words ≈ ~1800 chars)
function truncateForWhatsApp(text: string): string {
  const MAX_CHARS = 1800;
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS - 50) + '…\n\n_Reply for more details._';
}

export async function handleAiTutor(msg: IncomingMessage, session: BotSession): Promise<void> {
  // Optional kill-switch: backend can temporarily disable AI features platform-wide.
  const configRes = await fetch(`${process.env.API_URL ?? 'http://localhost:4000'}/api/admin/config/public`).catch(
    () => null,
  );
  if (configRes?.ok) {
    const config = (await configRes.json()) as { aiFeaturesEnabled?: boolean };
    if (config.aiFeaturesEnabled === false) {
      await sendMessage(
        msg.from,
        '⚠️ AI tutor is temporarily unavailable right now. Please try again later or use the NursePro web platform for clinical resources.',
      );
      return;
    }
  }

  const question = msg.body.trim();

  // Allow "menu" or "exit" to break out
  if (['menu', 'exit', 'back', '0'].includes(question.toLowerCase())) {
    session.state = 'MENU';
    await saveSession(session);
    await sendMessage(msg.from, '↩️ Back to main menu.\n\n' + TEMPLATES.MAIN_MENU);
    return;
  }

  // Very short messages are probably not questions
  if (question.length < 5) {
    await sendMessage(msg.from, 'Please type your clinical question. Example:\n"What is the dose of amoxicillin for a child under 5?"');
    return;
  }

  // Off-topic guard
  if (isOffTopic(question)) {
    await sendMessage(msg.from, '🏥 I can only answer healthcare and clinical questions.\n\nPlease ask a medical or nursing-related question.');
    return;
  }

  // Check cache first
  const cached = await getCached(question);
  if (cached) {
    await sendMessage(msg.from, `🤖 ${cached}\n\n_Ask another question or reply *menu*._`);
    return;
  }

  // Show typing indicator (send immediately, then wait for AI)
  await sendMessage(msg.from, '🤖 Looking that up for you…');

  try {
    const answer = await aiClient.complete(question, {
      // Prefer admin override when set, otherwise fall back to AI_PROVIDER_DEFAULT.
      provider: ((await getAIProviderOverride()) as any) ?? undefined,
      systemPrompt: SYSTEM_PROMPTS.CLINICAL_TUTOR,
      maxTokens: 600,
      temperature: 0.2,
    });

    const safeAnswer = truncateForWhatsApp(answer);

    // Cache the response
    await setCached(question, safeAnswer);

    await sendMessage(msg.from, `🤖 ${safeAnswer}\n\n_Ask another question or reply *menu*._`);
  } catch (err: any) {
    console.error('[AI Tutor] Error:', err.message);

    // Fallback: try a different provider if primary fails
    try {
      const fallbackProvider = process.env.AI_PROVIDER_DEFAULT === 'anthropic' ? 'openai' : 'anthropic';
      const fallbackAnswer = await aiClient.complete(question, {
        provider: fallbackProvider as any,
        systemPrompt: SYSTEM_PROMPTS.CLINICAL_TUTOR,
        maxTokens: 600,
        temperature: 0.2,
      });
      await sendMessage(msg.from, `🤖 ${truncateForWhatsApp(fallbackAnswer)}\n\n_Ask another question or reply *menu*._`);
    } catch {
      await sendMessage(msg.from, '⚠️ AI tutor is temporarily unavailable. Please try again in a moment or visit nursepro.co.zw for clinical resources.');
    }
  }
}
```

---

### T15.4 — AI provider config endpoint on backend (Admin-only)

This allows Admin to switch the active AI provider from the Admin portal without redeploying.

EDIT FILE: `backend/src/lib/redis.ts`
Add helper functions:
```typescript
export async function getAIProvider(): Promise<string> {
  return (await redis.get('config:ai:provider')) ?? process.env.AI_PROVIDER_DEFAULT ?? 'anthropic';
}

export async function setAIProvider(provider: string): Promise<void> {
  await redis.set('config:ai:provider', provider);
}
```

CREATE FILE: `backend/src/routes/admin.ts` (stub for S21 expansion)
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { getAIProvider, setAIProvider } from '../lib/redis';

const router = Router();

// GET /api/admin/config/ai
router.get('/config/ai', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const provider = await getAIProvider();
  res.json({ provider, availableProviders: ['anthropic', 'openai', 'gemini', 'ollama'] });
});

// PATCH /api/admin/config/ai
router.patch('/config/ai', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { provider } = req.body;
  const allowed = ['anthropic', 'openai', 'gemini', 'ollama'];
  if (!allowed.includes(provider)) return res.status(400).json({ error: 'Invalid provider' });
  await setAIProvider(provider);
  res.json({ provider });
});

export default router;
```

Optional (recommended): public config endpoint (for bot/web feature flags)
```ts
// GET /api/admin/config/public
// Returns { maintenanceMode, aiFeaturesEnabled }
```

EDIT FILE: `backend/src/app.ts`
Add:
```typescript
import adminRouter from './routes/admin';
// ...
app.use('/api/admin', adminRouter);
```

---

### T15.5 — Add AI provider config to .env.example (already done in S01)

Verify these are in `.env`:
```bash
AI_PROVIDER_DEFAULT=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20240620
```

---

## Validation Checklist (S15)

- [ ] Replying `4` from main menu enters AI_TUTOR state
- [ ] Asking "What is the dose of amoxicillin for a child under 5?" returns a clinical answer
- [ ] Response is under 1800 characters (WhatsApp-safe)
- [ ] Second identical question hits Redis cache (verify with Redis CLI: `GET ai:cache:<hash>`)
- [ ] Off-topic question ("who won the World Cup?") is declined politely
- [ ] If ANTHROPIC_API_KEY is missing and OPENAI_API_KEY is set, OpenAI is used instead
- [ ] If Admin sets provider via `PATCH /api/admin/config/ai`, the bot uses that provider (via Redis key `config:ai:provider`)
- [ ] `GET /api/admin/config/ai` returns current provider (Admin only)
- [ ] `PATCH /api/admin/config/ai` updates provider in Redis
- [ ] If `GET /api/admin/config/public` returns `{ aiFeaturesEnabled: false }`, the bot refuses AI tutor queries with a friendly message

**Sign-off:** Claude Code validates a live AI answer, cache hit, and off-topic rejection before S16 begins.
