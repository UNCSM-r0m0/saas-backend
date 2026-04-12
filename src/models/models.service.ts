import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';
import { AIProviderRegistry } from 'libs/ai';
import { ModelConfig, ModelTier } from '@prisma/client';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes in seconds
  private readonly CACHE_KEYS = {
    ALL_ACTIVE: 'models:active',
    BY_TIER: (tier: ModelTier) => `models:tier:${tier}`,
    BY_NAME: (name: string) => `models:name:${name}`,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional()
    @Inject(AIProviderRegistry)
    private readonly aiRegistry?: AIProviderRegistry,
  ) {}

  /**
    * Get all active models, optionally filtered by tier
    */
   async getActiveModels(tier?: ModelTier): Promise<ModelConfig[]> {
     const cacheKey = tier 
       ? this.CACHE_KEYS.BY_TIER(tier) 
       : this.CACHE_KEYS.ALL_ACTIVE;
     
     // Try cache first
     const cached = await this.cache.get<ModelConfig[]>(cacheKey);
     if (cached) {
       this.logger.debug(`Cache hit for ${cacheKey}`);
       return cached;
     }

     // Query DB
     const models = await this.prisma.modelConfig.findMany({
       where: {
         isActive: true,
         ...(tier && { tier }),
       },
       orderBy: { sortOrder: 'asc' },
     });

     // Cache result
     await this.cache.set(cacheKey, models, this.CACHE_TTL);
     this.logger.debug(`Cached ${models.length} models for ${cacheKey}`);

     return models;
   }

   /**
    * Get a single model by name
    */
   async getByName(name: string): Promise<ModelConfig | null> {
     const cacheKey = this.CACHE_KEYS.BY_NAME(name);
     
     const cached = await this.cache.get<ModelConfig>(cacheKey);
     if (cached) return cached;

     const model = await this.prisma.modelConfig.findUnique({
       where: { name },
     });

     if (model) {
       await this.cache.set(cacheKey, model, this.CACHE_TTL);
     }

     return model;
   }

   /**
    * Check if user has access to a model based on their tier
    * PUBLIC models: accessible to any logged-in user (both registered and premium)
    * PREMIUM models: accessible only to premium subscribers
    */
   async checkAccess(modelName: string, userTier: ModelTier): Promise<boolean> {
     const model = await this.getByName(modelName);
     if (!model || !model.isActive) return false;

     // PUBLIC models are accessible to all logged-in users
     if (model.tier === ModelTier.PUBLIC) return true;

     // PREMIUM models require premium subscription
     return userTier === ModelTier.PREMIUM;
   }

   /**
    * Get the default model
    */
   async getDefaultModel(): Promise<ModelConfig | null> {
     const models = await this.getActiveModels();
     return models.find(m => m.isDefault) || models[0] || null;
   }

   /**
    * Admin: Create a new model
    */
   async create(data: CreateModelDto): Promise<ModelConfig> {
     const model = await this.prisma.modelConfig.create({ data });
     await this.invalidateCache();
     await this.refreshRegistry();
     this.logger.log(`Created model: ${model.name}`);
     return model;
   }

   /**
    * Admin: Update a model
    */
   async update(name: string, data: UpdateModelDto): Promise<ModelConfig> {
     const model = await this.prisma.modelConfig.update({
       where: { name },
       data,
     });
     await this.invalidateCache();
     await this.refreshRegistry();
     this.logger.log(`Updated model: ${model.name}`);
     return model;
   }

   /**
    * Admin: Delete a model (soft delete via isActive=false)
    */
   async deactivate(name: string): Promise<ModelConfig> {
     const model = await this.prisma.modelConfig.update({
       where: { name },
       data: { isActive: false },
     });
     await this.invalidateCache();
     await this.refreshRegistry();
     this.logger.log(`Deactivated model: ${model.name}`);
     return model;
   }

   /**
    * Admin: Hard delete (use with caution)
    */
   async remove(name: string): Promise<void> {
     await this.prisma.modelConfig.delete({ where: { name } });
     await this.invalidateCache();
     await this.refreshRegistry();
     this.logger.log(`Deleted model: ${name}`);
   }

   /**
    * Invalidate all model caches
    */
   private async invalidateCache(): Promise<void> {
     await this.cache.del(this.CACHE_KEYS.ALL_ACTIVE);
     await this.cache.del(this.CACHE_KEYS.BY_TIER(ModelTier.PUBLIC));
     await this.cache.del(this.CACHE_KEYS.BY_TIER(ModelTier.PREMIUM));
     this.logger.debug('Invalidated model cache');
   }

   /**
    * Refresh the AI registry after model changes.
    * This ensures runtime updates are reflected immediately.
    */
   private async refreshRegistry(): Promise<void> {
     if (this.aiRegistry) {
       try {
         await this.aiRegistry.refreshFromDatabase();
         this.logger.log('AI registry refreshed after model change');
       } catch (error) {
         this.logger.warn(`Failed to refresh AI registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
       }
     }
   }
 }
