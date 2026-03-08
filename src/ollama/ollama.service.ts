import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OllamaMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OllamaGenerateRequest {
    model: string;
    messages: OllamaMessage[];
    stream?: boolean;
    options?: {
        temperature?: number;
        top_p?: number;
        max_tokens?: number;
    };
}

export interface OllamaGenerateResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}

@Injectable()
export class OllamaService {
    private readonly logger = new Logger(OllamaService.name);
    private readonly ollamaUrl: string;
    private readonly defaultModel: string;
    private readonly ollamaProxyUrl?: string;
    private readonly ollamaProxyApiKey?: string;
    private readonly useProxy: boolean;

    constructor(private configService: ConfigService) {
        this.ollamaUrl = this.configService.get<string>(
            'OLLAMA_URL',
            'http://localhost:11434',
        );
        this.defaultModel = this.configService.get<string>(
            'OLLAMA_MODEL',
            'deepseek-r1:7b',
        );
        this.ollamaProxyUrl = this.configService.get<string>('OLLAMA_PROXY_URL');
        this.ollamaProxyApiKey = this.configService.get<string>('OLLAMA_PROXY_API_KEY');
        this.useProxy = !!this.ollamaProxyUrl;
    }

    /**
     * Remueve las etiquetas <think>...</think> del contenido
     */
    private stripThinkTags(content: string): string {
        // Elimina <think>...</think> y espacios alrededor
        return content.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    }

