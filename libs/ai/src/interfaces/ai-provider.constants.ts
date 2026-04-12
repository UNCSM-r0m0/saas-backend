/**
 * AI Provider Injection Tokens and Constants
 * 
 * These constants are used for dependency injection in NestJS.
 * They provide a centralized registry of injection tokens.
 */

/**
 * Injection token for the AI provider registry.
 * Used to inject the registry service that manages all providers.
 */
export const AI_PROVIDER_REGISTRY = Symbol('AI_PROVIDER_REGISTRY');

/**
 * Injection token for the array of AI provider instances.
 * Used when multiple providers need to be injected.
 */
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');

/**
 * Provider name constants.
 * Use these instead of hardcoding provider names as strings.
 */
export const AI_PROVIDER_NAMES = {
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  DEEPSEEK: 'deepseek',
} as const;

/**
 * Type for provider names
 */
export type AIProviderName = typeof AI_PROVIDER_NAMES[keyof typeof AI_PROVIDER_NAMES];

/**
 * Default model configurations by provider.
 * These are fallback values when no model is specified.
 */
export const DEFAULT_MODELS: Record<AIProviderName, string> = {
  [AI_PROVIDER_NAMES.OLLAMA]: 'qwen2.5-coder:7b',
  [AI_PROVIDER_NAMES.OPENAI]: 'gpt-4o-mini',
  [AI_PROVIDER_NAMES.GEMINI]: 'gemini-2.0-flash-exp',
  [AI_PROVIDER_NAMES.DEEPSEEK]: 'deepseek-chat',
};

/**
 * Default configuration values for AI requests.
 */
export const DEFAULT_AI_CONFIG = {
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
} as const;

/**
 * Token estimation constants.
 * Industry standard approximation: ~4 characters per token for English text.
 * For code and other languages, this may vary.
 */
export const TOKEN_ESTIMATION = {
  /** Approximate characters per token for general text */
  CHARS_PER_TOKEN: 4,
  /** Approximate characters per token for code */
  CHARS_PER_TOKEN_CODE: 3.5,
} as const;
