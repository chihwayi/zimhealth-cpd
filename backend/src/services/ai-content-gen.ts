import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@nursepro/ai-client';
import { z } from 'zod';

// ─── Validation schemas ───────────────────────────────────────────────────────

const GeneratedSectionSchema = z.object({
  type: z.literal('READING'),
  title: z.string(),
  order: z.number(),
  content: z.string(),
});

const GeneratedQuestionSchema = z.object({
  text: z.string(),
  order: z.number(),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).min(4).max(4),
});

const GeneratedQuizSchema = z.object({
  title: z.string(),
  passMark: z.number().default(0.7),
  questions: z.array(GeneratedQuestionSchema),
});

const GeneratedModuleSchema = z.object({
  title: z.string(),
  order: z.number(),
  sections: z.array(GeneratedSectionSchema),
  quiz: GeneratedQuizSchema,
});

export const GeneratedCourseSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string(),
  estimatedMinutes: z.number(),
  cpdPoints: z.number().min(1).max(5),
  modules: z.array(GeneratedModuleSchema),
});

export type GeneratedCourse = z.infer<typeof GeneratedCourseSchema>;

// ─── AI client factory ────────────────────────────────────────────────────────

function makeAiClient(): AIClient {
  const config: AIProviderConfig = {
    anthropic: process.env.ANTHROPIC_API_KEY
      ? { apiKey: process.env.ANTHROPIC_API_KEY, defaultModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20240620' }
      : undefined,
    openai: process.env.OPENAI_API_KEY
      ? { apiKey: process.env.OPENAI_API_KEY, defaultModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' }
      : undefined,
    gemini: process.env.GEMINI_API_KEY
      ? { apiKey: process.env.GEMINI_API_KEY, defaultModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro' }
      : undefined,
    ollama: process.env.OLLAMA_BASE_URL
      ? { baseUrl: process.env.OLLAMA_BASE_URL, defaultModel: process.env.OLLAMA_MODEL ?? 'llama3' }
      : undefined,
  };
  return new AIClient(config);
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generateCourseFromGuideline(
  guidelineText: string,
  courseTitle: string,
  targetCadre: string,
): Promise<GeneratedCourse> {
  const ai = makeAiClient();

  const prompt = `Generate a complete CPD course for ${targetCadre}s in Zimbabwe.

Course title: "${courseTitle}"

Source guideline text:
"""
${guidelineText.slice(0, 8000)}
"""

Return ONLY valid JSON matching the schema. No markdown fences, no explanation.`;

  const raw = await ai.complete(prompt, {
    systemPrompt: SYSTEM_PROMPTS.CONTENT_GENERATOR,
    maxTokens: 4000,
    temperature: 0.3,
  });

  // Strip markdown code fences if the model wraps output
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON object');

  const parsed = JSON.parse(jsonMatch[0]);
  return GeneratedCourseSchema.parse(parsed);
}
