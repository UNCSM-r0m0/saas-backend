import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatSessionsController } from './chat-sessions.controller';
import { ChatMessagesController } from './chat-messages.controller';
import { ChatStreamEventsController } from './chat-stream-events.controller';
import { ChatGateway } from './chat.gateway';
import { ChatClient } from './chat.client';
import { UsageService } from '../usage/usage.service';
import { WsModule } from '../common/ws/ws.module';
import { OllamaModule } from '../ollama/ollama.module';
import { GeminiModule } from '../gemini/gemini.module';
import { OpenAIModule } from '../openai/openai.module';
import { DeepSeekModule } from '../deepseek/deepseek.module';
import { AuthModule } from '../auth/auth.module';
import { ChatGatewayAuthService } from './gateway/chat-gateway-auth.service';
import { ChatGatewayRoomService } from './gateway/chat-gateway-room.service';
import { ChatStreamSessionService } from './gateway/chat-stream-session.service';

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
  providers: [
    ChatService,
    ChatGateway,
    UsageService,
    ChatClient,
    ChatGatewayAuthService,
    ChatGatewayRoomService,
    ChatStreamSessionService,
  ],
  controllers: [
    ChatController,
    ChatSessionsController,
    ChatMessagesController,
    ChatStreamEventsController,
  ],
  exports: [ChatService, ChatClient],
})
export class ChatModule {}
