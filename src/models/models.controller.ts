import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { DeepSeekService } from '../deepseek/deepseek.service';

@ApiTags('models')
@Controller('models')
export class ModelsController {
    constructor(
        private readonly ollamaService: OllamaService,
        private readonly geminiService: GeminiService,
        private readonly openaiService: OpenAIService,
        private readonly deepseekService: DeepSeekService,
    ) { }

    /**
     * Obtener modelos de IA disponibles
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Obtener modelos de IA disponibles',
        description: 'Lista todos los modelos de IA disponibles para usar en el chat',
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
    @ApiBearerAuth('JWT-auth')
    async getAvailableModels() {
        const models = [
            {
                id: 'ollama',
                name: 'Ollama Local',
                provider: 'Local',
                available: this.ollamaService.isAvailable(),
                features: ['text-generation', 'local-processing'],
                description: 'Modelo local ejecutándose en tu servidor',
                defaultModel: 'deepseek-r1:7b'
            },
            {
                id: 'gemini',
                name: 'Gemini 2.0 Flash',
                provider: 'Google',
                available: this.geminiService.isAvailable(),
                features: ['text-generation', 'multimodal', 'streaming'],
                description: 'Modelo avanzado de Google con capacidades multimodales',
                defaultModel: 'gemini-2.0-flash-exp'
            },
            {
                id: 'openai',
                name: 'GPT-4o Mini',
                provider: 'OpenAI',
                available: this.openaiService.isAvailable(),
                features: ['text-generation', 'streaming', 'chat-completions'],
                description: 'Modelo de OpenAI optimizado para chat y conversaciones',
                defaultModel: 'gpt-4o-mini'
            },
            {
                id: 'deepseek',
                name: 'DeepSeek Chat',
                provider: 'DeepSeek',
                available: this.deepseekService.isAvailable(),
                features: ['text-generation', 'cost-effective', 'high-performance'],
                description: 'Modelo de DeepSeek con excelente relación precio-calidad',
                defaultModel: 'deepseek-chat'
            }
        ];

        return { models };
    }
}
