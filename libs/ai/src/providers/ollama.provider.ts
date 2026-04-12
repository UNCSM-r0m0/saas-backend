import { Logger, Injectable } from '@nestjs/common';
import {
  BaseAIProvider,
  AIMessage,
  AIProviderConfig,
  AIResponse,
  AIStreamChunk,
  AIMessageRole,
  AIModelInfo,
} from '../index';
import type { AIProvider } from '../interfaces';

/**
 * Configuration interface for Ollama-specific settings.
 */
export interface OllamaProviderConfig {
  /** Base URL for Ollama API (e.g., http://localhost:11434) */
  ollamaUrl: string;
  /** Optional proxy URL for cloud models (OpenAI-compatible) */
  proxyUrl?: string;
  /** Optional API key for proxy authentication */
  proxyApiKey?: string;
  /** Default model to use when not specified */
  defaultModel: string;
}

/**
 * Ollama API request payload structure.
 */
interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

/**
 * Ollama API response structure (non-streaming).
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama model tag from /api/tags response.
 */
interface OllamaModelTag {
  name: string;
  modified_at?: string;
  size?: number;
}

/**
 * Ollama /api/tags response.
 */
interface OllamaTagsResponse {
  models?: OllamaModelTag[];
}

/**
 * OpenAI-compatible proxy response (non-streaming).
 */
interface ProxyChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    total_tokens?: number;
  };
}

/**
 * OpenAI-compatible proxy streaming chunk.
 */
interface ProxyStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

/**
 * OpenAI-compatible model listing from proxy.
 */
interface ProxyModelsResponse {
  data?: Array<{
    id: string;
  }>;
}

/**
 * AI Provider implementation for Ollama.
 * 
 * Supports both direct Ollama API and proxy mode for cloud models.
 * 
 * Features:
 * - Dual mode: local Ollama or proxy (OpenAI-compatible)
 * - Streaming responses via AsyncIterable
 * - System prompt injection
 * - Token counting from native Ollama responses
 * - <think> tag stripping for reasoning models
 * 
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   ollamaUrl: 'http://localhost:11434',
 *   defaultModel: 'qwen2.5-coder:7b'
 * });
 * 
 * if (provider.isAvailable()) {
 *   const response = await provider.generate(messages, config);
 * }
 * ```
 */
@Injectable()
export class OllamaProvider extends BaseAIProvider {
  private readonly ollamaUrl: string;
  private readonly proxyUrl?: string;
  private readonly proxyApiKey?: string;
  private readonly defaultModel: string;
  private readonly useProxy: boolean;

  constructor(config: OllamaProviderConfig) {
    super('ollama', { maxRetries: 3, retryDelay: 1000 });

    this.ollamaUrl = config.ollamaUrl;
    this.proxyUrl = config.proxyUrl;
    this.proxyApiKey = config.proxyApiKey;
    this.defaultModel = config.defaultModel;
    this.useProxy = !!this.proxyUrl;

    this.logger.log(
      `OllamaProvider initialized (${this.useProxy ? 'proxy' : 'direct'} mode)`
    );
  }

  /**
   * Check if Ollama provider is available.
   * Returns true if the provider has a valid URL configured.
   */
  isAvailable(): boolean {
    if (this.useProxy) {
      return !!this.proxyUrl && this.proxyUrl.length > 0;
    }
    return !!this.ollamaUrl && this.ollamaUrl.length > 0;
  }

