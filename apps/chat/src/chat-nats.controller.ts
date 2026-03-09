import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatDomainService } from './chat-domain.service';
import { CHAT_EVENTS, CHAT_PATTERNS } from 'libs/contracts/chat';
import type {
  ChatCreatePayload,
  ChatDeletePayload,
  ChatGetPayload,
  ChatHistoryPayload,
  ChatListPayload,
  ChatRenamePayload,
  ChatResponseEnvelopeV1,
  ChatSendMessageResponseV1,
  ChatSendMessagePayload,
  ChatUpdateFirstMessagePayload,
  ChatUsageStatsPayload,
} from 'libs/contracts/chat';
import { ChatEventsPublisher } from './chat-events.publisher';

@Controller()
export class ChatNatsController {
  private readonly logger = new Logger(ChatNatsController.name);
  private readonly streamBatchIntervalMs = this.readNumberFromEnv(
    'CHAT_STREAM_BATCH_MS',
    120,
  );
  private readonly streamBatchTargetChars = this.readNumberFromEnv(
    'CHAT_STREAM_BATCH_TARGET_CHARS',
    220,
  );
  private readonly streamBatchMinChars = this.readNumberFromEnv(
    'CHAT_STREAM_BATCH_MIN_CHARS',
    32,
  );

  constructor(
    private readonly chatService: ChatDomainService,
    private readonly eventsPublisher: ChatEventsPublisher,
  ) {}

  private readNumberFromEnv(key: string, fallback: number): number {
    const raw = process.env[key];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.floor(value);
  }

  @MessagePattern(CHAT_PATTERNS.health)
  health() {
    return this.v1({ service: 'chat', status: 'ok' });
  }

  private v1<T>(data: T): ChatResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

