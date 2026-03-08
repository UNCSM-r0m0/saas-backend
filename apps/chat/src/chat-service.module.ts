import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../src/prisma/prisma.module';
import { SubscriptionsModule } from '../../../src/subscriptions/subscriptions.module';
import { OllamaModule } from '../../../src/ollama/ollama.module';
import { GeminiModule } from '../../../src/gemini/gemini.module';
import { OpenAIModule } from '../../../src/openai/openai.module';
import { DeepSeekModule } from '../../../src/deepseek/deepseek.module';
import { ChatService } from '../../../src/chat/chat.service';
import { UsageService } from '../../../src/usage/usage.service';
import { ChatNatsController } from './chat-nats.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SubscriptionsModule,
    OllamaModule,
    GeminiModule,
    OpenAIModule,
    DeepSeekModule,
  ],
  controllers: [ChatNatsController],
  providers: [ChatService, UsageService],
})
export class ChatServiceModule {}
