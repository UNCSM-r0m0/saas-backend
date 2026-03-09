import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatService } from '../../../src/chat/chat.service';
import { CHAT_EVENTS, CHAT_PATTERNS } from 'libs/contracts/chat';
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
import { ChatEventsPublisher } from './chat-events.publisher';

@Controller()
export class ChatNatsController {
  constructor(
    private readonly chatService: ChatService,
    private readonly eventsPublisher: ChatEventsPublisher,
  ) {}

  @MessagePattern(CHAT_PATTERNS.health)
  health() {
    return { service: 'chat', status: 'ok' };
  }

  @MessagePattern(CHAT_PATTERNS.sendMessage)
  async sendMessage(@Payload() payload: ChatSendMessagePayload) {
    const result = await this.chatService.sendMessage(
      payload.dto,
      payload.userId,
    );

    try {
      this.eventsPublisher.emitMessageCreated({
        conversationId: result.conversationId || 'unknown',
        messageId: result.message?.id || 'unknown',
        userId: payload.userId,
        model: payload.dto?.model,
        tokensUsed: result.message?.tokensUsed,
        createdAt: new Date().toISOString(),
      });
      this.eventsPublisher.emitUsageIncremented({
        conversationId: result.conversationId,
        userId: payload.userId,
        anonymousId: payload.dto?.anonymousId,
        tokensUsed: result.message?.tokensUsed ?? 0,
        at: new Date().toISOString(),
      });
      this.eventsPublisher.emitStreamFinished({
        conversationId: result.conversationId || 'unknown',
        userId: payload.userId,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.messageCreated, error);
    }

    return result;
  }

  @MessagePattern(CHAT_PATTERNS.createChat)
  async createChat(@Payload() payload: ChatCreatePayload) {
    const chat = await this.chatService.createChat(
      payload.userId,
      payload.title,
    );
    try {
      this.eventsPublisher.emitSessionCreated({
        chatId: chat.id,
        ownerId: payload.userId,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.chatCreated, error);
    }
    return chat;
  }

  @MessagePattern(CHAT_PATTERNS.listChats)
  async listChats(@Payload() payload: ChatListPayload) {
    return this.chatService.listChats(payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.renameChat)
  async renameChat(@Payload() payload: ChatRenamePayload) {
    return this.chatService.renameChat(
      payload.chatId,
      payload.title,
      payload.userId,
    );
  }

  @MessagePattern(CHAT_PATTERNS.deleteChat)
  async deleteChat(@Payload() payload: ChatDeletePayload) {
    const result = await this.chatService.deleteChat(
      payload.chatId,
      payload.userId,
    );
    try {
      this.eventsPublisher.emitSessionDeleted({
        chatId: payload.chatId,
        ownerId: payload.userId,
        deletedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.eventsPublisher.logEmitError(CHAT_EVENTS.chatDeleted, error);
    }
    return result;
  }

  @MessagePattern(CHAT_PATTERNS.getChat)
  async getChat(@Payload() payload: ChatGetPayload) {
    return this.chatService.getChat(payload.chatId, payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.getChatHistory)
  async getChatHistory(@Payload() payload: ChatHistoryPayload) {
    return this.chatService.getChatHistory(payload.chatId);
  }

  @MessagePattern(CHAT_PATTERNS.getUsageStats)
  async getUsageStats(@Payload() payload: ChatUsageStatsPayload) {
    return this.chatService.getUserUsageStats(payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.updateFirstMessage)
  async updateFirstMessage(@Payload() payload: ChatUpdateFirstMessagePayload) {
    return this.chatService.updateFirstMessageAndTitle(
      payload.chatId,
      payload.userId,
      payload.content,
    );
  }
}
