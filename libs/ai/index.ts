// AI Library - Consolidated exports from @libs/ai
// Phase 6: Old services removed, now using new provider system

// Core module and registry
export { AIModule, type AIModuleOptions, MODELS_SERVICE } from './src/ai.module';
export { AIProviderRegistry } from './src/registry';

// Abstract base class
export { BaseAIProvider } from './src/abstract';

// Core interfaces
export * from './src/interfaces';

// Token counter
export * from './src/token';

// Provider implementations
export {
  OllamaProvider,
  type OllamaProviderConfig,
  GeminiProvider,
  DeepSeekProvider,
  OpenAIProvider,
} from './src/providers';