  /**
   * Generate a non-streaming response from Ollama.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration including model, temperature, etc.
   * @returns Promise with the complete response and metadata
   * @throws Error if the request fails after retries
   */
  async generate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    return this.withRetry(
      () => this.executeGenerate(messages, config),
      'Ollama generate'
    );
  }

  /**
   * Internal implementation of generate (without retry wrapper).
   */
  private async executeGenerate(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const rawModel = config.model || this.defaultModel;
    const model = this.stripModelPrefix(rawModel);
    const normalizedMaxTokens = config.maxTokens ?? 2048;

    // Ensure system prompt is injected if provided
    const processedMessages = config.systemPrompt
      ? this.ensureSystemPrompt(messages, config.systemPrompt)
      : messages;

    if (this.useProxy) {
      return this.generateViaProxy(processedMessages, model, normalizedMaxTokens, config);
    }

    return this.generateViaDirectAPI(processedMessages, model, normalizedMaxTokens, config);
  }

  /**
   * Generate response via proxy (OpenAI-compatible API).
   */
  private async generateViaProxy(
    messages: AIMessage[],
    model: string,
    maxTokens: number,
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const payload = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      temperature: config.temperature ?? 0.7,
      max_tokens: maxTokens,
    };

    this.logger.log(`Generating via proxy with model ${model}`);

    const response = await fetch(`${this.proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.proxyApiKey
          ? { Authorization: `Bearer ${this.proxyApiKey}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`Proxy error ${response.status}: ${errorText}`);
      throw new Error(
        `Ollama proxy error: ${errorText || response.statusText}`
      );
    }

    const data = (await response.json()) as ProxyChatResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    const cleanedContent = this.stripThinkTags(content);

    return {
      content: cleanedContent,
      tokensUsed,
      model,
      provider: this.name,
    };
  }

  /**
   * Generate response via direct Ollama API.
   */
  private async generateViaDirectAPI(
    messages: AIMessage[],
    model: string,
    maxTokens: number,
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const payload: OllamaChatRequest = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: config.temperature ?? 0.7,
        max_tokens: maxTokens,
      },
    };

    this.logger.log(`Generating with direct Ollama API, model ${model}`);

    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    const tokensUsed =
      (data.prompt_eval_count || 0) + (data.eval_count || 0);
    const rawContent = data.message?.content || '';
    const cleanedContent = this.stripThinkTags(rawContent);

    return {
      content: cleanedContent,
      tokensUsed,
      model: data.model || model,
      provider: this.name,
    };
  }

  /**
   * Generate a streaming response from Ollama.
   * 
   * Yields chunks as they arrive from the API. Supports both proxy and direct modes.
   * 
   * @param messages - Array of conversation messages
   * @param config - Provider configuration
   * @returns Async iterable of response chunks
   */
  async *generateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    // Note: We don't use withRetry for streams as it would buffer everything
    // Instead, individual fetch errors bubble up and should be handled by caller
    yield* this.executeGenerateStream(messages, config);
  }

  /**
   * Internal implementation of streaming generation.
   */
  private async *executeGenerateStream(
    messages: AIMessage[],
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    const rawModel = config.model || this.defaultModel;
    const model = this.stripModelPrefix(rawModel);
    const normalizedMaxTokens = config.maxTokens ?? 2048;

    // Ensure system prompt is injected if provided
    const processedMessages = config.systemPrompt
      ? this.ensureSystemPrompt(messages, config.systemPrompt)
      : messages;

    if (this.useProxy) {
      yield* this.generateStreamViaProxy(processedMessages, model, normalizedMaxTokens, config);
    } else {
      yield* this.generateStreamViaDirectAPI(processedMessages, model, normalizedMaxTokens, config);
    }
  }

  /**
   * Stream response via proxy (OpenAI-compatible SSE format).
   */
  private async *generateStreamViaProxy(
    messages: AIMessage[],
    model: string,
    maxTokens: number,
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    const payload = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      temperature: config.temperature ?? 0.7,
      max_tokens: maxTokens,
    };

    this.logger.log(`Generating stream via proxy with model ${model}`);

    const response = await fetch(`${this.proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.proxyApiKey
          ? { Authorization: `Bearer ${this.proxyApiKey}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(
        `Proxy stream error ${response.status}: ${errorText}`
      );
      throw new Error(
        `Ollama proxy stream error: ${errorText || response.statusText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.replace(/^data:\s*/, '');
          if (data === '[DONE]') {
            yield {
              content: '',
              done: true,
              model,
              provider: this.name,
            };
            return;
          }

          try {
            const parsed = JSON.parse(data) as ProxyStreamChunk;
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              yield {
                content,
                done: false,
                model,
                provider: this.name,
              };
            }
          } catch (e) {
            this.logger.warn(`Error parsing SSE chunk: "${data}"`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final chunk
    yield {
      content: '',
      done: true,
      model,
      provider: this.name,
    };
  }

  /**
   * Stream response via direct Ollama API.
   */
  private async *generateStreamViaDirectAPI(
    messages: AIMessage[],
    model: string,
    maxTokens: number,
    config: AIProviderConfig
  ): AsyncIterable<AIStreamChunk> {
    const payload: OllamaChatRequest = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: config.temperature ?? 0.7,
        max_tokens: maxTokens,
      },
    };

    this.logger.log(`Generating stream via direct Ollama API, model ${model}`);

    const response = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let totalChunks = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.logger.log(
            `Stream ended. Total chunks processed: ${totalChunks}`
          );
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line) as OllamaChatResponse;

            // Check for end of stream
            if (parsed.done === true) {
              yield {
                content: '',
                done: true,
                model: parsed.model || model,
                provider: this.name,
              };
              return;
            }

            const content = parsed.message?.content || '';
            if (content) {
              totalChunks++;
              yield {
                content,
                done: false,
                model: parsed.model || model,
                provider: this.name,
              };
            }
          } catch (e) {
            this.logger.warn(`Error parsing stream line: "${line}"`);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final chunk if not already sent
    yield {
      content: '',
      done: true,
      model,
      provider: this.name,
    };
  }

  /**
   * List available models from Ollama.
   * 
   * Returns model names from either the proxy or direct Ollama instance.
   * 
   * @returns Promise with array of model information
   */
  async listModels(): Promise<AIModelInfo[]> {
    return this.withRetry(
      () => this.executeListModels(),
      'Ollama listModels'
    );
  }

  /**
   * Internal implementation of listModels.
   */
  private async executeListModels(): Promise<AIModelInfo[]> {
    if (this.useProxy) {
      return this.listModelsViaProxy();
    }
    return this.listModelsViaDirectAPI();
  }

  /**
   * List models via proxy (OpenAI-compatible /v1/models).
   */
  private async listModelsViaProxy(): Promise<AIModelInfo[]> {
    const response = await fetch(`${this.proxyUrl}/v1/models`, {
      headers: this.proxyApiKey
        ? { Authorization: `Bearer ${this.proxyApiKey}` }
        : undefined,
    });

    if (!response.ok) {
      this.logger.warn(`Failed to list models from proxy: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as ProxyModelsResponse;
    return (
      data.data?.map(m => ({
        name: m.id,
        displayName: m.id,
        provider: this.name,
      })) || []
    );
  }

  /**
   * List models via direct Ollama API (/api/tags).
   */
  private async listModelsViaDirectAPI(): Promise<AIModelInfo[]> {
    const response = await fetch(`${this.ollamaUrl}/api/tags`);

    if (!response.ok) {
      this.logger.warn(
        `Failed to list models from Ollama: ${response.status}`
      );
      return [];
    }

    const data = (await response.json()) as OllamaTagsResponse;
    return (
      data.models?.map(m => ({
        name: m.name,
        displayName: m.name,
        provider: this.name,
      })) || []
    );
  }

  /**
   * Strip the provider prefix from model name if present.
   * The registry passes model names like 'ollama-kimi-k2:1t-cloud',
   * but the API expects just 'kimi-k2:1t-cloud'.
   */
  private stripModelPrefix(model: string): string {
    const prefix = `${this.name}-`;
    if (model.startsWith(prefix)) {
      return model.slice(prefix.length);
    }
    return model;
  }

  /**
   * Strip <think>...</think> tags from content.
   * Used for reasoning models that output thinking process.
   *
   * @param content - Raw content from model
   * @returns Content with think tags removed
   */
  private stripThinkTags(content: string): string {
    return content.replace(/[\s\S]*?<\/think>\s*/g, '').trim();
  }
}
