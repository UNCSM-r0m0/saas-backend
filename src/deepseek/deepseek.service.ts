import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface DeepSeekGenerateOptions {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    model?: string;
}

@Injectable()
export class DeepSeekService {
    private readonly logger = new Logger(DeepSeekService.name);
    private readonly openai: OpenAI | undefined;
    private readonly apiKey: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY', '');

        if (this.apiKey && this.apiKey !== '') {
            this.openai = new OpenAI({
                apiKey: this.apiKey,
                baseURL: 'https://api.deepseek.com', // DeepSeek API endpoint
            });
        } else {
            this.logger.warn('DEEPSEEK_API_KEY not configured, DeepSeek features will be disabled');
        }
    }

    /**
     * Genera una respuesta del modelo DeepSeek
     */
    async generateResponse(
        prompt: string,
        options?: DeepSeekGenerateOptions,
    ): Promise<{ response: string; tokensUsed: number; model: string }> {
        if (!this.openai) {
            throw new HttpException(
                'DeepSeek is not configured. Please set DEEPSEEK_API_KEY.',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        try {
            const {
                maxTokens = 2048,
                temperature = 0.7,
                systemPrompt,
                model = 'deepseek-chat'
            } = options || {};

            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

            if (systemPrompt) {
                messages.push({
                    role: 'system',
                    content: systemPrompt,
                });
            }

            messages.push({
                role: 'user',
                content: prompt,
            });

            const completion = await this.openai.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature,
            });

            const aiResponse = completion.choices[0]?.message?.content || '';
            const tokensUsed = completion.usage?.total_tokens || 0;
            const modelUsed = completion.model;

            this.logger.log(`DeepSeek response generated (model: ${modelUsed}, tokens: ${tokensUsed})`);
            return { response: aiResponse, tokensUsed, model: modelUsed };
        } catch (error) {
            this.logger.error('Error generating DeepSeek response:', error);

            // Manejo específico de errores de DeepSeek
            if (error instanceof OpenAI.APIError) {
                throw new HttpException(
                    {
                        message: error.message,
                        errorCode: error.code || 'DEEPSEEK_API_ERROR',
                        status: error.status,
                    },
                    error.status || HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }

            throw new HttpException(
                'Error al conectar con el modelo de IA de DeepSeek',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Verifica si DeepSeek está disponible
     */
    isAvailable(): boolean {
        return !!this.openai;
    }

    /**
     * Obtiene información del modelo
     */
    async getModelInfo(): Promise<any> {
        if (!this.openai) {
            throw new HttpException(
                'DeepSeek is not configured. Please set DEEPSEEK_API_KEY.',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        try {
            const models = await this.openai.models.list();
            return models.data;
        } catch (error) {
            this.logger.error('Error getting DeepSeek models:', error);
            throw new HttpException(
                'Error al obtener información de modelos de DeepSeek',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }
}
