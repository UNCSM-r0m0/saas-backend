import {
    Injectable,
    Logger,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { DeepSeekService } from '../deepseek/deepseek.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../usage/usage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SubscriptionTier, MessageRole } from '@prisma/client';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private prisma: PrismaService,
        private ollamaService: OllamaService,
        private geminiService: GeminiService,
        private openaiService: OpenAIService,
        private deepseekService: DeepSeekService,
        private subscriptionsService: SubscriptionsService,
        private usageService: UsageService,
    ) { }

    /**
     * Envía un mensaje y obtiene respuesta del modelo
     */
    async sendMessage(dto: SendMessageDto, userId?: string) {
        // 1. Validar rate limiting
        const canSend = await this.usageService.canSendMessage(
            userId,
            dto.anonymousId,
        );

        if (!canSend.allowed) {
            throw new ForbiddenException(
                `Has alcanzado tu límite de ${canSend.limit} mensajes por día. ${!userId
                    ? 'Regístrate para obtener más mensajes.'
                    : canSend.limit === 3
                        ? 'Actualiza a Premium para más mensajes.'
                        : ''
                }`,
            );
        }

        // 2. Obtener tier y límites
        let tier: SubscriptionTier = SubscriptionTier.FREE;
        if (userId) {
            const subscription =
                await this.subscriptionsService.getOrCreateSubscription(userId);
            tier = subscription.tier;
        }

        const limits = this.subscriptionsService.getUserLimits(tier);

        // 3. Obtener o crear conversación (solo para usuarios registrados)
        let conversationId = dto.conversationId;
        if (userId && !conversationId) {
            const conversation = await this.prisma.conversation.create({
                data: {
                    userId,
                    title: this.generateTitle(dto.content),
                },
            });
            conversationId = conversation.id;
        } else if (!userId) {
            // Usuarios anónimos: no guardan conversación
            conversationId = 'anonymous';
        }

        // 4. Guardar mensaje del usuario (solo si es registrado)
        let userMessage;
        if (userId && conversationId !== 'anonymous') {
            userMessage = await this.prisma.message.create({
                data: {
                    conversationId: conversationId!,
                    userId,
                    role: MessageRole.USER,
                    content: dto.content,
                },
            });
        }

        // 5. Obtener historial de la conversación (solo registrados)
        const history = userId
            ? await this.getConversationHistory(conversationId!)
            : [];

        // 6. Determinar modelo a usar (por defecto: ollama)
        const selectedModel = dto.model || 'ollama';

        // 7. Generar respuesta según el modelo seleccionado
        let aiResponse: string;
        let tokensUsed: number;
        let modelUsed: string;

        if (selectedModel === 'gemini') {
            // Usar Gemini
            if (!this.geminiService.isAvailable()) {
                throw new ForbiddenException('Gemini model is not available. Please configure GEMINI_API_KEY.');
            }

            const geminiResponse = await this.geminiService.generateResponse(dto.content, {
                maxTokens: limits.maxTokensPerMessage,
                temperature: 0.7,
                systemPrompt: this.buildSystemPrompt(tier),
            });

            aiResponse = geminiResponse.response;
            tokensUsed = geminiResponse.tokensUsed;
            modelUsed = geminiResponse.model;
        } else if (selectedModel === 'openai') {
            // Usar OpenAI
            if (!this.openaiService.isAvailable()) {
                throw new ForbiddenException({
                    message: 'OpenAI model is not available. Please configure OPENAI_API_KEY.',
                    errorCode: 'AI_MODEL_UNAVAILABLE',
                });
            }

            try {
                const openaiResponse = await this.openaiService.generateResponse(dto.content, {
                    maxTokens: limits.maxTokensPerMessage,
                    temperature: 0.7,
                    systemPrompt: this.buildSystemPrompt(tier),
                    model: 'gpt-4o-mini',
                });

                aiResponse = openaiResponse.response;
                tokensUsed = openaiResponse.tokensUsed;
                modelUsed = openaiResponse.model;
            } catch (error) {
                // Si OpenAI falla, intentar con Ollama como fallback
                this.logger.warn(`OpenAI failed, falling back to Ollama: ${error.message}`);

                const ollamaMessages = [
                    ...history.map((m) => ({
                        role: m.role as 'user' | 'assistant' | 'system',
                        content: m.content,
                    })),
                    { role: 'user' as const, content: dto.content },
                ];

                const ollamaResponse = await this.ollamaService.generate(
                    ollamaMessages,
                    limits.maxTokensPerMessage,
                );

                aiResponse = ollamaResponse.content;
                tokensUsed = ollamaResponse.tokensUsed;
                modelUsed = 'ollama-fallback';
            }
        } else if (selectedModel === 'deepseek') {
            // Usar DeepSeek
            if (!this.deepseekService.isAvailable()) {
                throw new ForbiddenException({
                    message: 'DeepSeek model is not available. Please configure DEEPSEEK_API_KEY.',
                    errorCode: 'AI_MODEL_UNAVAILABLE',
                });
            }

            try {
                const deepseekResponse = await this.deepseekService.generateResponse(dto.content, {
                    maxTokens: limits.maxTokensPerMessage,
                    temperature: 0.7,
                    systemPrompt: this.buildSystemPrompt(tier),
                    model: 'deepseek-chat',
                });

                aiResponse = deepseekResponse.response;
                tokensUsed = deepseekResponse.tokensUsed;
                modelUsed = deepseekResponse.model;
            } catch (error) {
                // Si DeepSeek falla, intentar con Ollama como fallback
                this.logger.warn(`DeepSeek failed, falling back to Ollama: ${error.message}`);

                const ollamaMessages = [
                    ...history.map((m) => ({
                        role: m.role as 'user' | 'assistant' | 'system',
                        content: m.content,
                    })),
                    { role: 'user' as const, content: dto.content },
                ];

                const ollamaResponse = await this.ollamaService.generate(
                    ollamaMessages,
                    limits.maxTokensPerMessage,
                );

                aiResponse = ollamaResponse.content;
                tokensUsed = ollamaResponse.tokensUsed;
                modelUsed = 'ollama-fallback';
            }
        } else {
            // Usar Ollama (por defecto)
            const ollamaMessages = [
                ...history.map((m) => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content,
                })),
                { role: 'user' as const, content: dto.content },
            ];

            const ollamaResponse = await this.ollamaService.generate(
                ollamaMessages,
                limits.maxTokensPerMessage,
            );

            aiResponse = ollamaResponse.content;
            tokensUsed = ollamaResponse.tokensUsed;
            modelUsed = 'ollama';
        }

        // 8. Guardar respuesta del asistente (solo si es registrado)
        let assistantMessage;
        if (userId && conversationId !== 'anonymous') {
            assistantMessage = await this.prisma.message.create({
                data: {
                    conversationId: conversationId!,
                    userId,
                    role: MessageRole.ASSISTANT,
                    content: aiResponse,
                    tokensUsed,
                    model: modelUsed,
                },
            });
        }

        // 9. Incrementar contador de uso
        await this.usageService.incrementMessageCount(
            tokensUsed,
            userId,
            dto.anonymousId,
        );

        // 10. Retornar respuesta
        return {
            conversationId: conversationId !== 'anonymous' ? conversationId : null,
            message: {
                id: assistantMessage?.id || 'temp-id',
                role: 'assistant',
                content: aiResponse,
                tokensUsed,
                createdAt: new Date(),
            },
            remaining: canSend.remaining - 1,
            limit: canSend.limit,
            tier,
        };
    }

    /**
     * Obtiene el historial de una conversación
     */
    async getConversationHistory(conversationId: string) {
        return this.prisma.message.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            take: 20, // Últimos 20 mensajes para contexto
            select: {
                role: true,
                content: true,
            },
        });
    }

    /**
     * Lista conversaciones de un usuario
     */
    async listConversations(userId: string) {
        return this.prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: { messages: true },
                },
            },
        });
    }

    /**
     * Obtiene una conversación específica con todos sus mensajes
     */
    async getConversation(conversationId: string, userId: string) {
        const conversation = await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId, // Asegurar que es del usuario
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        return conversation;
    }

    /**
     * Elimina una conversación
     */
    async deleteConversation(conversationId: string, userId: string) {
        const conversation = await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId,
            },
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        await this.prisma.conversation.delete({
            where: { id: conversationId },
        });

        return { message: 'Conversación eliminada' };
    }

    /**
     * Actualiza el título de una conversación
     */
    async updateConversationTitle(
        conversationId: string,
        userId: string,
        title: string,
    ) {
        const conversation = await this.prisma.conversation.findFirst({
            where: {
                id: conversationId,
                userId,
            },
        });

        if (!conversation) {
            throw new NotFoundException('Conversación no encontrada');
        }

        return this.prisma.conversation.update({
            where: { id: conversationId },
            data: { title },
        });
    }

    /**
     * Construye el prompt del sistema según el tier del usuario
     */
    private buildSystemPrompt(tier: SubscriptionTier): string {
        const basePrompt = 'Eres un asistente de IA útil y amigable. Responde de manera clara y concisa.';

        switch (tier) {
            case 'PREMIUM':
                return `${basePrompt} Tienes acceso completo a todas las funcionalidades, incluyendo análisis de imágenes y respuestas detalladas.`;
            case 'REGISTERED':
                return `${basePrompt} Eres un usuario registrado con acceso a historial de conversaciones.`;
            default:
                return `${basePrompt} Eres un usuario anónimo con acceso limitado.`;
        }
    }

    /**
     * Genera un título para la conversación basado en el primer mensaje
     */
    private generateTitle(content: string): string {
        const maxLength = 50;
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '...';
    }

    /**
     * Obtiene estadísticas de uso del usuario
     */
    async getUserUsageStats(userId: string) {
        const stats = await this.usageService.getUserStats(userId);
        const subscription =
            await this.subscriptionsService.getOrCreateSubscription(userId);
        const limits = this.subscriptionsService.getUserLimits(subscription.tier);

        return {
            ...stats,
            tier: subscription.tier,
            limits: {
                messagesPerDay: limits.messagesPerDay,
                maxTokensPerMessage: limits.maxTokensPerMessage,
                canUploadImages: limits.canUploadImages,
            },
        };
    }
}
