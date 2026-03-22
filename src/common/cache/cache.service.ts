import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';

interface AIResponseCacheEntry {
  response: string;
  tokensUsed: number;
  model: string;
  cachedAt: string;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL: number;
  private readonly enabled: boolean;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.defaultTTL = this.configService.get<number>('CACHE_DEFAULT_TTL', 3600); // 1 hora
    this.enabled = this.configService.get<boolean>('CACHE_ENABLED', true);
  }

  /**
   * Genera un hash único para el prompt y modelo
   */
  private generateHash(prompt: string, model: string, systemPrompt?: string): string {
    const content = `${model}:${systemPrompt || ''}:${prompt}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Obtiene una respuesta cacheada de AI
   */
  async getAIResponse(
    prompt: string,
    model: string,
    systemPrompt?: string,
  ): Promise<AIResponseCacheEntry | null> {
    if (!this.enabled) return null;

    try {
      const hash = this.generateHash(prompt, model, systemPrompt);
      const key = `ai:response:${hash}`;
      const cached = await this.cacheManager.get<AIResponseCacheEntry>(key);

      if (cached) {
        this.logger.debug(`Cache HIT for ${model}`);
        return cached;
      }

      return null;
    } catch (error) {
      this.logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Guarda una respuesta de AI en caché
   */
  async setAIResponse(
    prompt: string,
    model: string,
    response: string,
    tokensUsed: number,
    systemPrompt?: string,
    ttl?: number,
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      const hash = this.generateHash(prompt, model, systemPrompt);
      const key = `ai:response:${hash}`;
      const entry: AIResponseCacheEntry = {
        response,
        tokensUsed,
        model,
        cachedAt: new Date().toISOString(),
      };

      // TTL diferente según el modelo
      const finalTtl = ttl || this.getModelTTL(model);
      await this.cacheManager.set(key, entry, finalTtl);

      this.logger.debug(`Cache SET for ${model} (TTL: ${finalTtl}s)`);
    } catch (error) {
      this.logger.error('Cache set error:', error);
    }
  }

  /**
   * Determina el TTL según el modelo
   */
  private getModelTTL(model: string): number {
    // Respuestas de modelos locales se cachean más tiempo
    if (model.includes('ollama') || model.includes('local')) {
      return 7200; // 2 horas
    }
    // Modelos de pago tienen TTL más corto para ahorrar costos
    if (model.includes('gpt') || model.includes('gemini') || model.includes('deepseek')) {
      return 1800; // 30 minutos
    }
    return this.defaultTTL;
  }

  /**
   * Invalida el caché de un modelo específico
   */
  async invalidateModel(model: string): Promise<void> {
    if (!this.enabled) return;

    try {
      // Nota: Redis no soporta borrar por patrón directamente
      // En producción, usar Redis con SCAN + DEL
      this.logger.log(`Invalidating cache for model: ${model}`);
    } catch (error) {
      this.logger.error('Cache invalidate error:', error);
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getStats(): Promise<{ enabled: boolean; defaultTTL: number }> {
    return {
      enabled: this.enabled,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * Método genérico para obtener valores del caché
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    const result = await this.cacheManager.get<T>(key);
    return result ?? null;
  }

  /**
   * Método genérico para guardar valores en caché
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.enabled) return;
    await this.cacheManager.set(key, value, ttl || this.defaultTTL);
  }

  /**
   * Método genérico para eliminar valores del caché
   */
  async del(key: string): Promise<void> {
    if (!this.enabled) return;
    await this.cacheManager.del(key);
  }
}
