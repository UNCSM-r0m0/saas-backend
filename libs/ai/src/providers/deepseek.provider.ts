/**
 * DeepSeek Provider Implementation
 * 
 * Implements the AIProvider interface for DeepSeek AI models.
 * Uses OpenAI SDK with DeepSeek's API endpoint (OpenAI-compatible).
 * 
 * Features:
 * - Non-streaming generation (generate)
 * - Streaming generation (generateStream) - NEW FEATURE
 * - Native token counting from API responses
 * - Retry logic with exponential backoff
 * - Specific error handling for DeepSeek API errors
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import { BaseAIProvider } from '../abstract/base-ai-provider';
import {
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIMessageRole,
} from '../interfaces';

export interface DeepSeekProviderConfig {
  apiKey: string;
  baseURL?: string;
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
}

export class DeepSeekProvider extends BaseAIProvider {
  private readonly openai: OpenAI | null;
  private readonly defaultModel = 'deepseek-chat';

  constructor(config: DeepSeekProviderConfig) {
    super('deepseek', {
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      requestTimeout: config.requestTimeout,
    });

    if (config.apiKey && config.apiKey.trim() !== '') {
      this.openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://api.deepseek.com',
      });
    } else {
      this.openai = null;
      this.logger.warn('DeepSeek API key not provided, provider will be unavailable');
    }
  }

  /**
   * Check if this provider is available and configured.
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate a non-streaming response from DeepSeek.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration
   * @returns Promise with the complete response
   */
  async generate(
    messages: AIMessage[],
    config: AIProviderConfig,
  ): Promise<AIResponse> {
    this.ensureAvailability();

    return this.withRetry(
      () => this.executeGenerate(messages, config),
      'DeepSeek generate'
    );
  }

  /**
   * Generate a streaming response from DeepSeek.
   * Returns an async iterable that yields chunks as they arrive.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration
   * @returns Async iterable of response chunks
   */
  async *generateStream(
    messages: AIMessage[],
    config: AIProviderConfig,
  ): AsyncIterable<AIStreamChunk> {
    this.ensureAvailability();

    try {
      yield* this.executeGenerateStream(messages, config);
    } catch (error) {
      this.logger.error('DeepSeek streaming failed', error);
      throw this.wrapError(error);
    }
  }

  /**
   * List available models from DeepSeek.
   */
  async listModels(): Promise<{ name: string; displayName?: string; provider: string }[]> {
    this.ensureAvailability();

    return this.withRetry(async () => {
      const models = await this.openai!.models.list();
      return models.data.map(model => ({
        name: model.id,
        displayName: model.id,
        provider: this.name,
      }));
    }, 'DeepSeek listModels');
  }

  // ============== Private Methods ==============

  private ensureAvailability(): void {
    if (!this.openai) {
      throw new HttpException(
        'DeepSeek is not configured. Please set DEEPSEEK_API_KEY.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async executeGenerate(
    messages: AIMessage[],
    config: AIProviderConfig,
  ): Promise<AIResponse> {
    const {
      model = this.defaultModel,
      maxTokens = 2048,
      temperature = 0.7,
      systemPrompt,
    } = config;

    // Ensure system prompt is included if provided
    const processedMessages = systemPrompt
      ? this.ensureSystemPrompt(messages, systemPrompt)
      : messages;

    // Convert messages to OpenAI format
    const openaiMessages = this.convertMessages(processedMessages);

    const completion = await this.openai!.chat.completions.create({
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature,
    });

    const content = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;
    const modelUsed = completion.model;

    this.logger.log(`DeepSeek response generated (model: ${modelUsed}, tokens: ${tokensUsed})`);

    return {
      content,
      tokensUsed,
      model: modelUsed,
      provider: this.name,
    };
  }

  private async *executeGenerateStream(
    messages: AIMessage[],
    config: AIProviderConfig,
  ): AsyncIterable<AIStreamChunk> {
    const {
      model = this.defaultModel,
      maxTokens = 2048,
      temperature = 0.7,
      systemPrompt,
    } = config;

    // Ensure system prompt is included if provided
    const processedMessages = systemPrompt
      ? this.ensureSystemPrompt(messages, systemPrompt)
      : messages;

    // Convert messages to OpenAI format
    const openaiMessages = this.convertMessages(processedMessages);

    const stream = await this.openai!.chat.completions.create({
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    let accumulatedContent = '';
    let finalModel = model;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const chunkModel = chunk.model || model;
      finalModel = chunkModel;

      if (content) {
        accumulatedContent += content;
        yield {
          content,
          done: false,
          model: chunkModel,
          provider: this.name,
        };
      }
    }

    // Yield final chunk with accumulated content and token estimate
    const estimatedTokens = Math.ceil(accumulatedContent.length / 4);
    
    this.logger.log(`DeepSeek stream completed (model: ${finalModel}, estimated tokens: ${estimatedTokens})`);

    yield {
      content: '',
      done: true,
      tokensUsed: estimatedTokens,
      model: finalModel,
      provider: this.name,
    };
  }

  private convertMessages(
    messages: AIMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map(msg => ({
      role: this.convertRole(msg.role),
      content: msg.content,
    }));
  }

  private convertRole(role: AIMessageRole): 'system' | 'user' | 'assistant' {
    switch (role) {
      case AIMessageRole.SYSTEM:
        return 'system';
      case AIMessageRole.USER:
        return 'user';
      case AIMessageRole.ASSISTANT:
        return 'assistant';
      default:
        return 'user';
    }
  }

  /**
   * Override wrapError to provide DeepSeek-specific error handling.
   */
  protected wrapError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      const errorMessage = error.message;
      const statusCode = error.status;

      this.logger.warn(`DeepSeek API error: ${statusCode} ${errorMessage}`);

      // Error 402: Insufficient Balance
      if (statusCode === 402 || errorMessage.includes('Insufficient Balance')) {
        return new HttpException(
          'La cuenta de DeepSeek no tiene saldo suficiente. Por favor, recarga tu cuenta en DeepSeek o usa otro modelo.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      // Error 429: Rate Limit
      if (statusCode === 429 || errorMessage.includes('rate limit')) {
        return new HttpException(
          'Se ha alcanzado el límite de solicitudes de DeepSeek. Por favor, intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Other API errors
      return new HttpException(
        `Error de DeepSeek API: ${errorMessage}`,
        statusCode || HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Unknown error
    if (error instanceof Error) {
      this.logger.error('DeepSeek unknown error:', error);
      return new HttpException(
        'Error al comunicarse con DeepSeek. Por favor, intenta más tarde o usa otro modelo.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return super.wrapError(error);
  }
}
