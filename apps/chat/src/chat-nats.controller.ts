import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ChatService } from '../../../src/chat/chat.service';
import { SendMessageDto } from '../../../src/chat/dto/send-message.dto';

@Controller()
export class ChatNatsController {
  constructor(private readonly chatService: ChatService) {}

  @MessagePattern('chat.health')
  health() {
    return { service: 'chat', status: 'ok' };
  }

  @MessagePattern('chat.sendMessage')
  async sendMessage(
    @Payload()
    payload: {
      dto: SendMessageDto;
      userId?: string;
    },
  ) {
    return this.chatService.sendMessage(payload.dto, payload.userId);
  }
}
