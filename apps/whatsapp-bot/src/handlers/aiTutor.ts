import type { IncomingMessage } from '../botRouter';
import type { BotSession } from '../sessionManager';
import { saveSession } from '../sessionManager';
import { sendMessage } from '../whatsapp/transport';
import { aiClient } from '../ai';
import { getAIProviderOverride, getCached, setCached } from '../cache';
import { SYSTEM_PROMPTS } from '@zimhealth/ai-client';
import { TEMPLATES } from '../templates';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const BOT_SECRET = process.env.BOT_SECRET ?? '';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

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

function inferTheme(text: string): string {
  const lower = text.toLowerCase();
  if (/(pregnan|labou?r|postpartum|preeclamps|eclamps)/i.test(lower)) return 'maternal';
  if (/(hiv|tb|malaria|pneumonia|diarrh)/i.test(lower)) return 'infectious';
  if (/(dose|mg|ml|antibiotic|amoxicillin|cef|metronidazole)/i.test(lower)) return 'medication';
  if (/(triage|emergency|shock|sepsis|bleeding|anaphyl)/i.test(lower)) return 'emergency';
  return 'general';
}

function hasRedFlags(text: string): boolean {
  return /(severe shortness of breath|shortness of breath|chest pain|active bleeding|seizure|unconscious|altered consciousness|anaphyl|severe dehydration|postpartum hemorrhage|preeclamps|eclamps)/i.test(
    text,
  );
}

function applySafetyWrapper(answer: string, question: string): string {
  const needsEscalation = hasRedFlags(question) || hasRedFlags(answer);
  const medTopic = /(dose|mg|ml|antibiotic|amoxicillin|cef|metronidazole|insulin|warfarin)/i.test(question);
  let out = answer.trim();
  const footerParts: string[] = [];
  if (needsEscalation) footerParts.push('If there are red-flag symptoms or rapid worsening, escalate urgently for in-person assessment / emergency care.');
  if (medTopic) footerParts.push('Verify any medication dosing with EDLIZ and your clinical supervisor before administering.');
  if (footerParts.length) out += `\n\n_${footerParts.join(' ')}_`;
  return out;
}

function extractFollowUpQuestion(answer: string): { body: string; followUp?: string } {
  const lines = answer.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1];
  if (last && last.endsWith('?') && last.length <= 160) {
    return { body: lines.slice(0, -1).join('\n').trim(), followUp: last };
  }
  return { body: answer.trim() };
}

async function postTutorEvent(phone: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API_URL}/api/bot/analytics/ai-tutor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET,
      },
      body: JSON.stringify({ phone, ...payload }),
    });
  } catch {
    // best-effort analytics; never block user
  }
}

