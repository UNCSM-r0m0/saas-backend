/**
 * Barrel export for AI interfaces.
 * 
 * Import all AI-related interfaces from this file:
 * 
 * ```typescript
 * import {
 *   AIProvider,
 *   AIMessage,
 *   AIMessageRole,
 *   AIProviderConfig,
 *   AIResponse,
 *   AIStreamChunk,
 *   AIModelInfo,
 * } from '@libs/ai/interfaces';
 * ```
 */

// Core provider interface (AIProvider is an interface = type)
export type { AIProvider } from './ai-provider.interface';
export { isAIProvider } from './ai-provider.interface';

// Message types and enums
// AIMessageRole is a const enum, others are interfaces (types)
export { AIMessageRole } from './ai-message.interface';
export type {
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIModelInfo,
} from './ai-message.interface';
export {
  promptToMessages,
  estimateTokensFromText,
} from './ai-message.interface';

// Constants and injection tokens
export {
  AI_PROVIDER_REGISTRY,
  AI_PROVIDERS,
  AI_PROVIDER_NAMES,
  DEFAULT_MODELS,
  DEFAULT_AI_CONFIG,
  TOKEN_ESTIMATION,
  type AIProviderName,
} from './ai-provider.constants';
