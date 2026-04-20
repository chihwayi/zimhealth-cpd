import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIMessage, AIResponse } from '../types';

export async function callGemini(
  messages: AIMessage[],
  model: string,
  apiKey: string,
  maxTokens = 1024,
  temperature = 0.3,
): Promise<AIResponse> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model });

  const systemMsg = messages.find((m) => m.role === 'system');
  const history = messages
    .filter((m) => m.role !== 'system')
    .slice(0, -1)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const lastMessage = messages.filter((m) => m.role !== 'system').at(-1);

  const chat = genModel.startChat({
    history,
    systemInstruction: systemMsg?.content,
    generationConfig: { maxOutputTokens: maxTokens, temperature },
  });

  const result = await chat.sendMessage(lastMessage?.content ?? '');
  const text = result.response.text();

  return {
    content: text,
    provider: 'gemini',
    model,
  };
}
