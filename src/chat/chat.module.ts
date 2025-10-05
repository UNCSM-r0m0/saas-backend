import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsageService } from '../usage/usage.service';

@Module({
  providers: [ChatService, UsageService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule { }
