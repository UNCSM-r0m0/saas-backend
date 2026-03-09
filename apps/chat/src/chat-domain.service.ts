import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MessageRole, SubscriptionTier } from '@prisma/client';
import { PrismaService } from 'libs/platform/prisma';
import { OllamaService } from '../../../src/ollama/ollama.service';
import { GeminiService } from '../../../src/gemini/gemini.service';
import { OpenAIService } from '../../../src/openai/openai.service';
import { DeepSeekService } from '../../../src/deepseek/deepseek.service';
import { SubscriptionsService } from '../../../src/subscriptions/subscriptions.service';
import { UsageService } from '../../../src/usage/usage.service';
import type { ChatSendMessageDto as SendMessageDto } from 'libs/contracts/chat';

@Injectable()
export class ChatDomainService {
  private readonly logger = new Logger(ChatDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaService: OllamaService,
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService,
    private readonly deepseekService: DeepSeekService,
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

    let aiResponse = '';
    let tokensUsed = 0;
    let modelUsed = '';

    if (selectedModel === 'gemini') {
      const geminiResponse = await this.geminiService.generateResponse(
        dto.content,
        {
          maxTokens: limits.maxTokensPerMessage,
          temperature: 0.7,
          systemPrompt: 'Eres un asistente de IA útil y amigable.',
        },
      );
      aiResponse = geminiResponse.response;
      tokensUsed = geminiResponse.tokensUsed;
      modelUsed = geminiResponse.model;
    } else if (selectedModel === 'openai') {
      const openaiResponse = await this.openaiService.generateResponse(
        dto.content,
        {
          maxTokens: limits.maxTokensPerMessage,
          temperature: 0.7,
          systemPrompt: 'Eres un asistente de IA útil y amigable.',
        },
      );
      aiResponse = openaiResponse.response;
      tokensUsed = openaiResponse.tokensUsed;
      modelUsed = openaiResponse.model;
    } else if (selectedModel === 'deepseek') {
      const deepseekResponse = await this.deepseekService.generateResponse(
        dto.content,
        {
          maxTokens: limits.maxTokensPerMessage,
          temperature: 0.7,
          systemPrompt: 'Eres un asistente de IA útil y amigable.',
          model: 'deepseek-chat',
        },
      );
      aiResponse = deepseekResponse.response;
      tokensUsed = deepseekResponse.tokensUsed;
      modelUsed = deepseekResponse.model;
    } else {
      const ollamaMessages = [
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        { role: 'user' as const, content: dto.content },
      ];

      let ollamaModel: string | undefined = selectedModel;
      if (selectedModel.startsWith('ollama-')) {
        ollamaModel = selectedModel.replace('ollama-', '');
      } else if (selectedModel === 'ollama') {
        ollamaModel = undefined;
      }

      try {
        const ollamaResponse = await this.ollamaService.generate(
          ollamaMessages,
          limits.maxTokensPerMessage,
          ollamaModel,
        );
        aiResponse = ollamaResponse.content;
        tokensUsed = ollamaResponse.tokensUsed;
        modelUsed = ollamaModel || 'ollama-default';
      } catch (error: any) {
        const fallbackModel = this.resolveOllamaFallbackModel(ollamaModel);
        if (!fallbackModel || !this.isModelMemoryError(error)) {
          throw error;
        }

        const fallbackResponse = await this.ollamaService.generate(
          ollamaMessages,
          limits.maxTokensPerMessage,
          fallbackModel,
        );
        aiResponse = fallbackResponse.content;
        tokensUsed = fallbackResponse.tokensUsed;
        modelUsed = fallbackModel;
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

    let fullContent = '';
    let modelUsed = selectedModel;

    if (selectedModel === 'gemini') {
      const stream = await this.geminiService.generateStreamingResponse(
        dto.content,
        {
          maxTokens: limits.maxTokensPerMessage,
          temperature: 0.7,
          systemPrompt: 'Eres un asistente de IA útil y amigable.',
        },
      );
      for await (const chunk of stream) {
        if (!chunk) continue;
        fullContent += chunk;
        onChunk(chunk);
      }
      modelUsed = 'gemini-2.0-flash-exp';
    } else if (selectedModel === 'openai') {
      const stream = await this.openaiService.generateStreamingResponse(
        dto.content,
        {
          maxTokens: limits.maxTokensPerMessage,
          temperature: 0.7,
          systemPrompt: 'Eres un asistente de IA útil y amigable.',
        },
      );
      for await (const chunk of stream) {
        if (!chunk) continue;
        fullContent += chunk;
        onChunk(chunk);
      }
      modelUsed = 'openai';
    } else if (selectedModel === 'deepseek') {
      const result = await this.deepseekService.generateResponse(dto.content, {
        maxTokens: limits.maxTokensPerMessage,
        temperature: 0.7,
        systemPrompt: 'Eres un asistente de IA útil y amigable.',
        model: 'deepseek-chat',
      });
      fullContent = result.response;
      if (fullContent) onChunk(fullContent);
      modelUsed = result.model;
    } else {
      const ollamaMessages = [
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        { role: 'user' as const, content: dto.content },
      ];

      let ollamaModel: string | undefined = selectedModel;
      if (selectedModel.startsWith('ollama-')) {
        ollamaModel = selectedModel.replace('ollama-', '');
      } else if (selectedModel === 'ollama') {
        ollamaModel = undefined;
      }

      const makeR1Processor = () => {
        let inThink = false;
        return (chunk: string) => {
          let i = 0;
          let resp = '';
          const startTag = '<think>';
          const endTag = '</think>';
          while (i < chunk.length) {
            if (!inThink) {
              const j = chunk.indexOf(startTag, i);
              if (j === -1) {
                resp += chunk.slice(i);
                break;
              }
              resp += chunk.slice(i, j);
              i = j + startTag.length;
              inThink = true;
            } else {
              const k = chunk.indexOf(endTag, i);
              if (k === -1) {
                break;
              }
              i = k + endTag.length;
              inThink = false;
            }
          }
          return resp;
        };
      };

      const processR1 = makeR1Processor();

      try {
        const stream = this.ollamaService.generateStream(
          ollamaMessages,
          ollamaModel,
          limits.maxTokensPerMessage,
        );
        for await (const part of stream) {
          const piece = typeof part === 'string' ? part : (part?.content ?? '');
          if (!piece) continue;
          const cleaned = processR1(piece);
          if (!cleaned) continue;
          fullContent += cleaned;
          onChunk(cleaned);
        }
      } catch (error: any) {
        const fallbackModel = this.resolveOllamaFallbackModel(ollamaModel);
        if (!fallbackModel || !this.isModelMemoryError(error)) {
          throw error;
        }
        const fallbackResponse = await this.ollamaService.generate(
          ollamaMessages,
          limits.maxTokensPerMessage,
          fallbackModel,
        );
        fullContent = fallbackResponse.content;
        if (fullContent) onChunk(fullContent);
        modelUsed = fallbackModel;
      }

      if (!modelUsed || modelUsed === 'ollama') {
        modelUsed = ollamaModel || 'ollama-default';
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

  async getChatHistory(chatId: string) {
    try {
      const messages = await this.prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          role: true,
          content: true,
        },
      });

      return messages.map((msg) => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));
    } catch {
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
}
