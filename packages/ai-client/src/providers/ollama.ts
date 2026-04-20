import { Ollama } from 'ollama';
import type { AIMessage, AIResponse } from '../types';

export async function callOllama(
  messages: AIMessage[],
  model: string,
  baseUrl: string,
  maxTokens = 1024,
  temperature = 0.3,
): Promise<AIResponse> {
  const client = new Ollama({ host: baseUrl });

  const response = await client.chat({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    options: {
      num_predict: maxTokens,
      temperature,
    },
  });

  return {
    content: response.message.content,
    provider: 'ollama',
    model,
    usage: {
      inputTokens: response.prompt_eval_count ?? 0,
      outputTokens: response.eval_count ?? 0,
    },
  };
}
