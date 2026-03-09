import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_EVENTS } from 'libs/contracts/chat';
import type {
  ChatMessageCreatedEvent,
  ChatUsageIncrementedEvent,
} from 'libs/contracts/chat';
import { PrismaService } from '../../../src/prisma/prisma.service';

@Controller()
export class BillingServiceController {
  private readonly logger = new Logger(BillingServiceController.name);

  constructor(private readonly prisma: PrismaService) {}

  @MessagePattern('billing.health')
  health() {
    return { service: 'billing', status: 'ok' };
  }

  @EventPattern(CHAT_EVENTS.usageIncremented)
  async onUsageIncremented(@Payload() payload: ChatUsageIncrementedEvent) {
    await (this.prisma as any).billingUsageEvent.create({
      data: {
        source: 'chat',
        eventType: CHAT_EVENTS.usageIncremented,
        userId: payload.userId,
        anonymousId: payload.anonymousId,
        conversationId: payload.conversationId,
        tokensUsed: payload.tokensUsed ?? 0,
        occurredAt: payload.at ? new Date(payload.at) : new Date(),
      },
    });
  }

  @EventPattern(CHAT_EVENTS.messageCreated)
  async onMessageCreated(@Payload() payload: ChatMessageCreatedEvent) {
    await (this.prisma as any).billingUsageEvent.create({
      data: {
        source: 'chat',
        eventType: CHAT_EVENTS.messageCreated,
        userId: payload.userId,
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        model: payload.model,
        tokensUsed: payload.tokensUsed ?? 0,
        occurredAt: payload.createdAt
          ? new Date(payload.createdAt)
          : new Date(),
      },
    });

    this.logger.debug(
      `Evento facturable registrado (messageCreated): ${payload.messageId}`,
    );
  }
}
