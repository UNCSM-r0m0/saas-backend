import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BaseAIProvider } from '../abstract/base-ai-provider';
import {
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIMessageRole,
  AIModelInfo,
  estimateTokensFromText,
} from '../interfaces';

/**
 * OpenAI Provider Implementation
 * 
 * Supports both OpenAI Cloud API and local LLM Studio instances.
 * Configuration is determined by environment variables at runtime.
 * 
 * Environment variables:
 * - OPENAI_API_KEY: For OpenAI Cloud mode
 * - LLM_STUDIO_BASE_URL: For local LLM Studio mode (takes priority)
 * - LLM_STUDIO_MODEL: Model to use with LLM Studio (default: openai/gpt-oss-20b)
 */
@Injectable()
export class OpenAIProvider extends BaseAIProvider {
  private readonly openaiClient: OpenAI | null = null;
  private readonly llmStudioClient: OpenAI | null = null;
  private readonly llmStudioModel: string;
  private readonly useLLMStudio: boolean;

  constructor(private readonly configService: ConfigService) {
    const maxRetries = configService.get<number>('OPENAI_MAX_RETRIES', 3);
    const retryDelay = configService.get<number>('OPENAI_RETRY_DELAY_MS', 1000);
    const requestTimeout = configService.get<number>('OPENAI_REQUEST_TIMEOUT_MS', 120000);

    super('openai', {
      maxRetries,
      retryDelay,
      requestTimeout,
    });

    // Configure LLM Studio local mode (priority)
    const llmStudioUrl = this.configService.get<string>('LLM_STUDIO_BASE_URL');
    this.llmStudioModel = this.configService.get<string>('LLM_STUDIO_MODEL', 'openai/gpt-oss-20b');

    if (llmStudioUrl) {
      // 20-minute timeout for local models that can take a long time (especially for streaming)
      const timeout = 20 * 60 * 1000; // 20 minutes in milliseconds
      this.llmStudioClient = new OpenAI({
        apiKey: 'local-api-key', // LLM Studio doesn't require a real API key
        baseURL: `${llmStudioUrl}/v1`,
        timeout: timeout,
        maxRetries: 0, // Don't retry for local models
      });
      this.useLLMStudio = true;
      this.logger.log(
        `✅ LLM Studio configured: ${llmStudioUrl} with model ${this.llmStudioModel}, timeout: ${timeout / 1000}s`
      );
    } else {
      // Fallback to OpenAI cloud
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (apiKey) {
        this.openaiClient = new OpenAI({
          apiKey: apiKey,
        });
        this.useLLMStudio = false;
        this.logger.log('✅ OpenAI Cloud configured');
      } else {
        this.useLLMStudio = false;
        this.logger.warn(
          'Neither LLM_STUDIO_BASE_URL nor OPENAI_API_KEY configured, OpenAI features disabled'
        );
      }
    }
  }

