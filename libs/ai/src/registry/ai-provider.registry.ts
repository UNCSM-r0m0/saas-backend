/**
 * AI Provider Registry
 *
 * Maps model names to provider instances, eliminating the need for if/else chains.
 * This registry is used by ChatDomainService to route requests to the appropriate provider.
 */

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
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
 * - Get provider for a specific model
 * - Get default provider
 * - List available models and providers
 * - Check if a model is available
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
  private providers = new Map<string, AIProvider>();
  private modelToProvider = new Map<string, AIProvider>();
  private defaultProvider?: AIProvider;

  constructor(
    @Inject(AI_PROVIDER_REGISTRY)
    private readonly providerConfigs: ProviderRegistration[]
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
   * @param config - The provider registration configuration
   */
  register(config: ProviderRegistration): void {
    // Register provider by name for direct lookup
    this.providers.set(config.provider.name, config.provider);

    // Map each model to this provider
    for (const model of config.models) {
      this.modelToProvider.set(model, config.provider);
    }

    // Set as default if specified
    if (config.isDefault) {
      this.defaultProvider = config.provider;
    }

    if (config.provider.isAvailable()) {
      console.log(
        `[AIProviderRegistry] Registered ${config.provider.name} with ${config.models.length} models: ${config.models.join(', ')}`
      );
    }
  }

  /**
   * Get the provider for a specific model.
   *
   * @param model - The model name
   * @returns The provider that handles this model
   * @throws Error if no provider is found for the model
   */
  getProvider(model: string): AIProvider {
    const provider = this.modelToProvider.get(model);
    if (!provider) {
      throw new Error(`No provider found for model: ${model}`);
    }
    return provider;
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
   * Get all available model names.
   *
   * @returns Array of model names
   */
  getAvailableModels(): string[] {
    return Array.from(this.modelToProvider.keys());
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
   * @param model - The model name to check
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