export async function handleAiTutor(msg: IncomingMessage, session: BotSession): Promise<void> {
  const configRes = await fetch(`${API_URL}/api/admin/config/public`).catch(
    () => null,
  );
  if (configRes?.ok) {
    const config = (await configRes.json()) as { aiFeaturesEnabled?: boolean };
    if (config.aiFeaturesEnabled === false) {
      await sendMessage(
        msg.from,
        '⚠️ AI tutor is temporarily unavailable right now. Please try again later or use the ZimHealth web platform for clinical resources.',
      );
      return;
    }
  }

  const question = msg.body.trim();
  const phone = msg.from.replace('whatsapp:', '');

  if (session.aiTutorState?.awaitingFollowUp) {
    const followUpQuestion = session.aiTutorState.followUpQuestion;
    const lastTopic = session.aiTutorState.lastTopic;
    session.aiTutorState = { awaitingFollowUp: false };
    await saveSession(session);
    await postTutorEvent(phone, {
      event: 'FOLLOWUP_ANSWER',
      theme: lastTopic ?? inferTheme(question),
      meta: { followUpQuestion, answer: question.slice(0, 300) },
    });
    await sendMessage(
      msg.from,
      `✅ Thanks — that helps reinforce the key point.\n\nAsk another clinical question, or reply *menu* to go back.`,
    );
    return;
  }

  // Entitlement gate (Sprint 25): FREE users must upgrade for AI tutor
  try {
    const entRes = await fetch(`${API_URL}/api/entitlements/bot/${encodeURIComponent(phone)}`, {
      headers: { 'x-bot-secret': BOT_SECRET },
    });
    if (entRes.ok) {
      const ent = (await entRes.json()) as { aiTutorAllowed?: boolean; subscriptionTier?: string };
      if (ent.aiTutorAllowed === false) {
        session.aiTutorState = { ...(session.aiTutorState ?? {}), paywallShownAt: Date.now() };
        await postTutorEvent(phone, { event: 'PAYWALL', success: true, theme: inferTheme(question) });
        await sendMessage(
          msg.from,
          `🔒 *AI Tutor is a premium feature.*\n\nUpgrade to Standard to unlock unlimited clinical Q&A.\n\nReply *upgrade* to see payment options, or *menu* to go back.`,
        );
        session.state = 'PAYMENT';
        await saveSession(session);
        return;
      }
    }
  } catch {
    // If entitlements cannot be checked, fail closed for safety/monetization.
    await sendMessage(
      msg.from,
      `⚠️ I can't verify your access right now.\n\nPlease try again in a moment, or reply *upgrade* to see payment options.`,
    );
    session.state = 'PAYMENT';
    await saveSession(session);
    return;
  }

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
    await sendMessage(msg.from, '🏥 I can only answer healthcare and clinical questions.\n\nPlease ask a medical or clinical practice question.');
    return;
  }

  // Check cache first
  const theme = inferTheme(question);
  const cached = await getCached(question);
  if (cached) {
    await postTutorEvent(phone, { event: 'CACHE_HIT', cacheHit: true, success: true, theme });
    await sendMessage(msg.from, `🤖 ${cached}\n\n_Ask another question or reply *menu*._`);
    return;
  }

  // Show typing indicator (send immediately, then wait for AI)
  await sendMessage(msg.from, '🤖 Looking that up for you…');

  try {
    const startedAt = Date.now();
    const primaryProvider = ((await getAIProviderOverride()) as any) ?? undefined;
    const answer = await aiClient.complete(question, {
      provider: primaryProvider,
      systemPrompt: SYSTEM_PROMPTS.CLINICAL_TUTOR,
      maxTokens: 600,
      temperature: 0.2,
    });

    const latencyMs = Date.now() - startedAt;
    const parsed = extractFollowUpQuestion(answer);
    const safeAnswer = truncateForWhatsApp(applySafetyWrapper(parsed.body || answer, question));

    // Cache the response
    await setCached(question, safeAnswer);

    await postTutorEvent(phone, {
      event: 'REQUEST',
      provider: primaryProvider ?? process.env.AI_PROVIDER_DEFAULT ?? 'default',
      latencyMs,
      cacheHit: false,
      fallbackUsed: false,
      success: true,
      theme,
    });

    if (parsed.followUp) {
      session.aiTutorState = { awaitingFollowUp: true, followUpQuestion: parsed.followUp, lastTopic: theme };
      await saveSession(session);
      await sendMessage(
        msg.from,
        `🤖 ${safeAnswer}\n\n*Quick check:* ${parsed.followUp}\nReply with your answer.\n\n_Type *menu* to go back._`,
      );
    } else {
      await sendMessage(msg.from, `🤖 ${safeAnswer}\n\n_Ask another question or reply *menu*._`);
    }
  } catch (err: any) {
    console.error('[AI Tutor] Error:', err.message);

    // Fallback: try a different provider if primary fails
    try {
      const startedAt = Date.now();
      const defaultProvider = process.env.AI_PROVIDER_DEFAULT ?? 'anthropic';
      const fallbackOrder = ['anthropic', 'openai', 'gemini', 'ollama'].filter((p) => p !== defaultProvider);
      let lastError: unknown = null;
      for (const p of fallbackOrder) {
        try {
          const fallbackAnswer = await aiClient.complete(question, {
            provider: p as any,
            systemPrompt: SYSTEM_PROMPTS.CLINICAL_TUTOR,
            maxTokens: 600,
            temperature: 0.2,
          });
          const latencyMs = Date.now() - startedAt;
          await postTutorEvent(phone, {
            event: 'REQUEST',
            provider: p,
            latencyMs,
            cacheHit: false,
            fallbackUsed: true,
            success: true,
            theme,
          });
          await sendMessage(
            msg.from,
            `🤖 ${truncateForWhatsApp(applySafetyWrapper(fallbackAnswer, question))}\n\n_Ask another question or reply *menu*._`,
          );
          return;
        } catch (e) {
          lastError = e;
        }
      }
      await postTutorEvent(phone, { event: 'FAILURE', success: false, theme, meta: { error: String(lastError ?? err?.message ?? 'unknown') } });
      await sendMessage(msg.from, `⚠️ AI tutor is temporarily unavailable. Please try again in a moment or visit ${WEB_URL} for clinical resources.`);
    } catch {
      await postTutorEvent(phone, { event: 'FAILURE', success: false, theme, meta: { error: String(err?.message ?? 'unknown') } });
      await sendMessage(msg.from, `⚠️ AI tutor is temporarily unavailable. Please try again in a moment or visit ${WEB_URL} for clinical resources.`);
    }
  }
}
