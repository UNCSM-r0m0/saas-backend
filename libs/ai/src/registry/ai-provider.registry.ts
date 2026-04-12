/**
 * AI Provider Registry
 *
 * Maps model names to provider instances, eliminating the need for if/else chains.
 * Automatically registers models with their provider prefix (e.g., 'ollama-kimi-k2:1t-cloud')
 * so that lookups work seamlessly regardless of whether the prefix is included.
 *
 * This registry is used by ChatDomainService to route requests to the appropriate provider.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { AIProvider, AI_PROVIDER_REGISTRY } from '../interfaces';

/**
 * Configuration for registering a provider with the registry.
 */
export interface ProviderRegistration {
  /** The provider instance to register */
  provider: AIProvider;
  /** List of model names this provider handles */
  models: string[];
  /** Whether this is the default provider when no specific model is requested */
  isDefault?: boolean;
}

/**
 * Central registry for AI providers.
 *
 * Maps model names to provider instances and provides methods to:
 * - Get provider for a specific model (with or without provider prefix)
 * - Get default provider
 * - List available models and providers
 * - Check if a model is available
 *
 * Dynamic prefix handling:
 * When registering models, each model is automatically registered TWICE:
 *   1. By its plain name (e.g., 'kimi-k2:1t-cloud')
 *   2. By its prefixed name (e.g., 'ollama-kimi-k2:1t-cloud')
 *
 * This means `getProvider('kimi-k2:1t-cloud')` and `getProvider('ollama-kimi-k2:1t-cloud')`
 * both work without any hardcoded prefix stripping.
 *
 * @example
 * ```typescript
 * // In ChatDomainService
 * const provider = this.registry.getProvider(model);
 * const response = await provider.generate(messages, config);
 * ```
 */
@Injectable()
export class AIProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(AIProviderRegistry.name);
  private providers = new Map<string, AIProvider>();
  private modelToProvider = new Map<string, AIProvider>();
  private defaultProvider?: AIProvider;

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providerConfigs: ProviderRegistration[],
  ) {}

  /**
   * Initialize the registry by registering all configured providers.
   * Called automatically by NestJS when the module is initialized.
   */
  onModuleInit() {
    for (const config of this.providerConfigs) {
      this.register(config);
    }
  }

  /**
   * Register a provider with the registry.
   *
   * Each model is registered with BOTH:
   * - Its plain name: 'kimi-k2:1t-cloud'
   * - Its prefixed name: 'ollama-kimi-k2:1t-cloud'
   *
   * This allows lookups to work regardless of whether the
   * client sends the model name with or without the provider prefix.
   *
   * @param config - The provider registration configuration
   */
  register(config: ProviderRegistration): void {
    const providerName = config.provider.name;

    // Register provider by name for direct lookup
    this.providers.set(providerName, config.provider);

    // Map each model to this provider — both plain and prefixed
    for (const model of config.models) {
      // Plain model name (e.g., 'kimi-k2:1t-cloud')
      this.modelToProvider.set(model, config.provider);

      // Prefixed model name (e.g., 'ollama-kimi-k2:1t-cloud')
      const prefixedModel = `${providerName}-${model}`;
      this.modelToProvider.set(prefixedModel, config.provider);
    }

    // Set as default if specified
    if (config.isDefault) {
      this.defaultProvider = config.provider;
    }

    if (config.provider.isAvailable()) {
      this.logger.log(
        `Registered ${providerName} with ${config.models.length} models: ${config.models.join(', ')}`,
      );
    }
  }

  /**
   * Get the provider for a specific model.
   *
   * Works with both plain model names ('kimi-k2:1t-cloud')
   * and prefixed model names ('ollama-kimi-k2:1t-cloud').
   *
   * Falls back to the default provider if the model is not found
   * but the model name matches a known prefix pattern.
   *
   * @param model - The model name (may or may not include provider prefix)
   * @returns The provider that handles this model
   * @throws Error if no provider is found for the model
   */
  getProvider(model: string): AIProvider {
    // Direct lookup — works for both plain and prefixed names
    const provider = this.modelToProvider.get(model);
    if (provider) {
      return provider;
    }

    // Fallback to default provider (e.g., when 'ollama' is sent as model name)
    if (this.defaultProvider) {
      this.logger.warn(
        `Model "${model}" not found in registry, using default provider "${this.defaultProvider.name}"`,
      );
      return this.defaultProvider;
    }

    throw new Error(`No provider found for model: ${model}`);
  }

  /**
   * Get a provider by its name.
   *
   * @param name - The provider name (e.g., 'ollama', 'openai')
   * @returns The provider or undefined if not found
   */
  getProviderByName(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get the default provider.
   *
   * @returns The default provider
   * @throws Error if no default provider is configured
   */
  getDefaultProvider(): AIProvider {
    if (!this.defaultProvider) {
      throw new Error('No default provider configured');
    }
    return this.defaultProvider;
  }

  /**
   * Get all available model names (including prefixed variants).
   *
   * @param includePrefixed - Whether to include prefixed model names (default: true)
   * @returns Array of model names
   */
  getAvailableModels(includePrefixed = true): string[] {
    const models = Array.from(this.modelToProvider.keys());
    if (includePrefixed) {
      return models;
    }
    // Filter out prefixed models
    return models.filter(
      (model) => !Array.from(this.providers.keys()).some((prefix) => model.startsWith(`${prefix}-`)),
    );
  }

  /**
   * Get all registered providers.
   *
   * @returns Array of provider instances
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Check if a model is available.
   *
   * @param model - The model name to check (with or without prefix)
   * @returns true if the model is available
   */
  isModelAvailable(model: string): boolean {
    return this.modelToProvider.has(model);
  }

  /**
   * Find which provider handles a specific model.
   *
   * @param model - The model name
   * @returns The provider name or null if not found
   */
  getProviderNameForModel(model: string): string | null {
    const provider = this.modelToProvider.get(model);
    return provider?.name ?? null;
  }
}