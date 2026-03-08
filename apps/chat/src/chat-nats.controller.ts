import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatService } from '../../../src/chat/chat.service';
import { SendMessageDto } from '../../../src/chat/dto/send-message.dto';
import { CHAT_PATTERNS } from 'libs/contracts/chat';

@Controller()
export class ChatNatsController {
  constructor(private readonly chatService: ChatService) {}

  @MessagePattern(CHAT_PATTERNS.health)
  health() {
    return { service: 'chat', status: 'ok' };
  }

  @MessagePattern(CHAT_PATTERNS.sendMessage)
  async sendMessage(
    @Payload()
    payload: {
      dto: SendMessageDto;
      userId?: string;
    },
  ) {
    return this.chatService.sendMessage(payload.dto, payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.createChat)
  async createChat(@Payload() payload: { userId?: string; title?: string }) {
    return this.chatService.createChat(payload.userId, payload.title);
  }

  @MessagePattern(CHAT_PATTERNS.listChats)
  async listChats(@Payload() payload: { userId: string }) {
    return this.chatService.listChats(payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.renameChat)
  async renameChat(
    @Payload() payload: { chatId: string; title: string; userId: string },
  ) {
    return this.chatService.renameChat(
      payload.chatId,
      payload.title,
      payload.userId,
    );
  }

  @MessagePattern(CHAT_PATTERNS.deleteChat)
  async deleteChat(@Payload() payload: { chatId: string; userId: string }) {
    return this.chatService.deleteChat(payload.chatId, payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.getChat)
  async getChat(@Payload() payload: { chatId: string; userId: string }) {
    return this.chatService.getChat(payload.chatId, payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.getChatHistory)
  async getChatHistory(@Payload() payload: { chatId: string }) {
    return this.chatService.getChatHistory(payload.chatId);
  }

  @MessagePattern(CHAT_PATTERNS.getUsageStats)
  async getUsageStats(@Payload() payload: { userId: string }) {
    return this.chatService.getUserUsageStats(payload.userId);
  }

  @MessagePattern(CHAT_PATTERNS.updateFirstMessage)
  async updateFirstMessage(
    @Payload() payload: { chatId: string; userId: string; content: string },
  ) {
    return this.chatService.updateFirstMessageAndTitle(
      payload.chatId,
      payload.userId,
      payload.content,
    );
  }
}
