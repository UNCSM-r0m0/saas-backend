import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_EVENTS } from 'libs/contracts/chat';
import { BILLING_PATTERNS } from 'libs/contracts/billing';
import type { BillingResponseEnvelopeV1 } from 'libs/contracts/billing';
import type {
  ChatMessageCreatedEvent,
  ChatUsageIncrementedEvent,
} from 'libs/contracts/chat';
import { PrismaService } from 'libs/platform/prisma';
import { structuredLog } from '../../../src/common/logging/structured-log.util';

@Controller()
export class BillingServiceController {
  private readonly logger = new Logger(BillingServiceController.name);

  constructor(private readonly prisma: PrismaService) {}

  private v1<T>(data: T): BillingResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

  @MessagePattern(BILLING_PATTERNS.health)
  health() {
    return this.v1({ service: 'billing', status: 'ok' as const });
  }

  @EventPattern(CHAT_EVENTS.usageIncremented)
  async onUsageIncremented(@Payload() payload: ChatUsageIncrementedEvent) {
    if (!payload.eventId) return;
    const exists = await (this.prisma as any).billingUsageEvent.findUnique({
      where: { eventId: payload.eventId },
      select: { id: true },
    });
    if (exists) {
      structuredLog(this.logger, 'debug', 'billing.event.duplicate_ignored', {
        eventId: payload.eventId,
        correlationId: payload.correlationId || null,
        eventType: CHAT_EVENTS.usageIncremented,
      });
      return;
    }

    await (this.prisma as any).billingUsageEvent.create({
      data: {
        eventId: payload.eventId,
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
    if (!payload.eventId) return;
    const exists = await (this.prisma as any).billingUsageEvent.findUnique({
      where: { eventId: payload.eventId },
      select: { id: true },
    });
    if (exists) {
      structuredLog(this.logger, 'debug', 'billing.event.duplicate_ignored', {
        eventId: payload.eventId,
        correlationId: payload.correlationId || null,
        eventType: CHAT_EVENTS.messageCreated,
      });
      return;
    }

    await (this.prisma as any).billingUsageEvent.create({
      data: {
        eventId: payload.eventId,
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

    structuredLog(this.logger, 'debug', 'billing.event.processed', {
      eventId: payload.eventId,
      correlationId: payload.correlationId || null,
      eventType: CHAT_EVENTS.messageCreated,
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      model: payload.model || null,
      tokensUsed: payload.tokensUsed ?? 0,
    });
  }
}