  @MessagePattern(CHAT_PATTERNS.sendMessage)
  async sendMessage(@Payload() payload: ChatSendMessagePayload) {
    const streamId = payload.streamId;
    const messageId = payload.messageId || 'unknown';
    const correlationId = payload.correlationId;
    const requestedChatId =
      payload.dto?.conversationId || payload.dto?.anonymousId || 'temp-chat-id';

    if (streamId) {
      this.eventsPublisher.emitStreamStarted({
        correlationId,
        streamId,
        chatId: requestedChatId,
        messageId,
        userId: payload.userId,
        startedAt: new Date().toISOString(),
      });
    }

    let result: ChatSendMessageResponseV1;
    let emittedChunks = 0;
    try {
      if (streamId) {
        let seq = 0;
        let pendingBuffer = '';
        const flushBuffer = (force = false) => {
          if (!pendingBuffer) return;
          if (!force && pendingBuffer.length < this.streamBatchMinChars) return;
          seq += 1;
          emittedChunks += 1;
          this.eventsPublisher.emitStreamChunk({
            streamId,
            chatId: requestedChatId,
            conversationId: requestedChatId,
            messageId,
            seq,
            content: pendingBuffer,
            contentType: 'markdown',
            timestamp: new Date().toISOString(),
          });
          pendingBuffer = '';
        };

        const flushTimer = setInterval(
          () => flushBuffer(false),
          this.streamBatchIntervalMs,
        );
        let raw: any;
        try {
          raw = await this.chatService.sendMessageStreaming(
            payload.dto,
            payload.userId,
            (content) => {
              if (!content) return;
              pendingBuffer += content;

              if (pendingBuffer.length < this.streamBatchTargetChars) return;
              seq += 1;
              emittedChunks += 1;
              this.eventsPublisher.emitStreamChunk({
                correlationId,
                streamId,
                chatId: requestedChatId,
                conversationId: requestedChatId,
                messageId,
                seq,
                content: pendingBuffer,
                contentType: 'markdown',
                timestamp: new Date().toISOString(),
              });
              pendingBuffer = '';
            },
          );
        } finally {
          clearInterval(flushTimer);
          flushBuffer(true);
        }

        result = {
          ...raw,
          conversationId: String(raw?.conversationId || requestedChatId),
        };
      } else {
        const raw = (await this.chatService.sendMessage(
          payload.dto,
          payload.userId,
        )) as any;
        result = {
          ...raw,
          conversationId: String(raw?.conversationId || requestedChatId),
        };
      }
    } catch (error: any) {
      if (streamId) {
        this.eventsPublisher.emitStreamError({
          correlationId,
          streamId,
          chatId: requestedChatId,
          messageId,
          code: 'STREAM_ERROR',
          message: error?.message || 'Error interno del stream',
          at: new Date().toISOString(),
        });
      }
      throw error;
    }

    const finalChatId = String(result?.conversationId || requestedChatId);
    const fullContent = String(result?.message?.content || '');

    if (streamId && fullContent) {
      const totalChunks = Math.max(1, emittedChunks);
      this.eventsPublisher.emitStreamFinished({
        correlationId,
        streamId,
        chatId: requestedChatId,
        conversationId: finalChatId,
        messageId,
        userId: payload.userId,
        totalChunks,
        fullContent,
        finishedAt: new Date().toISOString(),
      });
    }

    try {
      this.eventsPublisher.emitMessageCreated({
        correlationId,
        conversationId: result.conversationId || 'unknown',
        messageId: result.message?.id || 'unknown',
        userId: payload.userId,
        model: payload.dto?.model,
        tokensUsed: result.message?.tokensUsed,
        createdAt: new Date().toISOString(),
      });
      this.eventsPublisher.emitUsageIncremented({
        correlationId,
        conversationId: result.conversationId,
        userId: payload.userId,
        anonymousId: payload.dto?.anonymousId,
        tokensUsed: result.message?.tokensUsed ?? 0,
        at: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.messageCreated, error);
    }

    this.logger.debug(
      `chat.sendMessage completado correlationId=${correlationId || 'n/a'} conversationId=${result.conversationId}`,
    );

    return this.v1(result);
  }

  @MessagePattern(CHAT_PATTERNS.createChat)
  async createChat(@Payload() payload: ChatCreatePayload) {
    const chat = await this.chatService.createChat(
      payload.userId,
      payload.title,
    );
    try {
      this.eventsPublisher.emitSessionCreated({
        correlationId: undefined,
        chatId: chat.id,
        ownerId: payload.userId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.chatCreated, error);
    }
    return this.v1(chat);
  }

  @MessagePattern(CHAT_PATTERNS.listChats)
  async listChats(@Payload() payload: ChatListPayload) {
    return this.v1(await this.chatService.listChats(payload.userId));
  }

  @MessagePattern(CHAT_PATTERNS.renameChat)
  async renameChat(@Payload() payload: ChatRenamePayload) {
    const result = await this.chatService.renameChat(
      payload.chatId,
      payload.title,
      payload.userId,
    );
    return this.v1(result ?? { success: true });
  }

  @MessagePattern(CHAT_PATTERNS.deleteChat)
  async deleteChat(@Payload() payload: ChatDeletePayload) {
    const result = await this.chatService.deleteChat(
      payload.chatId,
      payload.userId,
    );
    try {
      this.eventsPublisher.emitSessionDeleted({
        correlationId: undefined,
        chatId: payload.chatId,
        ownerId: payload.userId,
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.chatDeleted, error);
    }
    return this.v1(result);
  }

  @MessagePattern(CHAT_PATTERNS.getChat)
  async getChat(@Payload() payload: ChatGetPayload) {
    return this.v1(
      await this.chatService.getChat(payload.chatId, payload.userId),
    );
  }

  @MessagePattern(CHAT_PATTERNS.getChatHistory)
  async getChatHistory(@Payload() payload: ChatHistoryPayload) {
    return this.v1(await this.chatService.getChatHistory(payload.chatId));
  }

  @MessagePattern(CHAT_PATTERNS.getUsageStats)
  async getUsageStats(@Payload() payload: ChatUsageStatsPayload) {
    return this.v1(await this.chatService.getUserUsageStats(payload.userId));
  }

  @MessagePattern(CHAT_PATTERNS.updateFirstMessage)
  async updateFirstMessage(@Payload() payload: ChatUpdateFirstMessagePayload) {
    return this.v1(
      await this.chatService.updateFirstMessageAndTitle(
        payload.chatId,
        payload.userId,
        payload.content,
      ),
    );
  }
}
