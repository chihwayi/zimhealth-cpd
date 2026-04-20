import Anthropic from '@anthropic-ai/sdk';
import type { AIMessage, AIResponse } from '../types';

export async function callAnthropic(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens = 1024,
  temperature = 0.3,
): Promise<AIResponse> {
  const client = new Anthropic({ apiKey });

  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemMsg?.content,
    messages: chatMessages,
    temperature,
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content: text,
    provider: 'anthropic',
    model,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
