export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequestOptions {
  provider?: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  cacheKey?: string; // if set, response will be cached in Redis for 24h
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIProviderConfig {
  anthropic?: {
    apiKey: string;
    defaultModel: string; // e.g. "claude-sonnet-4-6"
  };
  openai?: {
    apiKey: string;
    defaultModel: string; // e.g. "gpt-4o"
    baseUrl?: string;     // for Azure OpenAI or proxies
  };
  gemini?: {
    apiKey: string;
    defaultModel: string; // e.g. "gemini-1.5-pro"
  };
  ollama?: {
    baseUrl: string;      // e.g. "http://localhost:11434"
    defaultModel: string; // e.g. "llama3", "mistral", "phi3"
  };
}
