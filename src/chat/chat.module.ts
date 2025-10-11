import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { UsageService } from '../usage/usage.service';
import { OllamaModule } from '../ollama/ollama.module';
import { GeminiModule } from '../gemini/gemini.module';
import { OpenAIModule } from '../openai/openai.module';
import { DeepSeekModule } from '../deepseek/deepseek.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [OllamaModule, GeminiModule, OpenAIModule, DeepSeekModule, AuthModule],
  providers: [ChatService, ChatGateway, UsageService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule { }
