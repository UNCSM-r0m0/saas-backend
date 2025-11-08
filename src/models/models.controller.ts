import {
    Controller,
    Get,
    UseGuards,
    Req,
} from '@nestjs/common';
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
    ) { }

    // ENDPOINT ELIMINADO: /api/models (hardcodeado)
    // Usar /api/models/public (dinámico) en su lugar

    /**
     * Obtener modelos de IA disponibles (público)
     */
    @Get('public')
    @Public()
    @ApiOperation({
        summary: 'Obtener modelos de IA disponibles (público)',
        description: 'Lista todos los modelos de IA disponibles sin requerir autenticación',
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
        // Obtener modelos de Ollama dinámicamente
        const ollamaModels = await this.ollamaService.listModels();
        const ollamaAvailable = this.ollamaService.isAvailable();

        // Crear modelos de Ollama dinámicamente
        const ollamaModelConfigs = ollamaModels.map(modelName => {
            // Configuración específica para cada modelo
            const modelConfigs: Record<string, any> = {
                'deepseek-r1:7b': {
                    name: 'DeepSeek R1 7B',
                    features: ['text-generation', 'local-processing', 'reasoning'],
                    description: 'Modelo de razonamiento avanzado para análisis complejos'
                },
                'qwen2.5-coder:7b': {
                    name: 'Qwen2.5 Coder 7B',
                    features: ['text-generation', 'code-generation', 'programming'],
                    description: 'Modelo especializado en programación y generación de código'
                },
                'llama3.2:3b': {
                    name: 'Llama 3.2 3B',
                    features: ['text-generation', 'local-processing', 'fast'],
                    description: 'Modelo rápido y eficiente para respuestas generales'
                },
                'llama3.2:7b': {
                    name: 'Llama 3.2 7B',
                    features: ['text-generation', 'local-processing', 'balanced'],
                    description: 'Modelo equilibrado para tareas generales'
                }
            };

            const config = modelConfigs[modelName] || {
                name: modelName.replace(/[-:]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                features: ['text-generation', 'local-processing'],
                description: `Modelo local ${modelName}`
            };

            return {
                id: `ollama-${modelName}`,
                name: config.name,
                provider: 'Ollama Local',
                available: ollamaAvailable,
                isPremium: false,
                features: config.features,
                description: config.description,
                defaultModel: modelName
            };
        });

        // Obtener información dinámica del modelo OpenAI/LLM Studio
        const openaiInfo = this.openaiService.getModelInfo();

        const allModels = [
            ...ollamaModelConfigs,
            {
                id: 'gemini',
                name: 'Gemini 2.0 Flash',
                provider: 'Google',
                available: this.geminiService.isAvailable(),
                isPremium: true,
                features: ['text-generation', 'multimodal', 'streaming'],
                description: 'Modelo avanzado de Google con capacidades multimodales',
                defaultModel: 'gemini-2.0-flash-exp'
            },
            {
                id: 'openai',
                name: openaiInfo.name === 'openai/gpt-oss-20b'
                    ? 'GPT OSS 20B (LLM Studio)'
                    : openaiInfo.name,
                provider: openaiInfo.provider,
                available: openaiInfo.available,
                isPremium: true,
                features: openaiInfo.features,
                description: openaiInfo.provider === 'LLM Studio Local'
                    ? 'Modelo local GPT OSS 20B ejecutándose en LLM Studio con sistema de colas'
                    : 'Modelo de OpenAI optimizado para chat y conversaciones',
                defaultModel: openaiInfo.name,
                ...(openaiInfo.provider === 'LLM Studio Local' && openaiInfo.queueStats && {
                    queueStats: openaiInfo.queueStats
                })
            }
            // DeepSeek removido de la lista pública de modelos disponibles
        ];

        return { models: allModels };
    }
}
