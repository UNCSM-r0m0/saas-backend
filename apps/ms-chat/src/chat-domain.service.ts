import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessageRole, SubscriptionTier } from '@prisma/client';
import {
  AIProviderRegistry,
  AIMessage,
  AIMessageRole,
  AIProviderConfig,
} from 'libs/ai';
import { SubscriptionsService } from 'libs/domain/subscriptions';
import { UsageService } from 'libs/domain/usage';
import { PrismaService } from 'libs/platform/prisma';
import type { ChatSendMessageDto as SendMessageDto } from 'libs/contracts/chat';

@Injectable()
export class ChatDomainService {
  private readonly logger = new Logger(ChatDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AIProviderRegistry,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageService: UsageService,
  ) {}

  async sendMessage(dto: SendMessageDto, userId?: string) {
    const canSend = await this.usageService.canSendMessage(
      userId,
      userId ? undefined : dto.anonymousId,
    );

    if (!canSend.allowed) {
      throw new ForbiddenException(
        `Has alcanzado tu límite de ${canSend.limit} mensajes por día.`,
      );
    }

    let tier: SubscriptionTier = SubscriptionTier.FREE;
    if (userId) {
      const subscription =
        await this.subscriptionsService.getOrCreateSubscription(userId);
      tier = subscription.tier;
    }

    const limits = this.subscriptionsService.getUserLimits(tier);

    let chatId = dto.conversationId;
    let chat: any = null;

    if (userId && !chatId) {
      chat = await this.prisma.chat.create({
        data: {
          ownerId: userId,
          title: this.generateTitle(dto.content),
          isAnonymous: false,
        },
      });
      chatId = chat.id;
    } else if (!userId) {
      chatId = 'anonymous';
    } else if (userId && chatId) {
      chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat) {
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

    if (userId && chatId !== 'anonymous') {
      await this.prisma.message.create({
        data: {
          chatId: chatId!,
          userId,
          role: MessageRole.USER,
          content: dto.content,
        },
      });
    }

    const history = userId ? await this.getChatHistory(chatId!) : [];
    const selectedModel = (dto.model || 'ollama').trim();

    const isPremiumRequested = ['gemini', 'openai', 'deepseek'].includes(
      selectedModel,
    );
    if (isPremiumRequested && tier !== SubscriptionTier.PREMIUM) {
      throw new ForbiddenException(
        'Este modelo es Premium. Actualiza tu suscripción para usarlo.',
      );
    }

    // Build messages array from history and current message
    const messages = this.buildMessages(dto.content, history);

    // Get provider from registry
    const provider = this.registry.getProvider(selectedModel);

    // Build provider config
    const config: AIProviderConfig = {
      model: selectedModel,
      maxTokens: limits.maxTokensPerMessage,
      temperature: 0.7,
      systemPrompt: 'Eres un asistente de IA útil y amigable.',
    };

    // Generate response using the unified provider interface
    let aiResponse: string;
    let tokensUsed: number;
    let modelUsed: string;

    try {
      const response = await provider.generate(messages, config);
      aiResponse = response.content;
      tokensUsed = response.tokensUsed;
      modelUsed = response.model;
    } catch (error: any) {
      // Handle Ollama memory errors with fallback
      const fallbackModel = this.resolveOllamaFallbackModel(selectedModel);
      if (fallbackModel && this.isModelMemoryError(error)) {
        this.logger.warn(
          `Model ${selectedModel} failed with memory error, trying fallback: ${fallbackModel}`,
        );
        const fallbackProvider = this.registry.getProvider(fallbackModel);
        const fallbackConfig = { ...config, model: fallbackModel };
        const fallbackResponse = await fallbackProvider.generate(
          messages,
          fallbackConfig,
        );
        aiResponse = fallbackResponse.content;
        tokensUsed = fallbackResponse.tokensUsed;
        modelUsed = fallbackResponse.model;
      } else {
        throw error;
      }
    }

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

      if (chat && chat.title === 'Nueva conversación') {
        const newTitle = this.generateTitle(dto.content);
        if (newTitle && newTitle !== 'Nueva conversación') {
          await this.prisma.chat.update({
            where: { id: chatId! },
            data: { title: newTitle },
          });
        }
      }
    }

    return {
      conversationId: chatId !== 'anonymous' ? chatId : 'temp-chat-id',
      message: {
        id: assistantMessage?.id || 'temp-assistant-id',
        role: 'assistant',
        content: aiResponse,
        createdAt: assistantMessage?.createdAt || new Date(),
        tokensUsed,
      },
      remaining: canSend.remaining - 1,
      limit: canSend.limit,
      tier,
    };
  }

