import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CHAT_PATTERNS } from 'libs/contracts/chat';
import type {
  ChatCreatePayload,
  ChatDeletePayload,
  ChatGetPayload,
  ChatHistoryEntryV1,
  ChatHistoryPayload,
  ChatListPayload,
  ChatRenamePayload,
  ChatResponseEnvelopeV1,
  ChatSendMessageResponseV1,
  ChatSendMessagePayload,
  ChatSessionV1,
  ChatUpdateFirstMessageResponseV1,
  ChatUpdateFirstMessagePayload,
  ChatUsageStatsResponseV1,
  ChatUsageStatsPayload,
} from 'libs/contracts/chat';

@Injectable()
export class ChatClient {
  private readonly logger = new Logger(ChatClient.name);

  constructor(@Inject('CHAT_NATS') private readonly client: ClientProxy) {}

  private unwrapV1<T>(response: T | ChatResponseEnvelopeV1<T>): T {
    if (
      response &&
      typeof response === 'object' &&
      'version' in (response as any) &&
      (response as any).version === 'v1' &&
      'data' in (response as any)
    ) {
      return (response as any).data as T;
    }
    return response as T;
  }

  private async send<T>(pattern: string, payload?: unknown): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.client.send<T | ChatResponseEnvelopeV1<T>>(pattern, payload ?? {}),
      );
      return this.unwrapV1<T>(raw);
    } catch (error: any) {
      const statusCode =
        error?.statusCode ?? error?.response?.statusCode ?? 500;
      const message = error?.message ?? 'Chat service error';
      this.logger.error(`Chat NATS error: ${message}`);
      throw new HttpException(message, statusCode);
    }
  }

  sendMessage(
    dto: ChatSendMessagePayload['dto'],
    userId?: string,
    streamId?: string,
    messageId?: string,
  ): Promise<ChatSendMessageResponseV1> {
    const payload: ChatSendMessagePayload = {
      dto,
      userId,
      streamId,
      messageId,
    };
    return this.send<ChatSendMessageResponseV1>(
      CHAT_PATTERNS.sendMessage,
      payload,
    );
  }

  createChat(userId?: string, title?: string): Promise<ChatSessionV1> {
    const payload: ChatCreatePayload = { userId, title };
    return this.send<ChatSessionV1>(CHAT_PATTERNS.createChat, payload);
  }

  listChats(userId: string): Promise<ChatSessionV1[]> {
    const payload: ChatListPayload = { userId };
    return this.send<ChatSessionV1[]>(CHAT_PATTERNS.listChats, payload);
  }

  renameChat(chatId: string, title: string, userId: string) {
    const payload: ChatRenamePayload = { chatId, title, userId };
    return this.send(CHAT_PATTERNS.renameChat, payload);
  }

  deleteChat(chatId: string, userId: string) {
    const payload: ChatDeletePayload = { chatId, userId };
    return this.send(CHAT_PATTERNS.deleteChat, payload);
  }

  getChat(chatId: string, userId: string): Promise<any> {
    const payload: ChatGetPayload = { chatId, userId };
    return this.send<any>(CHAT_PATTERNS.getChat, payload);
  }

  getChatHistory(chatId: string): Promise<ChatHistoryEntryV1[]> {
    const payload: ChatHistoryPayload = { chatId };
    return this.send<ChatHistoryEntryV1[]>(
      CHAT_PATTERNS.getChatHistory,
      payload,
    );
  }

  getUsageStats(userId: string): Promise<ChatUsageStatsResponseV1> {
    const payload: ChatUsageStatsPayload = { userId };
    return this.send<ChatUsageStatsResponseV1>(
      CHAT_PATTERNS.getUsageStats,
      payload,
    );
  }

  updateFirstMessage(
    chatId: string,
    userId: string,
    content: string,
  ): Promise<ChatUpdateFirstMessageResponseV1> {
    const payload: ChatUpdateFirstMessagePayload = {
      chatId,
      userId,
      content,
    };
    return this.send<ChatUpdateFirstMessageResponseV1>(
      CHAT_PATTERNS.updateFirstMessage,
      payload,
    );
  }
}
