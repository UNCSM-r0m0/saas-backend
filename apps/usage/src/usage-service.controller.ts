import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_EVENTS } from 'libs/contracts/chat';
import type { ChatUsageIncrementedEvent } from 'libs/contracts/chat';
import { UsageService } from '../../../src/usage/usage.service';

@Controller()
export class UsageServiceController {
  private readonly logger = new Logger(UsageServiceController.name);

  constructor(private readonly usageService: UsageService) {}

  @MessagePattern('usage.health')
  health() {
    return { service: 'usage', status: 'ok' };
  }

  @EventPattern(CHAT_EVENTS.usageIncremented)
  async onUsageIncremented(@Payload() payload: ChatUsageIncrementedEvent) {
    await this.usageService.incrementMessageCount(
      payload.tokensUsed ?? 0,
      payload.userId,
      payload.anonymousId,
    );

    this.logger.debug(
      `Uso actualizado por evento chat.events.usage.incremented (${payload.userId || payload.anonymousId || 'unknown'})`,
    );
  }
}
