import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatClient } from './chat.client';
import { UsageService } from '../usage/usage.service';
import { WsModule } from '../common/ws/ws.module';
import { OllamaModule } from '../ollama/ollama.module';
import { GeminiModule } from '../gemini/gemini.module';
import { OpenAIModule } from '../openai/openai.module';
import { DeepSeekModule } from '../deepseek/deepseek.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CHAT_NATS',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
    OllamaModule,
    GeminiModule,
    OpenAIModule,
    DeepSeekModule,
    AuthModule,
    WsModule,
  ],
  providers: [ChatService, ChatGateway, UsageService, ChatClient],
  controllers: [ChatController],
  exports: [ChatService, ChatClient],
})
export class ChatModule {}
