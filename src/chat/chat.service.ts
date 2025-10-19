import {
    Injectable,
    Logger,
    ForbiddenException,
    NotFoundException,
    BadRequestException,
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
import type { PrismaClient } from '@prisma/client';

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
            userId ? undefined : dto.anonymousId,
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

        // 2. Obtener tier del usuario
        let tier: SubscriptionTier = SubscriptionTier.FREE;
        if (userId) {
            const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);
            if (subscription) {
                tier = subscription.tier;
            }
        }

        const limits = this.subscriptionsService.getUserLimits(tier);

        // 3. Obtener o crear chat
        let chatId = dto.conversationId; // Mantenemos el nombre del DTO por compatibilidad
        let chat: any = null;

        if (userId && !chatId) {
            // Crear nuevo chat para usuario registrado
            chat = await this.prisma.chat.create({
                data: {
                    ownerId: userId,
                    title: this.generateTitle(dto.content),
                    isAnonymous: false,
                },
            });
            chatId = chat.id;
        } else if (!userId) {
            // Usuarios anónimos: no guardan chat persistente
            chatId = 'anonymous';
        } else if (userId && chatId) {
            // Buscar chat existente
            chat = await this.prisma.chat.findUnique({
                where: { id: chatId }
            });

            // Si no existe el chat, crear uno nuevo
            if (!chat) {
                console.log(`🔍 ChatService: Chat ${chatId} no existe, creando nuevo`);
                chat = await this.prisma.chat.create({
                    data: {
                        id: chatId,
                        ownerId: userId,
                        title: this.generateTitle(dto.content),
                        isAnonymous: false,
                    },
                });
            }
        }

        // 4. Guardar mensaje del usuario (solo si es registrado)
        let userMessage;
        if (userId && chatId !== 'anonymous') {
            userMessage = await this.prisma.message.create({
                data: {
                    chatId: chatId!,
                    userId,
                    role: MessageRole.USER,
                    content: dto.content,
                },
            });
        }

        // 5. Obtener historial del chat (solo registrados)
        const history = userId
            ? await this.getChatHistory(chatId!)
            : [];

        // 6. Determinar modelo a usar (por defecto: ollama)
        const selectedModel = (dto.model || 'ollama').trim();

        // 7. Generar respuesta del modelo
        let aiResponse = '';
        let tokensUsed = 0;
        let modelUsed = '';

        // 7.a. Modelos premium (requieren suscripción PREMIUM)
        const isPremiumRequested = ['gemini', 'openai', 'deepseek'].includes(selectedModel);
        if (isPremiumRequested && tier !== SubscriptionTier.PREMIUM) {
            throw new ForbiddenException('Este modelo es Premium. Actualiza tu suscripción para usarlo.');
        }

        if (selectedModel === 'gemini') {
            const geminiResponse = await this.geminiService.generateResponse(dto.content, {
                maxTokens: limits.maxTokensPerMessage,
                temperature: 0.7,
                systemPrompt: 'Eres un asistente de IA útil y amigable.',
            });
            aiResponse = geminiResponse.response;
            tokensUsed = geminiResponse.tokensUsed;
            modelUsed = geminiResponse.model;
        } else if (selectedModel === 'openai') {
            const openaiResponse = await this.openaiService.generateResponse(dto.content, {
                maxTokens: limits.maxTokensPerMessage,
                temperature: 0.7,
                systemPrompt: 'Eres un asistente de IA útil y amigable.',
                model: 'gpt-4o-mini',
            });
            aiResponse = openaiResponse.response;
            tokensUsed = openaiResponse.tokensUsed;
            modelUsed = openaiResponse.model;
        } else if (selectedModel === 'deepseek') {
            const deepseekResponse = await this.deepseekService.generateResponse(dto.content, {
                maxTokens: limits.maxTokensPerMessage,
                temperature: 0.7,
                systemPrompt: 'Eres un asistente de IA útil y amigable.',
                model: 'deepseek-chat',
            });
            aiResponse = deepseekResponse.response;
            tokensUsed = deepseekResponse.tokensUsed;
            modelUsed = deepseekResponse.model;
        } else {
            // 7.d. Ollama (modelo local). Permite especificar modelo concreto.
            const ollamaMessages = [
                ...history.map((m) => ({
                    role: m.role as 'user' | 'assistant' | 'system',
                    content: m.content,
                })),
                { role: 'user' as const, content: dto.content },
            ];
            // Determinar modelo específico de Ollama si viene prefijado o directo
            let ollamaModel: string | undefined = selectedModel;
            if (selectedModel.startsWith('ollama-')) {
                ollamaModel = selectedModel.replace('ollama-', '');
            } else if (selectedModel === 'ollama') {
                // No especificar para usar el modelo por defecto configurado en OllamaService
                ollamaModel = undefined;
            }

            const ollamaResponse = await this.ollamaService.generate(
                ollamaMessages,
                limits.maxTokensPerMessage,
                ollamaModel,
            );
            aiResponse = ollamaResponse.content;
            tokensUsed = ollamaResponse.tokensUsed;
            modelUsed = ollamaModel || 'ollama-default';
        }

        // 8. Guardar respuesta del asistente (solo si es registrado)
        let assistantMessage;
        if (userId && chatId !== 'anonymous') {
            assistantMessage = await this.prisma.message.create({
                data: {
                    chatId: chatId!,
                    userId,
                    role: MessageRole.ASSISTANT,
                    content: aiResponse,
                    tokensUsed,
                    model: modelUsed,
                },
            });

            // Si el título es el placeholder, intenta actualizarlo con el primer mensaje del usuario
            if (chat && chat.title === 'Nueva conversación') {
                const newTitle = this.generateTitle(dto.content);
                if (newTitle && newTitle !== 'Nueva conversación') {
                    chat = await this.prisma.chat.update({
                        where: { id: chatId! },
                        data: { title: newTitle }
                    });
                }
            }
        }

        // 9. Incrementar contador de uso
        await this.usageService.incrementMessageCount(
            tokensUsed,
            userId,
            userId ? undefined : dto.anonymousId,
        );

        // 10. Retornar respuesta en formato esperado por el frontend
        const updatedChat = {
            id: chatId !== 'anonymous' ? chatId : 'temp-chat-id',
            title: chat?.title || 'Nueva conversación',
            model: modelUsed,
            messages: [
                {
                    id: userMessage?.id || 'temp-user-id',
                    role: 'user',
                    content: dto.content,
                    createdAt: new Date(),
                },
                {
                    id: assistantMessage?.id || 'temp-assistant-id',
                    role: 'assistant',
                    content: aiResponse,
                    createdAt: new Date(),
                    tokensUsed,
                },
            ],
        };

        return {
            conversationId: chatId !== 'anonymous' ? chatId : 'temp-chat-id',
            message: {
                id: assistantMessage?.id || 'temp-assistant-id',
                role: 'assistant',
                content: aiResponse,
                createdAt: new Date(),
                tokensUsed,
            },
            remaining: canSend.remaining - 1,
            limit: canSend.limit,
            tier: tier,
        };
    }

    /**
     * Obtiene el historial de un chat
     */
    async getChatHistory(chatId: string) {
        try {
            const messages = await this.prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: 'asc' },
                take: 20, // Últimos 20 mensajes para contexto
                select: {
                    role: true,
                    content: true,
                },
            });

            // Convertir a formato Ollama
            return messages.map(msg => ({
                role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
                content: msg.content,
            }));
        } catch (error) {
            this.logger.error('Error obteniendo historial:', error);
            return [];
        }
    }

    /**
     * Lista chats de un usuario
     */
    async getUserChats(userId: string) {
        return this.prisma.chat.findMany({
            where: { ownerId: userId },
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
     * Obtiene un chat específico con todos sus mensajes
     */
    async getChat(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                ownerId: userId, // Asegurar que es del usuario
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat no encontrado');
        }

        return chat;
    }

    /**
     * Elimina un chat
     */
    async deleteChat(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                ownerId: userId,
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat no encontrado');
        }

        await this.prisma.chat.delete({
            where: { id: chatId },
        });

        return { message: 'Chat eliminado' };
    }

    /**
     * Crea un nuevo chat
     */
    async createChat(ownerId?: string, title?: string): Promise<any> {
        try {
            const chat = await this.prisma.chat.create({
                data: {
                    title: title || 'Nueva conversación',
                    isAnonymous: !ownerId,
                    ownerId: ownerId,
                },
            });

            return chat;
        } catch (error) {
            this.logger.error('Error creando chat:', error);
            throw error;
        }
    }

    /**
     * Guarda un mensaje del usuario
     */
    async saveUserMessage(chatId: string, userId: string, content: string) {
        return this.prisma.message.create({
            data: {
                chatId,
                userId,
                role: MessageRole.USER,
                content,
            },
        });
    }

    /**
     * Guarda un mensaje del asistente
     */
    async saveAssistantMessage(chatId: string, userId: string | null, content: string) {
        return this.prisma.message.create({
            data: {
                chatId,
                userId,
                role: MessageRole.ASSISTANT,
                content,
            },
        });
    }

    /**
     * Actualiza el primer mensaje del usuario y regenera el título del chat
     */
    async updateFirstMessageAndTitle(chatId: string, userId: string, newContent: string) {
        // Verificar que el chat sea del usuario
        const chat = await this.prisma.chat.findFirst({
            where: { id: chatId, ownerId: userId },
        });
        if (!chat) {
            throw new ForbiddenException('No tienes acceso a este chat');
        }

        // Buscar primer mensaje del usuario en ese chat
        const firstUserMessage = await this.prisma.message.findFirst({
            where: { chatId, userId, role: MessageRole.USER },
            orderBy: { createdAt: 'asc' },
        });
        if (!firstUserMessage) {
            throw new BadRequestException('No hay mensaje de usuario para actualizar');
        }

        // Actualizar contenido del mensaje
        await this.prisma.message.update({
            where: { id: firstUserMessage.id },
            data: { content: newContent },
        });

        // Regenerar título con el nuevo contenido
        const newTitle = this.generateTitle(newContent);
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { title: newTitle },
        });

        return { success: true, data: { title: newTitle }, message: 'Mensaje y título actualizados' };
    }

    /**
     * Actualiza el título de un chat
     */
    async updateChatTitle(chatId: string, userId: string, title: string) {
        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                ownerId: userId,
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat no encontrado');
        }

        return this.prisma.chat.update({
            where: { id: chatId },
            data: { title },
        });
    }

    /**
     * Obtiene estadísticas de uso del usuario
     */
    async getUserUsageStats(userId: string) {
        const stats = await this.usageService.getUserStats(userId);
        const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);
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

    /**
     * Lista chats (alias para compatibilidad)
     */
    async listChats(ownerId?: string): Promise<any[]> {
        return this.getUserChats(ownerId || '');
    }

    /**
     * Renombra un chat
     */
    async renameChat(chatId: string, title: string, userId?: string): Promise<void> {
        if (!userId) {
            throw new ForbiddenException('Usuario requerido para renombrar chat');
        }

        const chat = await this.prisma.chat.findFirst({
            where: {
                id: chatId,
                ownerId: userId,
            }
        });

        if (!chat) {
            throw new NotFoundException('Chat no encontrado o sin permisos');
        }

        await this.prisma.chat.update({
            where: { id: chatId },
            data: { title, updatedAt: new Date() },
        });
    }

    /**
     * Guarda mensaje de usuario en chat (alias para compatibilidad)
     */
    async saveUserMessageToChat(chatId: string, userId: string | null, content: string, model?: string): Promise<any> {
        const message = await this.prisma.message.create({
            data: {
                chatId,
                userId: userId ?? null,
                role: MessageRole.USER,
                content,
                model: model || 'deepseek-r1:7b',
            },
        });

        // Actualizar timestamp del chat
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
        });

        return message;
    }

    /**
     * Guarda mensaje de assistant en chat (alias para compatibilidad)
     */
    async saveAssistantMessageToChat(chatId: string, userId: string | null, content: string, model?: string): Promise<any> {
        const message = await this.prisma.message.create({
            data: {
                chatId,
                userId: null, // Assistant no tiene userId
                role: MessageRole.ASSISTANT,
                content,
                model: model || 'deepseek-r1:7b',
            },
        });

        // Actualizar timestamp del chat
        await this.prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
        });

        return message;
    }

    /**
     * Genera un título basado en el contenido del mensaje
     */
    private generateTitle(content: string): string {
        // Tomar las primeras 50 caracteres y limpiar
        const cleanContent = content.trim().replace(/\n/g, ' ');
        if (cleanContent.length <= 50) {
            return cleanContent;
        }
        return cleanContent.substring(0, 47) + '...';
    }
}
