import { AIClient, SYSTEM_PROMPTS, type AIProviderConfig } from '@zimhealth/ai-client';
import { z } from 'zod';

const GeneratedQuestionSchema = z.object({
  text: z.string(),
  options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })).length(4),
  explanation: z.string(),
});

export async function generateQuestionsFromText(
  sourceText: string,
  count: number = 5,
): Promise<z.infer<typeof GeneratedQuestionSchema>[]> {
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

  const ai = new AIClient(config);

  const prompt = `Generate exactly ${count} multiple choice questions from this clinical text.
Return ONLY a valid JSON array. No markdown, no explanation.

Format:
[
  {
    "text": "Question text here",
    "options": [
      { "text": "Option A", "isCorrect": false },
      { "text": "Option B", "isCorrect": true },
      { "text": "Option C", "isCorrect": false },
      { "text": "Option D", "isCorrect": false }
    ],
    "explanation": "Why the correct answer is correct"
  }
]

Source text:
"""
${sourceText.slice(0, 3000)}
"""`;

  const raw = await ai.complete(prompt, {
    systemPrompt: SYSTEM_PROMPTS.QUIZ_GENERATOR,
    maxTokens: 2000,
    temperature: 0.4,
  });

  // Extract JSON from response (strip any wrapping markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  return z.array(GeneratedQuestionSchema).parse(parsed);
}
