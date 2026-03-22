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
            // Manejo específico de errores de DeepSeek
            if (error instanceof OpenAI.APIError) {
                const errorMessage = error.message;
                const statusCode = error.status;

                this.logger.warn(`DeepSeek API error: ${statusCode} ${errorMessage}`);

                // Error 402: Insufficient Balance - Saldo insuficiente
                if (statusCode === 402 || errorMessage.includes('Insufficient Balance')) {
                    throw new HttpException(
                        'La cuenta de DeepSeek no tiene saldo suficiente. Por favor, recarga tu cuenta en DeepSeek o usa otro modelo.',
                        HttpStatus.PAYMENT_REQUIRED,
                    );
                }

                // Error 429: Rate Limit
                if (statusCode === 429 || errorMessage.includes('rate limit')) {
                    throw new HttpException(
                        'Se ha alcanzado el límite de solicitudes de DeepSeek. Por favor, intenta más tarde.',
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }

                // Otros errores de API
                throw new HttpException(
                    `Error de DeepSeek API: ${errorMessage}`,
                    statusCode || HttpStatus.SERVICE_UNAVAILABLE,
                );
            }

            // Error desconocido
            this.logger.error('DeepSeek unknown error:', error);
            throw new HttpException(
                'Error al comunicarse con DeepSeek. Por favor, intenta más tarde o usa otro modelo.',
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