    /**
     * Genera una respuesta del modelo de Ollama con streaming
     */
    async* generateStream(
        messages: OllamaMessage[],
        model?: string,
        maxTokens?: number,
    ): AsyncGenerator<{ content: string }> {
        try {
            if (this.useProxy && this.ollamaProxyUrl) {
                const payload = {
                    model: model || this.defaultModel,
                    messages,
                    stream: true,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: maxTokens || 2048,
                };

                this.logger.log(
                    `Generando stream via proxy con modelo ${model || this.defaultModel}`,
                );

                const response = await fetch(`${this.ollamaProxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.ollamaProxyApiKey
                            ? { Authorization: `Bearer ${this.ollamaProxyApiKey}` }
                            : {}),
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok || !response.body) {
                    throw new HttpException(
                        `Ollama proxy stream error: ${response.statusText}`,
                        response.status,
                    );
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const data = trimmed.replace(/^data:\s*/, '');
                        if (data === '[DONE]') return;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                yield { content };
                            }
                        } catch (e) {
                            this.logger.warn(`📥 Error parseando SSE: "${data}"`);
                        }
                    }
                }

                return;
            }

            const payload: OllamaGenerateRequest = {
                model: model || this.defaultModel,
                messages,
                stream: true, // ¡Clave para streaming!
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: maxTokens || 2048,
                },
            };

            this.logger.log(
                `Generando stream con modelo ${model || this.defaultModel}`,
            );
            this.logger.log(`📤 Payload enviado a Ollama:`, JSON.stringify(payload, null, 2));

            const response = await fetch(`${this.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok || !response.body) {
                throw new HttpException(
                    `Ollama stream error: ${response.statusText}`,
                    response.status,
                );
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let totalChunks = 0;

            this.logger.log(`📥 Iniciando lectura de stream...`);

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    this.logger.log(`📥 Stream terminado. Total chunks procesados: ${totalChunks}`);
                    break;
                }

                const chunk = decoder.decode(value);
                // this.logger.debug(`📥 Chunk raw recibido: "${chunk}"`); // Comentado para reducir logs

                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    // Ollama envía JSON directamente, no SSE format
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line);

                            // Verificar si es el chunk final
                            if (parsed.done === true) {
                                this.logger.log(`📥 Stream marcado como terminado`);
                                break;
                            }

                            const content = parsed.message?.content || '';
                            if (content) {
                                totalChunks++;
                                // No limpiamos <think> aquí para preservar formato por chunk.
                                // El Gateway elimina <think> de forma incremental y mantiene saltos/código.
                                // this.logger.debug(`📥 Chunk ${totalChunks}: "${content}"`);
                                yield { content };
                            }
                        } catch (e) {
                            this.logger.warn(`📥 Error parseando línea: "${line}"`);
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error en stream de Ollama:', error);
            throw new HttpException(
                'Error al conectar con el modelo de IA local',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Genera una respuesta del modelo de Ollama (sin streaming)
     */
    async generate(
        messages: OllamaMessage[],
        maxTokens?: number,
        model?: string,
    ): Promise<{ content: string; tokensUsed: number }> {
        try {
            if (this.useProxy && this.ollamaProxyUrl) {
                const payload = {
                    model: model || this.defaultModel,
                    messages,
                    stream: false,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: maxTokens || 2048,
                };

                this.logger.log(
                    `Generando respuesta via proxy con modelo ${model || this.defaultModel} (max_tokens: ${maxTokens})`,
                );

                const response = await fetch(`${this.ollamaProxyUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.ollamaProxyApiKey
                            ? { Authorization: `Bearer ${this.ollamaProxyApiKey}` }
                            : {}),
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new HttpException(
                        `Ollama proxy error: ${response.statusText}`,
                        response.status,
                    );
                }

                const data = await response.json();
                const responseText = data.choices?.[0]?.message?.content || '';
                const tokensUsed = data.usage?.total_tokens || 0;

                const cleanedContent = this.stripThinkTags(responseText);

                return {
                    content: cleanedContent,
                    tokensUsed,
                };
            }

            const payload: OllamaGenerateRequest = {
                model: model || this.defaultModel,
                messages,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: maxTokens || 2048,
                },
            };

            this.logger.log(
                `Generando respuesta con modelo ${model || this.defaultModel} (max_tokens: ${maxTokens})`,
            );

            const response = await fetch(`${this.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new HttpException(
                    `Ollama API error: ${response.statusText}`,
                    response.status,
                );
            }

            const data: OllamaGenerateResponse = await response.json();

            const tokensUsed = (data.prompt_eval_count || 0) + (data.eval_count || 0);

            // Limpiar contenido removiendo <think>...</think>
            const rawContent = data.message.content;
            const cleanedContent = this.stripThinkTags(rawContent);

            return {
                content: cleanedContent,
                tokensUsed,
            };
        } catch (error) {
            this.logger.error('Error generando respuesta de Ollama:', error);
            throw new HttpException(
                'Error al conectar con el modelo de IA local',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    /**
     * Verifica si Ollama está disponible
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (this.useProxy && this.ollamaProxyUrl) {
                const response = await fetch(`${this.ollamaProxyUrl}/v1/models`, {
                    method: 'GET',
                    headers: this.ollamaProxyApiKey
                        ? { Authorization: `Bearer ${this.ollamaProxyApiKey}` }
                        : undefined,
                });
                return response.ok;
            }

            const response = await fetch(`${this.ollamaUrl}/api/tags`, {
                method: 'GET',
            });
            return response.ok;
        } catch (error) {
            this.logger.error('Ollama no está disponible:', error);
            return false;
        }
    }

    /**
     * Lista modelos disponibles en Ollama
     */
    async listModels(): Promise<string[]> {
        try {
            if (this.useProxy && this.ollamaProxyUrl) {
                const response = await fetch(`${this.ollamaProxyUrl}/v1/models`, {
                    headers: this.ollamaProxyApiKey
                        ? { Authorization: `Bearer ${this.ollamaProxyApiKey}` }
                        : undefined,
                });
                if (!response.ok) return [];

                const data = await response.json();
                return data.data?.map((m: any) => m.id) || [];
            }

            const response = await fetch(`${this.ollamaUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json();
            return data.models?.map((m: any) => m.name) || [];
        } catch (error) {
            this.logger.error('Error listando modelos:', error);
            return [];
        }
    }

    /**
     * Verifica si Ollama está disponible (método síncrono)
     */
    isAvailable(): boolean {
        // Por ahora asumimos que está disponible si la URL está configurada
        if (this.useProxy) {
            return !!this.ollamaProxyUrl;
        }
        return !!this.ollamaUrl && this.ollamaUrl !== '';
    }
}
