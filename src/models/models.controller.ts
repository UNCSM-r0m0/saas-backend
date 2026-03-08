import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { OllamaService } from '../ollama/ollama.service';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(private readonly ollamaService: OllamaService) {}

  // ENDPOINT ELIMINADO: /api/models (hardcodeado)
  // Usar /api/models/public (dinámico) en su lugar

  /**
   * Obtener modelos de IA disponibles (público)
   */
  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'Obtener modelos de IA disponibles (público)',
    description:
      'Lista todos los modelos de IA disponibles sin requerir autenticación',
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
            },
          },
        },
      },
    },
  })
  async getPublicModels() {
    const availableModels = await this.ollamaService.listModels();
    const ollamaAvailable = this.ollamaService.isAvailable();
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

    const tieredModels = availableModels
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
          ? 'Modelo PRO (suscripcion)'
          : 'Modelo publico (limite diario)',
        defaultModel: modelName,
      }));
    return { models: tieredModels };
  }
}
