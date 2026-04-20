import OpenAI from 'openai';
import type { AIMessage, AIResponse } from '../types';

export async function callOpenAI(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  baseUrl?: string,
  maxTokens = 1024,
  temperature = 0.3,
): Promise<AIResponse> {
  const client = new OpenAI({ apiKey, baseURL: baseUrl });

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = response.choices[0]?.message?.content ?? '';

  return {
    content: text,
    provider: 'openai',
    model,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
