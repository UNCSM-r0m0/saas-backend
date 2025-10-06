import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
    private readonly logger = new Logger(OpenAIService.name);
    private readonly openai: OpenAI;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        if (!apiKey) {
            this.logger.warn('OPENAI_API_KEY not configured, OpenAI features will be disabled');
            return;
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
        });
    }

    async generateResponse(prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
        model?: string;
    }): Promise<{
        response: string;
        tokensUsed: number;
        model: string;
    }> {
        if (!this.openai) {
            throw new Error('OpenAI not configured. Please set OPENAI_API_KEY in environment variables.');
        }

        try {
            const {
                maxTokens = 2048,
                temperature = 0.7,
                systemPrompt,
                model = 'gpt-4o-mini'
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

            const response = completion.choices[0]?.message?.content || '';
            const tokensUsed = completion.usage?.total_tokens || 0;

            this.logger.log(`OpenAI response generated, tokens used: ${tokensUsed}`);

            return {
                response,
                tokensUsed,
                model: completion.model,
            };
        } catch (error) {
            // Log más limpio - solo el mensaje de error
            const errorMessage = error instanceof OpenAI.APIError ? error.message : 'Unknown error';
            this.logger.warn(`OpenAI API error: ${errorMessage}`);

            // Re-lanzar el error para que el filtro global lo maneje
            throw error;
        }
    }

    async generateStreamingResponse(prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
        model?: string;
    }): Promise<AsyncIterable<string>> {
        if (!this.openai) {
            throw new Error('OpenAI not configured. Please set OPENAI_API_KEY in environment variables.');
        }

        try {
            const {
                maxTokens = 2048,
                temperature = 0.7,
                systemPrompt,
                model = 'gpt-4o-mini'
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

            const stream = await this.openai.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: true,
            });

            return this.streamResponse(stream);
        } catch (error) {
            this.logger.error(`Error generating streaming OpenAI response: ${error.message}`);
            throw error;
        }
    }

    private async* streamResponse(stream: any): AsyncIterable<string> {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }

    /**
     * Verificar si OpenAI está disponible
     */
    isAvailable(): boolean {
        return !!this.openai;
    }

    /**
     * Obtener información del modelo
     */
    getModelInfo() {
        return {
            name: 'gpt-3.5-turbo',
            provider: 'OpenAI',
            available: this.isAvailable(),
            features: ['text-generation', 'streaming', 'chat-completions'],
        };
    }

    /**
     * Listar modelos disponibles
     */
    async listModels(): Promise<string[]> {
        if (!this.openai) {
            return [];
        }

        try {
            const models = await this.openai.models.list();
            return models.data
                .filter(model => model.id.includes('gpt'))
                .map(model => model.id)
                .sort();
        } catch (error) {
            this.logger.error('Error listing OpenAI models:', error);
            return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']; // Fallback
        }
    }
}
