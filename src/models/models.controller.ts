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
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { DeepSeekService } from '../deepseek/deepseek.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('models')
@Controller('models')
export class ModelsController {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService,
    private readonly deepseekService: DeepSeekService,
    private readonly prismaService: PrismaService,
  ) {}

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
        name: modelName,
        provider: 'Ollama Proxy',
        available: ollamaAvailable,
        isPremium: proModels.has(modelName),
        features: ['text-generation'],
        description: proModels.has(modelName)
          ? 'Modelo PRO (suscripcion)'
          : 'Modelo publico (limite diario)',
        defaultModel: modelName,
      }));

    // Obtener información dinámica del modelo OpenAI/LLM Studio
    const openaiInfo = this.openaiService.getModelInfo();

    const allModels = [
      ...tieredModels,
      {
        id: 'gemini',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        available: this.geminiService.isAvailable(),
        isPremium: true,
        features: ['text-generation', 'multimodal', 'streaming'],
        description: 'Modelo avanzado de Google con capacidades multimodales',
        defaultModel: 'gemini-2.0-flash-exp',
      },
      {
        id: 'openai',
        name:
          openaiInfo.name === 'openai/gpt-oss-20b'
            ? 'GPT OSS 20B (LLM Studio)'
            : openaiInfo.name,
        provider: openaiInfo.provider,
        available: openaiInfo.available,
        isPremium: true,
        features: openaiInfo.features,
        description:
          openaiInfo.provider === 'LLM Studio Local'
            ? 'Modelo local GPT OSS 20B ejecutándose en LLM Studio con sistema de colas'
            : 'Modelo de OpenAI optimizado para chat y conversaciones',
        defaultModel: openaiInfo.name,
        ...(openaiInfo.provider === 'LLM Studio Local' &&
          openaiInfo.queueStats && {
            queueStats: openaiInfo.queueStats,
          }),
      },
      // DeepSeek removido de la lista pública de modelos disponibles
    ];

    return { models: allModels };
  }
}
