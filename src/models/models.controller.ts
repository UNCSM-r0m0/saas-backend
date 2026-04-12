import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AIProviderRegistry } from 'libs/ai';
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ModelConfig, ModelTier, UserRole } from '@prisma/client';

@ApiTags('models')
@Controller('models')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModelsController {
  constructor(
    @Inject(AIProviderRegistry) private readonly aiRegistry: AIProviderRegistry,
    private readonly modelsService: ModelsService,
  ) {}

  // ENDPOINT PRIVADO: Requiere autenticación
  // Solo usuarios logueados pueden ver los modelos disponibles

  /**
   * Obtener modelos de IA disponibles (requiere autenticación)
   * First tries to get models from database, falls back to env vars if DB is empty
   */
  @Get('available')
  @ApiOperation({
    summary: 'Obtener modelos de IA disponibles',
    description:
      'Lista todos los modelos de IA disponibles. Requiere autenticación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de modelos disponibles',
    schema: {
      type: 'object',
      properties: {
        models: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              provider: { type: 'string' },
              available: { type: 'boolean' },
              features: { type: 'array', items: { type: 'string' } },
              description: { type: 'string' },
              defaultModel: { type: 'string' },
              isPremium: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado - Token JWT requerido' })
  async getAvailableModels() {
    // Try to get models from database first
    const dbModels = await this.modelsService.getActiveModels();

    if (dbModels.length > 0) {
      // Use database models
      const tieredModels = dbModels.map((model: ModelConfig) => ({
        id: `ollama-${model.name}`,
        name: model.displayName || model.name
          .replace(/[-:]/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        provider: model.provider === 'ollama' ? 'Ollama Proxy' : model.provider,
        available: true,
        isPremium: model.tier === ModelTier.PREMIUM,
        features: model.capabilities || ['text-generation'],
        description: model.tier === ModelTier.PREMIUM
          ? 'Modelo PREMIUM (suscripcion)'
          : 'Modelo publico (limite diario)',
        defaultModel: model.name,
      }));

      return { models: tieredModels };
    }

    // Fallback to environment variables for backwards compatibility
    return this.getModelsFromEnvVars();
  }

  /**
   * Fallback: Get models from environment variables
   */
  private getModelsFromEnvVars() {
    // Get all models from the registry
    const allModelNames = this.aiRegistry.getAvailableModels();

    // Get the default provider to check availability
    let ollamaAvailable = false;
    try {
      const defaultProvider = this.aiRegistry.getDefaultProvider();
      ollamaAvailable = defaultProvider?.isAvailable() ?? false;
    } catch {
      // No default provider configured
    }

    const publicModels = new Set(
      (process.env.PUBLIC_MODELS || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    );
    const proModels = new Set(
      (process.env.PRO_MODELS || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
    );

    const tieredModels = allModelNames
      .filter(
        (modelName) => publicModels.has(modelName) || proModels.has(modelName),
      )
      .map((modelName) => ({
        id: `ollama-${modelName}`,
        name: modelName
          .replace(/[-:]/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase()),
        provider: 'Ollama Proxy',
        available: ollamaAvailable,
        isPremium: proModels.has(modelName),
        features: ['text-generation'],
        description: proModels.has(modelName)
          ? 'Modelo PREMIUM (suscripcion)'
          : 'Modelo publico (limite diario)',
        defaultModel: modelName,
      }));

    return { models: tieredModels };
  }

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================

  /**
   * Admin: Create a new model configuration
   */
  @Post('admin/models')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Crear configuración de modelo (Admin)',
    description: 'Crea una nueva configuración de modelo. Requiere rol ADMIN o SUPER_ADMIN.',
  })
  @ApiResponse({ status: 201, description: 'Modelo creado exitosamente' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requiere rol de administrador' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async createModel(
    @Body() dto: CreateModelDto,
    @CurrentUser() user: any,
  ) {
    // Double-check admin role (belt and suspenders)
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
      throw new ForbiddenException('Se requiere rol de administrador');
    }

    const model = await this.modelsService.create(dto);
    return {
      success: true,
      data: model,
      message: `Modelo ${model.name} creado exitosamente`,
    };
  }

  /**
   * Admin: Update a model configuration
   */
  @Patch('admin/models/:name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Actualizar configuración de modelo (Admin)',
    description: 'Actualiza una configuración de modelo existente. Requiere rol ADMIN o SUPER_ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Modelo actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requiere rol de administrador' })
  async updateModel(
    @Param('name') name: string,
    @Body() dto: UpdateModelDto,
    @CurrentUser() user: any,
  ) {
    // Double-check admin role (belt and suspenders)
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
      throw new ForbiddenException('Se requiere rol de administrador');
    }

    const model = await this.modelsService.update(name, dto);
    return {
      success: true,
      data: model,
      message: `Modelo ${model.name} actualizado exitosamente`,
    };
  }

  /**
   * Admin: Deactivate (soft delete) a model
   */
  @Delete('admin/models/:name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Desactivar modelo (Admin)',
    description: 'Desactiva (soft delete) una configuración de modelo. Requiere rol ADMIN o SUPER_ADMIN.',
  })
  @ApiResponse({ status: 200, description: 'Modelo desactivado exitosamente' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requiere rol de administrador' })
  async deleteModel(
    @Param('name') name: string,
    @CurrentUser() user: any,
  ) {
    // Double-check admin role (belt and suspenders)
    if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
      throw new ForbiddenException('Se requiere rol de administrador');
    }

    const model = await this.modelsService.deactivate(name);
    return {
      success: true,
      data: model,
      message: `Modelo ${model.name} desactivado exitosamente`,
    };
  }
}
