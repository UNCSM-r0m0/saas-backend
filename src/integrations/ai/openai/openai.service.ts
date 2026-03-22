import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LocalModelQueueService } from '../../../common/services/local-model-queue.service';

@Injectable()
export class OpenAIService {
    private readonly logger = new Logger(OpenAIService.name);
    private readonly openai: OpenAI | null = null;
    private readonly llmStudioClient: OpenAI | null = null;
    private readonly llmStudioModel: string;
    private readonly useLLMStudio: boolean;

    constructor(
        private readonly configService: ConfigService,
        @Inject(forwardRef(() => LocalModelQueueService))
        private readonly queueService: LocalModelQueueService,
    ) {
        // Configurar LLM Studio local (prioridad)
        const llmStudioUrl = this.configService.get<string>('LLM_STUDIO_BASE_URL');
        this.llmStudioModel = this.configService.get<string>('LLM_STUDIO_MODEL', 'openai/gpt-oss-20b');

        if (llmStudioUrl) {
            // Timeout de 20 minutos para modelos locales que pueden tardar mucho (especialmente para streaming)
            const timeout = 20 * 60 * 1000; // 20 minutos en milisegundos
            this.llmStudioClient = new OpenAI({
                apiKey: 'local-api-key', // LLM Studio no requiere API key real
                baseURL: `${llmStudioUrl}/v1`,
                timeout: timeout,
                maxRetries: 0, // No reintentar para modelos locales
            });
            this.useLLMStudio = true;
            this.logger.log(`✅ LLM Studio configurado: ${llmStudioUrl} con modelo ${this.llmStudioModel}, timeout: ${timeout / 1000}s`);
        } else {
            // Fallback a OpenAI cloud
            const apiKey = this.configService.get<string>('OPENAI_API_KEY');
            if (!apiKey) {
                this.logger.warn('Ni LLM_STUDIO_BASE_URL ni OPENAI_API_KEY configurados, OpenAI features deshabilitados');
                return;
            }

            this.openai = new OpenAI({
                apiKey: apiKey,
            });
            this.useLLMStudio = false;
            this.logger.log('✅ OpenAI Cloud configurado');
        }
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
        const client = this.useLLMStudio ? this.llmStudioClient : this.openai;

        if (!client) {
            throw new Error('OpenAI/LLM Studio not configured. Please set LLM_STUDIO_BASE_URL or OPENAI_API_KEY.');
        }

        // Si es modelo local, usar cola para evitar saturación
        if (this.useLLMStudio) {
            this.logger.log('🎯 Usando LLM Studio con cola de concurrencia');
            return this.queueService.execute(() => this._generateResponse(prompt, options, client));
        }

        // Si es OpenAI cloud, ejecutar directamente (sin cola)
        return this._generateResponse(prompt, options, client);
    }

    private async _generateResponse(
        prompt: string,
        options: {
            maxTokens?: number;
            temperature?: number;
            systemPrompt?: string;
            model?: string;
        } | undefined,
        client: OpenAI,
    ): Promise<{
        response: string;
        tokensUsed: number;
        model: string;
    }> {
        try {
            const {
                maxTokens = 2048,
                temperature = 0.7,
                systemPrompt,
                model
            } = options || {};

            // Usar modelo configurado de LLM Studio o el proporcionado
            const modelToUse = this.useLLMStudio ? this.llmStudioModel : (model || 'gpt-4o-mini');

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

            const stats = this.queueService.getStats();
            this.logger.log(`📊 Queue stats: ${stats.activeRequests}/${stats.maxConcurrent} activos, ${stats.queuedRequests} en cola (${stats.utilization}% uso)`);

            this.logger.log(`🔄 Iniciando llamada a LLM Studio/OpenAI con modelo: ${modelToUse}, max_tokens: ${maxTokens}`);
            const startTime = Date.now();

            const completion = await client.chat.completions.create({
                model: modelToUse,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature,
            });

            const elapsedTime = Date.now() - startTime;
            this.logger.log(`⏱️ Llamada completada en ${elapsedTime}ms (${(elapsedTime / 1000).toFixed(2)}s)`);

            const response = completion.choices[0]?.message?.content || '';
            const tokensUsed = completion.usage?.total_tokens || 0;

            this.logger.log(`✅ Respuesta generada, tokens: ${tokensUsed}, modelo: ${modelToUse}, longitud: ${response.length} caracteres`);

            return {
                response,
                tokensUsed,
                model: completion.model || modelToUse,
            };
        } catch (error) {
            const errorMessage = error instanceof OpenAI.APIError ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : 'No stack trace';
            this.logger.error(`❌ Error en generación: ${errorMessage}`);
            this.logger.error(`❌ Stack trace: ${errorStack}`);
            if (error instanceof OpenAI.APIError) {
                this.logger.error(`❌ Status: ${error.status}, Code: ${error.code}, Type: ${error.type}`);
            }
            throw error;
        }
    }