  async sendMessageStreaming(
    dto: SendMessageDto,
    userId: string | undefined,
    onChunk: (chunk: string) => void,
  ) {
    const canSend = await this.usageService.canSendMessage(
      userId,
      userId ? undefined : dto.anonymousId,
    );
    if (!canSend.allowed) {
      throw new ForbiddenException(
        `Has alcanzado tu límite de ${canSend.limit} mensajes por día.`,
      );
    }

    let tier: SubscriptionTier = SubscriptionTier.FREE;
    if (userId) {
      const subscription =
        await this.subscriptionsService.getOrCreateSubscription(userId);
      tier = subscription.tier;
    }
    const limits = this.subscriptionsService.getUserLimits(tier);

    let chatId = dto.conversationId;
    let chat: any = null;

    if (userId && !chatId) {
      chat = await this.prisma.chat.create({
        data: {
          ownerId: userId,
          title: this.generateTitle(dto.content),
          isAnonymous: false,
        },
      });
      chatId = chat.id;
    } else if (!userId) {
      chatId = 'anonymous';
    } else if (userId && chatId) {
      chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
      if (!chat) {
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

    if (userId && chatId !== 'anonymous') {
      await this.prisma.message.create({
        data: {
          chatId: chatId!,
          userId,
          role: MessageRole.USER,
          content: dto.content,
        },
      });
    }

    const history = userId ? await this.getChatHistory(chatId!) : [];
    const selectedModel = (dto.model || 'ollama').trim();
    const isPremiumRequested = ['gemini', 'openai', 'deepseek'].includes(
      selectedModel,
    );
    if (isPremiumRequested && tier !== SubscriptionTier.PREMIUM) {
      throw new ForbiddenException(
        'Este modelo es Premium. Actualiza tu suscripción para usarlo.',
      );
    }

    // Build messages array from history and current message
    const messages = this.buildMessages(dto.content, history);

    // Get provider from registry
    const provider = this.registry.getProvider(selectedModel);

    // Build provider config
    const config: AIProviderConfig = {
      model: selectedModel,
      maxTokens: limits.maxTokensPerMessage,
      temperature: 0.7,
      systemPrompt: 'Eres un asistente de IA útil y amigable.',
    };

    let fullContent = '';
    let modelUsed = selectedModel;

    // Handle streaming based on provider capabilities
    try {
      const stream = provider.generateStream(messages, config);

      for await (const chunk of stream) {
        if (!chunk || !chunk.content) continue;
        fullContent += chunk.content;
        onChunk(chunk.content);
        if (chunk.model) {
          modelUsed = chunk.model;
        }
      }
    } catch (error: any) {
      // Handle Ollama memory errors with fallback
      const fallbackModel = this.resolveOllamaFallbackModel(selectedModel);
      if (fallbackModel && this.isModelMemoryError(error)) {
        this.logger.warn(
          `Model ${selectedModel} failed with memory error in streaming, trying fallback: ${fallbackModel}`,
        );
        const fallbackProvider = this.registry.getProvider(fallbackModel);
        const fallbackConfig = { ...config, model: fallbackModel };

        // Fall back to non-streaming for simplicity
        const fallbackResponse = await fallbackProvider.generate(
          messages,
          fallbackConfig,
        );
        fullContent = fallbackResponse.content;
        onChunk(fullContent);
        modelUsed = fallbackResponse.model;
      } else {
        throw error;
      }
    }

    const tokensUsed = Math.ceil((fullContent || '').length / 4);
    let assistantMessage;
    if (userId && chatId !== 'anonymous') {
      assistantMessage = await this.prisma.message.create({
        data: {
          chatId: chatId!,
          userId,
          role: MessageRole.ASSISTANT,
          content: fullContent,
          tokensUsed,
          model: modelUsed,
        },
      });

      if (chat && chat.title === 'Nueva conversación') {
        const newTitle = this.generateTitle(dto.content);
        if (newTitle && newTitle !== 'Nueva conversación') {
          await this.prisma.chat.update({
            where: { id: chatId! },
            data: { title: newTitle },
          });
        }
      }
    }

    return {
      conversationId: chatId !== 'anonymous' ? chatId : 'temp-chat-id',
      message: {
        id: assistantMessage?.id || 'temp-assistant-id',
        role: 'assistant',
        content: fullContent,
        createdAt: assistantMessage?.createdAt || new Date(),
        tokensUsed,
      },
      remaining: canSend.remaining - 1,
      limit: canSend.limit,
      tier,
    };
  }

  async createChat(ownerId?: string, title?: string): Promise<any> {
    return this.prisma.chat.create({
      data: {
        title: title || 'Nueva conversación',
        isAnonymous: !ownerId,
        ownerId,
      },
    });
  }

  async listChats(ownerId?: string): Promise<any[]> {
    if (!ownerId) return [];
    return this.prisma.chat.findMany({
      where: { ownerId },
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

  async renameChat(
    chatId: string,
    title: string,
    userId: string,
  ): Promise<void> {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, ownerId: userId },
    });
    if (!chat) {
      throw new NotFoundException('Chat no encontrado o sin permisos');
    }
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { title, updatedAt: new Date() },
    });
  }

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, ownerId: userId },
    });
    if (!chat) {
      throw new NotFoundException('Chat no encontrado');
    }
    await this.prisma.chat.delete({ where: { id: chatId } });
    return { message: 'Chat eliminado' };
  }

  async getChat(chatId: string, userId: string) {
    const exists = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, ownerId: true },
    });

    if (!exists) {
      throw new NotFoundException({
        message: 'Chat no encontrado',
        errorCode: 'CHAT_NOT_FOUND',
      } as any);
    }
    if (exists.ownerId !== userId) {
      throw new NotFoundException({
        message: 'Chat no pertenece al usuario autenticado',
        errorCode: 'CHAT_NOT_FOUND_FOR_USER',
      } as any);
    }

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!chat) {
      throw new NotFoundException({
        message: 'Chat no encontrado',
        errorCode: 'CHAT_NOT_FOUND',
      } as any);
    }
    return chat;
  }

  async getChatHistory(chatId: string, limit: number = 20) {
    try {
      // Obtener los últimos N mensajes (más recientes) para mantener contexto relevante
      // sin exceder los límites de tokens del modelo
      const messages = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'desc' }, // Más recientes primero
        take: limit,
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      });

      // Invertir para que queden en orden cronológico (ascendente)
      // ya que los modelos esperan el historial en orden
      return messages.reverse().map((msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
    } catch (error) {
      this.logger.error(`Error obteniendo historial para chat ${chatId}:`, error);
      return [];
    }
  }

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

  async updateFirstMessageAndTitle(
    chatId: string,
    userId: string,
    newContent: string,
  ) {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, ownerId: userId },
    });
    if (!chat) {
      throw new ForbiddenException('No tienes acceso a este chat');
    }

    const firstUserMessage = await this.prisma.message.findFirst({
      where: { chatId, userId, role: MessageRole.USER },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstUserMessage) {
      throw new BadRequestException(
        'No hay mensaje de usuario para actualizar',
      );
    }

    await this.prisma.message.update({
      where: { id: firstUserMessage.id },
      data: { content: newContent },
    });

    const newTitle = this.generateTitle(newContent);
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { title: newTitle },
    });

    return {
      success: true,
      data: { title: newTitle },
      message: 'Mensaje y título actualizados',
    };
  }

  private generateTitle(content: string): string {
    const cleanContent = content.trim().replace(/\n/g, ' ');
    if (cleanContent.length <= 50) return cleanContent;
    return cleanContent.substring(0, 47) + '...';
  }

  private resolveOllamaFallbackModel(
    currentModel?: string,
  ): string | undefined {
    const normalize = (value?: string) => {
      if (!value) return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed.startsWith('ollama-')
        ? trimmed.replace('ollama-', '')
        : trimmed;
    };

    const firstFrom = (raw?: string) =>
      normalize(
        raw
          ?.split(',')
          .map((m) => m.trim())
          .filter(Boolean)[0],
      );

    const candidates = [
      normalize(process.env.OLLAMA_FALLBACK_MODEL),
      firstFrom(process.env.PUBLIC_MODELS),
      firstFrom(process.env.PRO_MODELS),
    ].filter(Boolean) as string[];

    const normalizedCurrent = normalize(currentModel);
    return candidates.find((candidate) => candidate !== normalizedCurrent);
  }

  private isModelMemoryError(error: any): boolean {
    const text = [
      error?.message,
      error?.response,
      error?.cause?.message,
      error?.cause?.response,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      text.includes('requires more system memory') ||
      text.includes('out of memory')
    );
  }

  /**
   * Build an array of AIMessage from history and current content.
   * This converts the internal message format to the standardized AI provider format.
   */
  private buildMessages(
    content: string,
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): AIMessage[] {
    const messages: AIMessage[] = [];

    // Add history messages
    for (const msg of history) {
      messages.push({
        role: msg.role as AIMessageRole,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: AIMessageRole.USER,
      content,
    });

    return messages;
  }
}
