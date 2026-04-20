import { callAnthropic } from './providers/anthropic';
import { callOpenAI } from './providers/openai';
import { callGemini } from './providers/gemini';
import { callOllama } from './providers/ollama';
import type { AIMessage, AIRequestOptions, AIResponse, AIProvider, AIProviderConfig } from './types';

/**
 * Multi-provider AI client for NursePro CPD.
 *
 * Supports: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Ollama (local models).
 *
 * Usage:
 *   const ai = new AIClient(config);
 *   const res = await ai.chat([{ role: 'user', content: 'What is EDLIZ?' }], {
 *     provider: 'anthropic',
 *     systemPrompt: SYSTEM_PROMPTS.CLINICAL_TUTOR,
 *   });
 */
export class AIClient {
  private config: AIProviderConfig;
  private defaultProvider: AIProvider;

  constructor(config: AIProviderConfig, defaultProvider: AIProvider = 'anthropic') {
    this.config = config;
    this.defaultProvider = defaultProvider;
  }

  async chat(messages: AIMessage[], options: AIRequestOptions = {}): Promise<AIResponse> {
    const provider = options.provider ?? this.defaultProvider;
    const { maxTokens = 1024, temperature = 0.3, systemPrompt } = options;

    const fullMessages: AIMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    switch (provider) {
      case 'anthropic': {
        const cfg = this.config.anthropic;
        if (!cfg) throw new Error('Anthropic config not provided');
        return callAnthropic(
          fullMessages,
          options.model ?? cfg.defaultModel,
          cfg.apiKey,
          maxTokens,
          temperature,
        );
      }

      case 'openai': {
        const cfg = this.config.openai;
        if (!cfg) throw new Error('OpenAI config not provided');
        return callOpenAI(
          fullMessages,
          options.model ?? cfg.defaultModel,
          cfg.apiKey,
          cfg.baseUrl,
          maxTokens,
          temperature,
        );
      }

      case 'gemini': {
        const cfg = this.config.gemini;
        if (!cfg) throw new Error('Gemini config not provided');
        return callGemini(
          fullMessages,
          options.model ?? cfg.defaultModel,
          cfg.apiKey,
          maxTokens,
          temperature,
        );
      }

      case 'ollama': {
        const cfg = this.config.ollama;
        if (!cfg) throw new Error('Ollama config not provided');
        return callOllama(
          fullMessages,
          options.model ?? cfg.defaultModel,
          cfg.baseUrl,
          maxTokens,
          temperature,
        );
      }

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /** Convenience: single-turn completion */
  async complete(prompt: string, options: AIRequestOptions = {}): Promise<string> {
    const res = await this.chat([{ role: 'user', content: prompt }], options);
    return res.content;
  }
}
