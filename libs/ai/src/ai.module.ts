/**
 * AI Module
 *
 * Configures and provides AI providers through the AIProviderRegistry.
 * Supports Ollama, OpenAI (including LLM Studio), Gemini, and DeepSeek.
 *
 * Usage:
 * ```typescript
 * @Module({
 *   imports: [AIModule.forRoot()],
 * })
 * export class YourModule {}
 * ```
 */

import { Module, DynamicModule, Provider, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIProviderRegistry } from './registry/ai-provider.registry';
import { AI_PROVIDER_REGISTRY, AIProvider } from './interfaces';
import { TokenCounterService } from './token';

// Import providers
import {
  OllamaProvider,
  OpenAIProvider,
  GeminiProvider,
  DeepSeekProvider,
  type OllamaProviderConfig,
} from './providers';

/**
 * Injection token for ModelsService.
 * Used to avoid circular dependencies between AI module and Models module.
 */
export const MODELS_SERVICE = Symbol('MODELS_SERVICE');

/**
 * Options for configuring the AI module.
 */
export interface AIModuleOptions {
  /**
   * Whether to skip registering unavailable providers.
   * Default: true
   */
  skipUnavailable?: boolean;

  /**
   * Provider name to use as default. If not specified, Ollama will be default.
   */
  defaultProvider?: string;

  /**
   * Custom model mappings. If not provided, will be read from environment.
   * Format: { 'model-name': 'provider-name' }
   */
  customModelMapping?: Record<string, string>;
}

@Module({})
export class AIModule {
  private static readonly logger = new Logger(AIModule.name);

  /**
   * Configure the AI module with providers and registry.
   *
   * @param options - Optional configuration options
   * @returns DynamicModule configured with AI providers
   */
  static forRoot(options: AIModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      TokenCounterService,
    ];

    // Factory provider for Ollama
    const ollamaProvider: Provider = {
      provide: 'OLLAMA_PROVIDER',
      useFactory: (configService: ConfigService): OllamaProvider | null => {
        const ollamaConfig: OllamaProviderConfig = {
          ollamaUrl: configService.get<string>('OLLAMA_URL', 'http://localhost:11434'),
          proxyUrl: configService.get<string>('OLLAMA_PROXY_URL'),
          proxyApiKey: configService.get<string>('OLLAMA_PROXY_API_KEY'),
          defaultModel: configService.get<string>('OLLAMA_FALLBACK_MODEL', 'qwen2.5-coder:7b'),
        };
        return new OllamaProvider(ollamaConfig);
      },
      inject: [ConfigService],
    };

    // Factory provider for Gemini
    const geminiProvider: Provider = {
      provide: 'GEMINI_PROVIDER',
      useFactory: (configService: ConfigService): GeminiProvider | null => {
        const apiKey = configService.get<string>('GEMINI_API_KEY', '');
        if (!apiKey && options.skipUnavailable !== false) {
          return null;
        }
        return new GeminiProvider(apiKey, {
          maxRetries: configService.get<number>('GEMINI_MAX_RETRIES', 3),
          retryDelay: configService.get<number>('GEMINI_RETRY_DELAY_MS', 1000),
          requestTimeout: configService.get<number>('GEMINI_REQUEST_TIMEOUT_MS', 60000),
        });
      },
      inject: [ConfigService],
    };

    // Factory provider for DeepSeek
    const deepseekProvider: Provider = {
      provide: 'DEEPSEEK_PROVIDER',
      useFactory: (configService: ConfigService): DeepSeekProvider | null => {
        const apiKey = configService.get<string>('DEEPSEEK_API_KEY', '');
        if (!apiKey && options.skipUnavailable !== false) {
          return null;
        }
        return new DeepSeekProvider({
          apiKey,
          baseURL: configService.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
          maxRetries: configService.get<number>('DEEPSEEK_MAX_RETRIES', 3),
          retryDelay: configService.get<number>('DEEPSEEK_RETRY_DELAY_MS', 1000),
          requestTimeout: configService.get<number>('DEEPSEEK_REQUEST_TIMEOUT_MS', 120000),
        });
      },
      inject: [ConfigService],
    };

    // OpenAI provider - uses ConfigService internally
    // Note: OpenAIProvider requires ConfigService in its constructor
    // We inject it directly and let NestJS handle the instantiation
    const openaiProvider: Provider = {
      provide: 'OPENAI_PROVIDER',
      useFactory: (configService: ConfigService): OpenAIProvider => {
        return new OpenAIProvider(configService);
      },
      inject: [ConfigService],
    };

