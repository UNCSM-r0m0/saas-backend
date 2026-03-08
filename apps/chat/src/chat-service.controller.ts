import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class ChatServiceController {
  @MessagePattern('chat.health')
  health() {
    return { service: 'chat', status: 'ok' };
  }
}
