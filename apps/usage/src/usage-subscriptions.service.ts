import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { PrismaService } from 'libs/platform/prisma';

export interface UsageUserLimits {
  tier: SubscriptionTier;
  messagesPerDay: number;
  maxTokensPerMessage: number;
  canUploadImages: boolean;
}

@Injectable()
export class UsageSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getOrCreateSubscription(userId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          tier: SubscriptionTier.REGISTERED,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    return subscription;
  }

  getUserLimits(tier: SubscriptionTier): UsageUserLimits {
    switch (tier) {
      case SubscriptionTier.FREE:
        return {
          tier,
          messagesPerDay: this.configService.get<number>(
            'FREE_USER_MESSAGE_LIMIT',
            3,
          ),
          maxTokensPerMessage: this.configService.get<number>(
            'FREE_USER_MAX_TOKENS',
            512,
          ),
          canUploadImages: false,
        };
      case SubscriptionTier.REGISTERED:
        return {
          tier,
          messagesPerDay: this.configService.get<number>(
            'REGISTERED_USER_MESSAGE_LIMIT',
            10,
          ),
          maxTokensPerMessage: this.configService.get<number>(
            'REGISTERED_USER_MAX_TOKENS',
            2048,
          ),
          canUploadImages: false,
        };
      case SubscriptionTier.PREMIUM:
        return {
          tier,
          messagesPerDay: this.configService.get<number>(
            'PREMIUM_USER_MESSAGE_LIMIT',
            1000,
          ),
          maxTokensPerMessage: this.configService.get<number>(
            'PREMIUM_USER_MAX_TOKENS',
            8192,
          ),
          canUploadImages: true,
        };
      default:
        return this.getUserLimits(SubscriptionTier.FREE);
    }
  }
}
