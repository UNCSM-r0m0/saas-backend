import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { UsageService } from '../usage/usage.service';
import { OllamaModule } from '../ollama/ollama.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [OllamaModule, GeminiModule],
  providers: [ChatService, UsageService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule { }
