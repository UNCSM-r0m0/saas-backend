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
    async getAvailableModels(@Req() req: any) {
        // TODO: Verificar suscripción del usuario para modelos premium
        const userHasSubscription = false; // Por ahora todos son gratuitos

        const models = [
            {
                id: 'deepseek-r1:7b',
                name: 'DeepSeek R1 7B',
                provider: 'ollama',
                description: 'Modelo local avanzado con capacidades de razonamiento',
                maxTokens: 32768,
                supportsImages: false,
                supportsReasoning: true,
                isPremium: false,
                isAvailable: this.ollamaService.isAvailable(),
                features: ['text-generation', 'local-processing', 'reasoning']
            },
            {
                id: 'llama3.2:3b',
                name: 'Llama 3.2 3B',
                provider: 'ollama',
                description: 'Modelo local rápido y eficiente',
                maxTokens: 16384,
                supportsImages: false,
                supportsReasoning: false,
                isPremium: false,
                isAvailable: this.ollamaService.isAvailable(),
                features: ['text-generation', 'local-processing']
            },
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'gemini',
                description: 'Modelo avanzado de Google con capacidades multimodales',
                maxTokens: 1000000,
                supportsImages: true,
                supportsReasoning: true,
                isPremium: true,
                isAvailable: userHasSubscription && this.geminiService.isAvailable(),
                features: ['text-generation', 'multimodal', 'streaming', 'reasoning']
            },
            {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                provider: 'gemini',
                description: 'Modelo más avanzado de Google',
                maxTokens: 2000000,
                supportsImages: true,
                supportsReasoning: true,
                isPremium: true,
                isAvailable: userHasSubscription && this.geminiService.isAvailable(),
                features: ['text-generation', 'multimodal', 'streaming', 'reasoning', 'advanced']
            },
            {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                provider: 'openai',
                description: 'Modelo de OpenAI optimizado para chat',
                maxTokens: 128000,
                supportsImages: true,
                supportsReasoning: true,
                isPremium: true,
                isAvailable: userHasSubscription && this.openaiService.isAvailable(),
                features: ['text-generation', 'streaming', 'chat-completions', 'multimodal']
            },
            {
                id: 'gpt-4o',
                name: 'GPT-4o',
                provider: 'openai',
                description: 'Modelo más avanzado de OpenAI',
                maxTokens: 128000,
                supportsImages: true,
                supportsReasoning: true,
                isPremium: true,
                isAvailable: userHasSubscription && this.openaiService.isAvailable(),
                features: ['text-generation', 'streaming', 'chat-completions', 'multimodal', 'advanced']
            }
        ];

        return { models };
    }
}
