import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrismaModule } from 'libs/platform/prisma';
import { SubscriptionsModule } from '../../../src/subscriptions/subscriptions.module';
import { OllamaModule } from '../../../src/ollama/ollama.module';
import { GeminiModule } from '../../../src/gemini/gemini.module';
import { OpenAIModule } from '../../../src/openai/openai.module';
import { DeepSeekModule } from '../../../src/deepseek/deepseek.module';
import { UsageService } from '../../../src/usage/usage.service';
import { ChatNatsController } from './chat-nats.controller';
import { ChatEventsPublisher } from './chat-events.publisher';
import { ChatDomainService } from './chat-domain.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
      {
        name: 'CHAT_EVENTS_NATS',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
    PrismaModule,
    SubscriptionsModule,
    OllamaModule,
    GeminiModule,
    OpenAIModule,
    DeepSeekModule,
  ],
  controllers: [ChatNatsController],
  providers: [ChatDomainService, UsageService, ChatEventsPublisher],
})
export class ChatServiceModule {}
