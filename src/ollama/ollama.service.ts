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

    constructor(private configService: ConfigService) {
        this.ollamaUrl = this.configService.get<string>(
            'OLLAMA_URL',
            'http://localhost:11434',
        );
        this.defaultModel = this.configService.get<string>(
            'OLLAMA_MODEL',
            'deepseek-r1:7b',
        );
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.message?.content || '';
                            if (content) {
                                yield { content: this.stripThinkTags(content) };
                            }
                        } catch (e) {
                            // Ignora líneas inválidas
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
    ): Promise<{ content: string; tokensUsed: number }> {
        try {
            const payload: OllamaGenerateRequest = {
                model: this.defaultModel,
                messages,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: maxTokens || 2048,
                },
            };

            this.logger.log(
                `Generando respuesta con modelo ${this.defaultModel} (max_tokens: ${maxTokens})`,
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
        return !!this.ollamaUrl && this.ollamaUrl !== '';
    }
}
