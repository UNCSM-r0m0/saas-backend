import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_EVENTS } from 'libs/contracts/chat';
import { USAGE_PATTERNS } from 'libs/contracts/usage';
import type { ChatUsageIncrementedEvent } from 'libs/contracts/chat';
import type { UsageResponseEnvelopeV1 } from 'libs/contracts/usage';
import { PrismaService } from 'libs/platform/prisma';
import { structuredLog } from '../../../src/common/logging/structured-log.util';
import { UsageDomainService } from './usage-domain.service';

@Controller()
export class UsageServiceController {
  private readonly logger = new Logger(UsageServiceController.name);

  constructor(
    private readonly usageService: UsageDomainService,
    private readonly prisma: PrismaService,
  ) {}

  private v1<T>(data: T): UsageResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

  @MessagePattern(USAGE_PATTERNS.health)
  health() {
    return this.v1({ service: 'usage', status: 'ok' as const });
  }

  @EventPattern(CHAT_EVENTS.usageIncremented)
  async onUsageIncremented(@Payload() payload: ChatUsageIncrementedEvent) {
    if (!payload.eventId) return;

    const alreadyProcessed = await (
      this.prisma as any
    ).usageConsumedEvent.findUnique({
      where: { eventId: payload.eventId },
      select: { id: true },
    });
    if (alreadyProcessed) {
      structuredLog(this.logger, 'debug', 'usage.event.duplicate_ignored', {
        eventId: payload.eventId,
        correlationId: payload.correlationId || null,
        userId: payload.userId || null,
        anonymousId: payload.anonymousId || null,
      });
      return;
    }

    await (this.prisma as any).usageConsumedEvent.create({
      data: {
        eventId: payload.eventId,
        eventType: CHAT_EVENTS.usageIncremented,
      },
    });

    await this.usageService.incrementMessageCount(
      payload.tokensUsed ?? 0,
      payload.userId,
      payload.anonymousId,
    );

    structuredLog(this.logger, 'debug', 'usage.event.processed', {
      eventId: payload.eventId,
      correlationId: payload.correlationId || null,
      eventType: CHAT_EVENTS.usageIncremented,
      userId: payload.userId || null,
      anonymousId: payload.anonymousId || null,
      tokensUsed: payload.tokensUsed ?? 0,
    });
  }
}
