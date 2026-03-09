import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CHAT_PATTERNS } from 'libs/contracts/chat';
import type {
  ChatCreatePayload,
  ChatDeletePayload,
  ChatGetPayload,
  ChatHistoryPayload,
  ChatListPayload,
  ChatRenamePayload,
  ChatSendMessagePayload,
  ChatUpdateFirstMessagePayload,
  ChatUsageStatsPayload,
} from 'libs/contracts/chat';

@Injectable()
export class ChatClient {
  private readonly logger = new Logger(ChatClient.name);

  constructor(@Inject('CHAT_NATS') private readonly client: ClientProxy) {}

  private async send<T>(pattern: string, payload?: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.client.send<T>(pattern, payload ?? {}));
    } catch (error: any) {
      const statusCode =
        error?.statusCode ?? error?.response?.statusCode ?? 500;
      const message = error?.message ?? 'Chat service error';
      this.logger.error(`Chat NATS error: ${message}`);
      throw new HttpException(message, statusCode);
    }
  }

  sendMessage(dto: ChatSendMessagePayload['dto'], userId?: string) {
    const payload: ChatSendMessagePayload = { dto, userId };
    return this.send(CHAT_PATTERNS.sendMessage, payload);
  }

  createChat(userId?: string, title?: string) {
    const payload: ChatCreatePayload = { userId, title };
    return this.send(CHAT_PATTERNS.createChat, payload);
  }

  listChats(userId: string) {
    const payload: ChatListPayload = { userId };
    return this.send(CHAT_PATTERNS.listChats, payload);
  }

  renameChat(chatId: string, title: string, userId: string) {
    const payload: ChatRenamePayload = { chatId, title, userId };
    return this.send(CHAT_PATTERNS.renameChat, payload);
  }

  deleteChat(chatId: string, userId: string) {
    const payload: ChatDeletePayload = { chatId, userId };
    return this.send(CHAT_PATTERNS.deleteChat, payload);
  }

  getChat(chatId: string, userId: string) {
    const payload: ChatGetPayload = { chatId, userId };
    return this.send(CHAT_PATTERNS.getChat, payload);
  }

  getChatHistory(chatId: string) {
    const payload: ChatHistoryPayload = { chatId };
    return this.send(CHAT_PATTERNS.getChatHistory, payload);
  }

  getUsageStats(userId: string) {
    const payload: ChatUsageStatsPayload = { userId };
    return this.send(CHAT_PATTERNS.getUsageStats, payload);
  }

  updateFirstMessage(chatId: string, userId: string, content: string) {
    const payload: ChatUpdateFirstMessagePayload = {
      chatId,
      userId,
      content,
    };
    return this.send(CHAT_PATTERNS.updateFirstMessage, payload);
  }
}
