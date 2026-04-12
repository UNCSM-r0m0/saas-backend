import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatController } from './chat.controller';
import { ChatSessionsController } from './chat-sessions.controller';
import { ChatMessagesController } from './chat-messages.controller';
import { ChatStreamEventsController } from './chat-stream-events.controller';
import { ChatGateway } from './chat.gateway';
import { ChatClient } from './chat.client';
import { WsModule } from '../common/ws/ws.module';
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
    AuthModule,
    WsModule,
  ],
  providers: [
    ChatGateway,
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
  exports: [ChatClient],
})
export class ChatModule {}
