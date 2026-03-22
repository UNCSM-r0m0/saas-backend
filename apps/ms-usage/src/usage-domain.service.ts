import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { PrismaService } from 'libs/platform/prisma';
import { UsageSubscriptionsService } from './usage-subscriptions.service';

@Injectable()
export class UsageDomainService {
  private readonly logger = new Logger(UsageDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: UsageSubscriptionsService,
  ) {}

  async canSendMessage(userId?: string, anonymousId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let tier: SubscriptionTier = SubscriptionTier.FREE;
    if (userId) {
      const subscription =
        await this.subscriptionsService.getOrCreateSubscription(userId);
      tier = subscription.tier;
    }

    const limits = this.subscriptionsService.getUserLimits(tier);

    if (!userId && !anonymousId) {
      throw new ForbiddenException(
        'Se requiere userId o anonymousId para registrar uso',
      );
    }

    const usageRecord = await this.prisma.usageRecord.upsert({
      where: userId
        ? { userId_date: { userId, date: today } }
        : { anonymousId_date: { anonymousId: anonymousId!, date: today } },
      create: {
        userId,
        anonymousId,
        date: today,
        messageCount: 0,
        tokensUsed: 0,
      },
      update: {},
    });

    const allowed = usageRecord.messageCount < limits.messagesPerDay;
    const remaining = Math.max(
      0,
      limits.messagesPerDay - usageRecord.messageCount,
    );

    return {
      allowed,
      remaining,
      limit: limits.messagesPerDay,
    };
  }

  async incrementMessageCount(
    tokensUsed: number,
    userId?: string,
    anonymousId?: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!userId && !anonymousId) {
      throw new ForbiddenException(
        'Se requiere userId o anonymousId para registrar uso',
      );
    }

    await this.prisma.usageRecord.upsert({
      where: userId
        ? { userId_date: { userId, date: today } }
        : { anonymousId_date: { anonymousId: anonymousId!, date: today } },
      create: {
        userId,
        anonymousId,
        date: today,
        messageCount: 1,
        tokensUsed,
      },
      update: {
        messageCount: { increment: 1 },
        tokensUsed: { increment: tokensUsed },
      },
    });

    this.logger.log(
      `Mensaje registrado: ${userId || anonymousId} (${tokensUsed} tokens)`,
    );
  }

  async getUserStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await this.prisma.usageRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const totalUsage = await this.prisma.usageRecord.aggregate({
      where: { userId },
      _sum: { messageCount: true, tokensUsed: true },
    });

    return {
      todayMessages: todayUsage?.messageCount || 0,
      todayTokens: todayUsage?.tokensUsed || 0,
      totalMessages: totalUsage._sum.messageCount || 0,
      totalTokens: totalUsage._sum.tokensUsed || 0,
    };
  }
}
