import { Logger } from '@nestjs/common';
import {
  AIProvider,
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIMessageRole,
} from '../interfaces';

export abstract class BaseAIProvider implements AIProvider {
  protected readonly logger: Logger;
  
  constructor(
    public readonly name: string,
    protected readonly config: {
      maxRetries?: number;
      retryDelay?: number;
      requestTimeout?: number;
    } = {}
  ) {
    this.logger = new Logger(name);
  }

  abstract generate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse>;

  abstract generateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk>;

  abstract isAvailable(): boolean;

  // Shared retry logic with exponential backoff
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.retryDelay ?? 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            `${operationName} failed after ${maxRetries} attempts`,
            error
          );
          throw this.wrapError(error);
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.warn(
          `${operationName} failed (attempt ${attempt}), retrying in ${delay}ms...`
        );
        await this.delay(delay);
      }
    }
    throw new Error('Unreachable');
  }

  // Shared error handling
  protected wrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  // Utility methods
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected createSystemMessage(content: string): AIMessage {
    return { role: AIMessageRole.SYSTEM, content };
  }

  protected createUserMessage(content: string): AIMessage {
    return { role: AIMessageRole.USER, content };
  }

  protected createAssistantMessage(content: string): AIMessage {
    return { role: AIMessageRole.ASSISTANT, content };
  }

  // Message manipulation helpers
  protected ensureSystemPrompt(
    messages: AIMessage[],
    systemPrompt: string
  ): AIMessage[] {
    if (!systemPrompt) return messages;
    const hasSystem = messages.some(m => m.role === AIMessageRole.SYSTEM);
    if (!hasSystem) {
      return [this.createSystemMessage(systemPrompt), ...messages];
    }
    return messages;
  }

  // Optional: list models
  async listModels(): Promise<{ name: string; displayName?: string; provider: string }[]> {
    return [];
  }
}