    async generateStreamingResponse(
        promptOrMessages: string | OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        options?: {
            maxTokens?: number;
            temperature?: number;
            systemPrompt?: string;
            model?: string;
        }
    ): Promise<AsyncIterable<string>> {
        const client = this.useLLMStudio ? this.llmStudioClient : this.openai;

        if (!client) {
            throw new Error('OpenAI/LLM Studio not configured. Please set LLM_STUDIO_BASE_URL or OPENAI_API_KEY.');
        }

        // Si es modelo local, usar cola para evitar saturación
        if (this.useLLMStudio) {
            this.logger.log('🎯 Usando LLM Studio streaming con cola de concurrencia');
            return this.queueService.execute(() => this._generateStreamingResponse(promptOrMessages, options, client));
        }

        // Si es OpenAI cloud, ejecutar directamente
        return this._generateStreamingResponse(promptOrMessages, options, client);
    }

    /**
     * Limita el historial de mensajes para evitar exceder el contexto del modelo
     * Para LLM Studio con contexto de 4096 tokens, mantenemos solo los últimos mensajes
     */
    private limitHistoryForLLMStudio(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        maxTokens: number = 2000
    ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        if (!this.useLLMStudio) return messages;

        // Estimación simple: ~4 caracteres por token
        const maxChars = maxTokens * 4;
        let totalChars = 0;
        const limited: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        // Recorrer desde el final (mensajes más recientes primero)
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const msgChars = content.length;

            if (totalChars + msgChars > maxChars && limited.length > 0) {
                // Si agregar este mensaje excedería el límite, parar
                break;
            }

            limited.unshift(msg); // Agregar al inicio para mantener el orden
            totalChars += msgChars;
        }

        if (limited.length < messages.length) {
            this.logger.log(
                `📉 Historial limitado: ${messages.length} → ${limited.length} mensajes ` +
                `(${totalChars} chars, límite: ${maxChars} chars)`
            );
        }

        return limited;
    }

    private async _generateStreamingResponse(
        promptOrMessages: string | OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        options: {
            maxTokens?: number;
            temperature?: number;
            systemPrompt?: string;
            model?: string;
        } | undefined,
        client: OpenAI,
    ): Promise<AsyncIterable<string>> {
        try {
            const {
                maxTokens = 2048,
                temperature = 0.7,
                systemPrompt,
                model
            } = options || {};

            const modelToUse = this.useLLMStudio ? this.llmStudioModel : (model || 'gpt-4o-mini');

            let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

            // Si es un string, convertirlo a array de mensajes
            if (typeof promptOrMessages === 'string') {
                if (systemPrompt) {
                    messages.push({
                        role: 'system',
                        content: systemPrompt,
                    });
                }
                messages.push({
                    role: 'user',
                    content: promptOrMessages,
                });
            } else {
                // Si es un array de mensajes, usarlo directamente
                messages = promptOrMessages;
                // Agregar systemPrompt si existe y no está ya en los mensajes
                if (systemPrompt && !messages.some(m => m.role === 'system')) {
                    messages.unshift({
                        role: 'system',
                        content: systemPrompt,
                    });
                }
            }

            // Limitar historial para LLM Studio para evitar exceder el contexto
            messages = this.limitHistoryForLLMStudio(messages, 2000);

            const stats = this.queueService.getStats();
            this.logger.log(`📊 Queue stats (streaming): ${stats.activeRequests}/${stats.maxConcurrent} activos, ${stats.queuedRequests} en cola`);

            this.logger.log(
                `🔄 Iniciando streaming con modelo: ${modelToUse}, ` +
                `${messages.length} mensajes, max_tokens: ${maxTokens}`
            );

            // El timeout ya está configurado en el constructor del cliente (20 minutos para LLM Studio)
            const stream = await client.chat.completions.create({
                model: modelToUse,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature,
                stream: true,
            });

            return this.streamResponse(stream);
        } catch (error) {
            this.logger.error(`❌ Error en streaming: ${error.message}`);
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
     * Verificar si OpenAI/LLM Studio está disponible
     */
    isAvailable(): boolean {
        return !!(this.useLLMStudio ? this.llmStudioClient : this.openai);
    }

    /**
     * Obtener información del modelo
     */
    getModelInfo() {
        if (this.useLLMStudio) {
            return {
                name: this.llmStudioModel,
                provider: 'LLM Studio Local',
                available: this.isAvailable(),
                features: ['text-generation', 'streaming', 'chat-completions'],
                queueStats: this.queueService.getStats(),
            };
        }

        return {
            name: 'gpt-4o-mini',
            provider: 'OpenAI',
            available: this.isAvailable(),
            features: ['text-generation', 'streaming', 'chat-completions'],
        };
    }

    /**
     * Listar modelos disponibles
     */
    async listModels(): Promise<string[]> {
        if (this.useLLMStudio && this.llmStudioClient) {
            // Para LLM Studio, retornar el modelo configurado
            return [this.llmStudioModel];
        }

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