    // Registry configuration factory
    const registryProvider: Provider = {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (
        configService: ConfigService,
        ollama: OllamaProvider | null,
        gemini: GeminiProvider | null,
        deepseek: DeepSeekProvider | null,
        openai: OpenAIProvider,
      ) => {
        return AIModule.createRegistryConfig(configService, options, {
          ollama,
          gemini,
          deepseek,
          openai,
        });
      },
      inject: [
        ConfigService,
        { token: 'OLLAMA_PROVIDER', optional: true },
        { token: 'GEMINI_PROVIDER', optional: true },
        { token: 'DEEPSEEK_PROVIDER', optional: true },
        { token: 'OPENAI_PROVIDER', optional: true },
      ],
    };

    // AIProviderRegistry with optional ModelsService injection using forwardRef
    const registryServiceProvider: Provider = {
      provide: AIProviderRegistry,
      useFactory: (
        registryConfigs: { provider: AIProvider; models: string[]; isDefault?: boolean }[],
        modelsService?: { getActiveModels: () => Promise<any[]> },
      ) => {
        return new AIProviderRegistry(registryConfigs, modelsService);
      },
      inject: [
        AI_PROVIDER_REGISTRY,
        { token: MODELS_SERVICE, optional: true },
      ],
    };

    providers.push(
      ollamaProvider,
      geminiProvider,
      deepseekProvider,
      openaiProvider,
      registryProvider,
      registryServiceProvider,
    );

    return {
      module: AIModule,
      imports: [ConfigModule],
      providers,
      exports: [
        AIProviderRegistry,
        TokenCounterService,
        AI_PROVIDER_REGISTRY,
        'OLLAMA_PROVIDER',
        'GEMINI_PROVIDER',
        'DEEPSEEK_PROVIDER',
        'OPENAI_PROVIDER',
      ],
    };
  }

  /**
    * Create the registry configuration with all providers.
    */
   private static createRegistryConfig(
     config: ConfigService,
     options: AIModuleOptions,
     providers: {
       ollama: OllamaProvider | null;
       gemini: GeminiProvider | null;
       deepseek: DeepSeekProvider | null;
       openai: OpenAIProvider | null;
     },
   ) {
     const registryConfig: { provider: AIProvider; models: string[]; isDefault?: boolean }[] = [];

     // Parse models from environment variables
     const publicModels = this.parseModels(config.get<string>('PUBLIC_MODELS', ''));
     const proModels = this.parseModels(config.get<string>('PRO_MODELS', ''));
     const allOllamaModels = [...publicModels, ...proModels];

     // Parse other provider models (comma-separated or use defaults)
     const geminiModels = this.parseModels(config.get<string>('GEMINI_MODELS', 'gemini-2.0-flash-exp'));
     const openaiModels = this.parseModels(config.get<string>('OPENAI_MODELS', 'gpt-4o-mini'));
     const deepseekModels = this.parseModels(config.get<string>('DEEPSEEK_MODELS', 'deepseek-chat'));

     // Register Ollama provider (default)
     if (providers.ollama && (providers.ollama.isAvailable() || !options.skipUnavailable)) {
       registryConfig.push({
         provider: providers.ollama,
         models: allOllamaModels.length > 0 ? allOllamaModels : ['qwen2.5-coder:7b'],
         isDefault: options.defaultProvider === 'ollama' || !options.defaultProvider,
       });
       this.logger.log(`Registered Ollama provider with ${allOllamaModels.length} models`);
     }

     // Register Gemini provider
     if (providers.gemini && (providers.gemini.isAvailable() || !options.skipUnavailable)) {
       registryConfig.push({
         provider: providers.gemini,
         models: geminiModels,
         isDefault: options.defaultProvider === 'gemini',
       });
       this.logger.log(`Registered Gemini provider with ${geminiModels.length} models`);
     }

     // Register OpenAI provider
     if (providers.openai && (providers.openai.isAvailable() || !options.skipUnavailable)) {
       registryConfig.push({
         provider: providers.openai,
         models: openaiModels,
         isDefault: options.defaultProvider === 'openai',
       });
       this.logger.log(`Registered OpenAI provider with ${openaiModels.length} models`);
     }

     // Register DeepSeek provider
     if (providers.deepseek && (providers.deepseek.isAvailable() || !options.skipUnavailable)) {
       registryConfig.push({
         provider: providers.deepseek,
         models: deepseekModels,
         isDefault: options.defaultProvider === 'deepseek',
       });
       this.logger.log(`Registered DeepSeek provider with ${deepseekModels.length} models`);
     }

     return registryConfig;
   }

   /**
    * Parse a comma-separated string of models into an array.
    *
    * @param modelsStr - Comma-separated model names
    * @returns Array of trimmed model names
    */
   private static parseModels(modelsStr?: string): string[] {
     if (!modelsStr) return [];
     return modelsStr
       .split(',')
       .map((m) => m.trim())
       .filter((m) => m.length > 0);
   }
 }
