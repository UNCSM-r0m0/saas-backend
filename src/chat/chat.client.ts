import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CHAT_PATTERNS } from 'libs/contracts/chat';

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

  sendMessage(dto: any, userId?: string) {
    return this.send(CHAT_PATTERNS.sendMessage, { dto, userId });
  }

  createChat(userId?: string, title?: string) {
    return this.send(CHAT_PATTERNS.createChat, { userId, title });
  }

  listChats(userId: string) {
    return this.send(CHAT_PATTERNS.listChats, { userId });
  }

  renameChat(chatId: string, title: string, userId: string) {
    return this.send(CHAT_PATTERNS.renameChat, { chatId, title, userId });
  }

  deleteChat(chatId: string, userId: string) {
    return this.send(CHAT_PATTERNS.deleteChat, { chatId, userId });
  }

  getChat(chatId: string, userId: string) {
    return this.send(CHAT_PATTERNS.getChat, { chatId, userId });
  }

  getChatHistory(chatId: string) {
    return this.send(CHAT_PATTERNS.getChatHistory, { chatId });
  }

  getUsageStats(userId: string) {
    return this.send(CHAT_PATTERNS.getUsageStats, { userId });
  }

  updateFirstMessage(chatId: string, userId: string, content: string) {
    return this.send(CHAT_PATTERNS.updateFirstMessage, {
      chatId,
      userId,
      content,
    });
  }
}
