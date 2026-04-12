import { Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import {
  BaseAIProvider,
} from '../abstract/base-ai-provider';
import {
  AIProviderConfig,
  AIMessage,
  AIMessageRole,
  AIResponse,
  AIStreamChunk,
  AIModelInfo,
  estimateTokensFromText,
} from '../interfaces';

/**
 * Google Gemini AI Provider
 *
 * Implements AIProvider interface for Google Gemini models.
 * Supports text generation with proper role-based messaging.
 *
 * FIX: Uses proper system prompt handling via role-based messages
 * instead of concatenating system prompt to user message.
 */
export class GeminiProvider extends BaseAIProvider {
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly defaultModel = 'gemini-2.0-flash-exp';

  constructor(
    apiKey: string,
    config?: {
      maxRetries?: number;
      retryDelay?: number;
      requestTimeout?: number;
    }
  ) {
    super('gemini', config);

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured, Gemini features will be disabled');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Check if Gemini provider is available (API key configured)
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Generate a non-streaming response from Gemini
   */
  async generate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    if (!this.genAI) {
      throw new Error('Gemini not configured. Please set GEMINI_API_KEY in environment variables.');
    }

    return this.withRetry(
      () => this.doGenerate(messages, config),
      'Gemini generate'
    );
  }

  /**
   * Generate a streaming response from Gemini
   * Note: Retry logic is handled at a higher level; streaming doesn't support automatic retry.
   */
  async *generateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    if (!this.genAI) {
      throw new Error('Gemini not configured. Please set GEMINI_API_KEY in environment variables.');
    }

    // Direct streaming without retry wrapper (streaming retry is complex)
    yield* this.doGenerateStream(messages, config);
  }

  /**
   * Internal implementation of non-streaming generation
   */
  private async doGenerate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const modelName = config.model || this.defaultModel;
    const model = this.getModel(modelName);

    // FIX: Use proper system prompt handling via role-based messages
    // instead of concatenating system prompt to user message
    const processedMessages = this.ensureSystemPrompt(messages, config.systemPrompt || '');

    // Convert messages to Gemini format
    const contents = this.convertMessagesToContents(processedMessages);

    const generationConfig = {
      maxOutputTokens: config.maxTokens ?? 2048,
      temperature: config.temperature ?? 0.7,
    };

    this.logger.debug(`Generating response with model: ${modelName}`);

    const result = await model.generateContent({
      contents,
      generationConfig,
    });

    const response = result.response;
    const text = response.text();

    // Estimate tokens (Gemini doesn't provide exact counts)
    const tokensUsed = estimateTokensFromText(text);

    this.logger.log(`Gemini response generated, estimated tokens: ${tokensUsed}`);

    return {
      content: text,
      tokensUsed,
      model: modelName,
      provider: this.name,
    };
  }

  /**
   * Internal implementation of streaming generation
   */
  private async *doGenerateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    const modelName = config.model || this.defaultModel;
    const model = this.getModel(modelName);

    // FIX: Use proper system prompt handling via role-based messages
    const processedMessages = this.ensureSystemPrompt(messages, config.systemPrompt || '');

    // Convert messages to Gemini format
    const contents = this.convertMessagesToContents(processedMessages);

    const generationConfig = {
      maxOutputTokens: config.maxTokens ?? 2048,
      temperature: config.temperature ?? 0.7,
    };

    this.logger.debug(`Generating streaming response with model: ${modelName}`);

    const result = await model.generateContentStream({
      contents,
      generationConfig,
    });

    let totalTokens = 0;

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        totalTokens += estimateTokensFromText(chunkText);
        yield {
          content: chunkText,
          done: false,
          model: modelName,
          provider: this.name,
        };
      }
    }

    // Final chunk
    yield {
      content: '',
      done: true,
      tokensUsed: totalTokens,
      model: modelName,
      provider: this.name,
    };

    this.logger.log(`Gemini streaming complete, estimated tokens: ${totalTokens}`);
  }

  /**
   * Convert AIMessage array to Gemini Content format
   */
  private convertMessagesToContents(messages: AIMessage[]): Content[] {
    return messages.map((msg) => ({
      role: this.mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Map AIMessageRole to Gemini role format
   * Gemini uses: 'user', 'model' (not 'assistant')
   */
  private mapRoleToGemini(role: AIMessageRole): 'user' | 'model' {
    switch (role) {
      case AIMessageRole.USER:
        return 'user';
      case AIMessageRole.ASSISTANT:
        return 'model';
      case AIMessageRole.SYSTEM:
        // Gemini doesn't have a system role; system messages are handled
        // by the systemInstruction field or converted to user role
        // In this implementation, we convert system to user for compatibility
        return 'user';
      default:
        return 'user';
    }
  }

  /**
   * Get a Gemini model instance
   */
  private getModel(modelName: string): GenerativeModel {
    if (!this.genAI) {
      throw new Error('Gemini not initialized');
    }

    return this.genAI.getGenerativeModel({
      model: modelName,
    });
  }

  /**
   * List available Gemini models
   * Returns predefined list since Gemini API doesn't have a list models endpoint
   */
  async listModels(): Promise<AIModelInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }

    return [
      {
        name: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash',
        provider: this.name,
        maxTokens: 8192,
        isAvailable: true,
        metadata: {
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctions: false,
          contextWindow: 1048576,
          description: 'Fast and efficient multimodal model',
        },
      },
      {
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        provider: this.name,
        maxTokens: 8192,
        isAvailable: true,
        metadata: {
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctions: true,
          contextWindow: 2097152,
          description: 'Advanced reasoning and code generation',
        },
      },
      {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        provider: this.name,
        maxTokens: 8192,
        isAvailable: true,
        metadata: {
          supportsStreaming: true,
          supportsVision: true,
          supportsFunctions: false,
          contextWindow: 1048576,
          description: 'Fast and versatile performance',
        },
      },
    ];
  }
}
