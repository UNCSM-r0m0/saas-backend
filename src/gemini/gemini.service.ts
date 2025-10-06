import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private readonly genAI: GoogleGenerativeAI;
    private readonly model: any;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not configured, Gemini features will be disabled');
            return;
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    async generateResponse(prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
    }): Promise<{
        response: string;
        tokensUsed: number;
        model: string;
    }> {
        if (!this.model) {
            throw new Error('Gemini not configured. Please set GEMINI_API_KEY in environment variables.');
        }

        try {
            const { maxTokens = 2048, temperature = 0.7, systemPrompt } = options || {};

            // Construir el prompt completo
            let fullPrompt = prompt;
            if (systemPrompt) {
                fullPrompt = `${systemPrompt}\n\nUsuario: ${prompt}\nAsistente:`;
            }

            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: temperature,
                },
            });

            const response = result.response;
            const text = response.text();

            // Estimación de tokens (Gemini no proporciona tokens usados directamente)
            const tokensUsed = Math.ceil(text.length / 4); // Estimación aproximada

            this.logger.log(`Gemini response generated, estimated tokens: ${tokensUsed}`);

            return {
                response: text,
                tokensUsed,
                model: 'gemini-2.0-flash-exp',
            };
        } catch (error) {
            this.logger.error(`Error generating Gemini response: ${error.message}`);
            throw error;
        }
    }

    async generateStreamingResponse(prompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
    }): Promise<AsyncIterable<string>> {
        if (!this.model) {
            throw new Error('Gemini not configured. Please set GEMINI_API_KEY in environment variables.');
        }

        try {
            const { maxTokens = 2048, temperature = 0.7, systemPrompt } = options || {};

            let fullPrompt = prompt;
            if (systemPrompt) {
                fullPrompt = `${systemPrompt}\n\nUsuario: ${prompt}\nAsistente:`;
            }

            const result = await this.model.generateContentStream({
                contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: temperature,
                },
            });

            return this.streamResponse(result);
        } catch (error) {
            this.logger.error(`Error generating streaming Gemini response: ${error.message}`);
            throw error;
        }
    }

    private async* streamResponse(result: any): AsyncIterable<string> {
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield chunkText;
            }
        }
    }

    /**
     * Verificar si Gemini está disponible
     */
    isAvailable(): boolean {
        return !!this.model;
    }

    /**
     * Obtener información del modelo
     */
    getModelInfo() {
        return {
            name: 'gemini-2.0-flash-exp',
            provider: 'Google',
            available: this.isAvailable(),
            features: ['text-generation', 'streaming', 'multimodal'],
        };
    }
}
