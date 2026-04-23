import { AIClient, type AIProviderConfig, type AIProvider } from '@zimhealth/ai-client';

function buildConfig(): AIProviderConfig {
  const config: AIProviderConfig = {};

  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
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
