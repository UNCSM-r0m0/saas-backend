/**
 * Core AI Provider Interface
 * 
 * Defines the contract that all AI providers must implement.
 * This unifies Ollama, OpenAI, Gemini, and DeepSeek behind a single interface.
 */

import { AIMessage } from './ai-message.interface';
import { AIProviderConfig } from './ai-message.interface';
import { AIResponse, AIStreamChunk } from './ai-message.interface';
import { AIModelInfo } from './ai-message.interface';

/**
 * Interface for all AI providers in the system.
 * 
 * Implementations:
 * - OllamaProvider: Local/proxy Ollama instances
 * - OpenAIProvider: OpenAI cloud + LLM Studio local
 * - GeminiProvider: Google Gemini API
 * - DeepSeekProvider: DeepSeek API
 */
export interface AIProvider {
  /**
   * Provider identifier (e.g., 'ollama', 'openai', 'gemini', 'deepseek')
   */
  readonly name: string;

  /**
   * Generate a non-streaming response from the AI model.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration (model, temperature, etc.)
   * @returns Promise with the complete response and metadata
   */
  generate(messages: AIMessage[], config: AIProviderConfig): Promise<AIResponse>;

  /**
   * Generate a streaming response from the AI model.
   * Returns an async iterable that yields chunks as they arrive.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration (model, temperature, etc.)
   * @returns Async iterable of response chunks
   */
  generateStream(messages: AIMessage[], config: AIProviderConfig): AsyncIterable<AIStreamChunk>;

  /**
   * List available models from this provider.
   * Optional because some providers may not support model enumeration.
   * 
   * @returns Promise with array of model information
   */
  listModels?(): Promise<AIModelInfo[]>;

  /**
   * Check if this provider is available/configured.
   * 
   * @returns true if the provider is properly configured and ready to use
   */
  isAvailable(): boolean;
}

/**
 * Type guard to check if a value implements AIProvider
 */
export function isAIProvider(value: unknown): value is AIProvider {
  if (!value || typeof value !== 'object') return false;
  const provider = value as Partial<AIProvider>;
  return (
    typeof provider.name === 'string' &&
    typeof provider.generate === 'function' &&
    typeof provider.generateStream === 'function' &&
    typeof provider.isAvailable === 'function'
  );
}
