import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AIModule } from 'libs/ai';
import { SubscriptionsModule } from 'libs/domain/subscriptions';
import { UsageService } from 'libs/domain/usage';
import { PrismaModule } from 'libs/platform/prisma';
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
    AIModule.forRoot(),
  ],
  controllers: [ChatNatsController],
  providers: [ChatDomainService, UsageService, ChatEventsPublisher],
})
export class ChatServiceModule {}