  /**
   * Generate a non-streaming response from the AI model.
   */
  async generate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    return this.withRetry(
      () => this._generate(messages, config),
      'OpenAI generate'
    );
  }

  private async _generate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const client = this.getClient();
    if (!client) {
      throw new Error(
        'OpenAI/LLM Studio not configured. Please set LLM_STUDIO_BASE_URL or OPENAI_API_KEY.'
      );
    }

    const {
      model: requestedModel,
      maxTokens = 2048,
      temperature = 0.7,
      systemPrompt,
    } = config;

    // Use configured LLM Studio model or the requested one
    const modelToUse = this.useLLMStudio
      ? this.llmStudioModel
      : (requestedModel || 'gpt-4o-mini');

    // Ensure system prompt is included
    const processedMessages = systemPrompt
      ? this.ensureSystemPrompt(messages, systemPrompt)
      : messages;

    // Convert AIMessage[] to OpenAI format
    const openaiMessages = this.convertMessages(processedMessages);

    this.logger.log(
      `🔄 Starting OpenAI/LLM Studio call with model: ${modelToUse}, max_tokens: ${maxTokens}`
    );
    const startTime = Date.now();

    const completion = await client.chat.completions.create({
      model: modelToUse,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature: temperature,
    });

    const elapsedTime = Date.now() - startTime;
    this.logger.log(`⏱️ Call completed in ${elapsedTime}ms (${(elapsedTime / 1000).toFixed(2)}s)`);

    const content = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    this.logger.log(
      `✅ Response generated, tokens: ${tokensUsed}, model: ${modelToUse}, length: ${content.length} chars`
    );

    return {
      content,
      tokensUsed,
      model: completion.model || modelToUse,
      provider: this.name,
    };
  }

  /**
   * Generate a streaming response from the AI model.
   */
  async *generateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    const client = this.getClient();
    if (!client) {
      throw new Error(
        'OpenAI/LLM Studio not configured. Please set LLM_STUDIO_BASE_URL or OPENAI_API_KEY.'
      );
    }

    const {
      model: requestedModel,
      maxTokens = 2048,
      temperature = 0.7,
      systemPrompt,
    } = config;

    // Use configured LLM Studio model or the requested one
    const modelToUse = this.useLLMStudio
      ? this.llmStudioModel
      : (requestedModel || 'gpt-4o-mini');

    // Ensure system prompt is included
    let processedMessages = systemPrompt
      ? this.ensureSystemPrompt(messages, systemPrompt)
      : [...messages];

    // Limit history for LLM Studio to avoid exceeding context
    if (this.useLLMStudio) {
      processedMessages = this.limitHistoryForLLMStudio(processedMessages, 2000);
    }

    // Convert AIMessage[] to OpenAI format
    const openaiMessages = this.convertMessages(processedMessages);

    this.logger.log(
      `🔄 Starting streaming with model: ${modelToUse}, ${openaiMessages.length} messages, max_tokens: ${maxTokens}`
    );

    const stream = await client.chat.completions.create({
      model: modelToUse,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature: temperature,
      stream: true,
    });

    let totalContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        totalContent += content;
        yield {
          content,
          done: false,
          model: modelToUse,
          provider: this.name,
        };
      }
    }

    // Final chunk
    const estimatedTokens = estimateTokensFromText(totalContent);
    yield {
      content: '',
      done: true,
      tokensUsed: estimatedTokens,
      model: modelToUse,
      provider: this.name,
    };

    this.logger.log(
      `✅ Streaming completed, estimated tokens: ${estimatedTokens}, model: ${modelToUse}`
    );
  }

  /**
   * Check if this provider is available/configured.
   */
  isAvailable(): boolean {
    return !!(this.useLLMStudio ? this.llmStudioClient : this.openaiClient);
  }

  /**
   * List available models from this provider.
   */
  async listModels(): Promise<AIModelInfo[]> {
    // LLM Studio mode: return the configured model
    if (this.useLLMStudio && this.llmStudioClient) {
      return [
        {
          name: this.llmStudioModel,
          displayName: this.llmStudioModel,
          provider: 'LLM Studio Local',
          isAvailable: true,
          metadata: {
            supportsStreaming: true,
            supportsVision: false,
            supportsFunctions: false,
            description: 'Local LLM Studio model',
          },
        },
      ];
    }

    // OpenAI Cloud mode: fetch from API
    if (!this.openaiClient) {
      return [];
    }

    try {
      const models = await this.openaiClient.models.list();
      return models.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => ({
          name: model.id,
          displayName: model.id,
          provider: this.name,
          isAvailable: true,
          metadata: {
            supportsStreaming: true,
            supportsVision: model.id.includes('vision'),
            supportsFunctions: true,
            description: `OpenAI ${model.id}`,
          },
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      this.logger.error('Error listing OpenAI models:', error);
      // Fallback to common models
      return [
        {
          name: 'gpt-4o-mini',
          displayName: 'GPT-4o Mini',
          provider: this.name,
          isAvailable: true,
          metadata: {
            supportsStreaming: true,
            supportsVision: true,
            supportsFunctions: true,
            description: 'Fast, affordable small model for focused tasks',
          },
        },
        {
          name: 'gpt-4o',
          displayName: 'GPT-4o',
          provider: this.name,
          isAvailable: true,
          metadata: {
            supportsStreaming: true,
            supportsVision: true,
            supportsFunctions: true,
            description: 'Most capable multimodal model',
          },
        },
        {
          name: 'gpt-4-turbo',
          displayName: 'GPT-4 Turbo',
          provider: this.name,
          isAvailable: true,
          metadata: {
            supportsStreaming: true,
            supportsVision: true,
            supportsFunctions: true,
            description: 'Previous generation GPT-4',
          },
        },
      ];
    }
  }

  /**
   * Get information about the currently configured model.
   */
  getModelInfo(): {
    name: string;
    provider: string;
    available: boolean;
    features: string[];
    mode?: 'cloud' | 'local';
  } {
    if (this.useLLMStudio) {
      return {
        name: this.llmStudioModel,
        provider: 'LLM Studio Local',
        available: this.isAvailable(),
        features: ['text-generation', 'streaming', 'chat-completions'],
        mode: 'local',
      };
    }

    return {
      name: 'gpt-4o-mini',
      provider: 'OpenAI',
      available: this.isAvailable(),
      features: ['text-generation', 'streaming', 'chat-completions'],
      mode: 'cloud',
    };
  }

  /**
   * Get the appropriate client based on configuration.
   */
  private getClient(): OpenAI | null {
    return this.useLLMStudio ? this.llmStudioClient : this.openaiClient;
  }

  /**
   * Convert AIMessage[] to OpenAI message format.
   */
  private convertMessages(
    messages: AIMessage[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

  /**
   * Limit message history for LLM Studio to avoid exceeding context window.
   * For LLM Studio with 4096 token context, keep only the most recent messages.
   */
  private limitHistoryForLLMStudio(
    messages: AIMessage[],
    maxTokens: number = 2000
  ): AIMessage[] {
    if (!this.useLLMStudio) return messages;

    // Simple estimation: ~4 characters per token
    const maxChars = maxTokens * 4;
    let totalChars = 0;
    const limited: AIMessage[] = [];

    // Traverse from the end (most recent messages first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgChars = msg.content.length;

      if (totalChars + msgChars > maxChars && limited.length > 0) {
        // If adding this message would exceed the limit, stop
        break;
      }

      limited.unshift(msg); // Add to the beginning to maintain order
      totalChars += msgChars;
    }

    if (limited.length < messages.length) {
      this.logger.log(
        `📉 History limited: ${messages.length} → ${limited.length} messages ` +
          `(${totalChars} chars, limit: ${maxChars} chars)`
      );
    }

    return limited;
  }
}
