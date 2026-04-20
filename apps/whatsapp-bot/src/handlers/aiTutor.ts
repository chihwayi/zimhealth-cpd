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
