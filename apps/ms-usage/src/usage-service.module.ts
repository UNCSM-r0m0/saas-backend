import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageServiceController } from './usage-service.controller';
import { PrismaModule } from 'libs/platform/prisma';
import { UsageDomainService } from './usage-domain.service';
import { UsageSubscriptionsService } from './usage-subscriptions.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [UsageServiceController],
  providers: [UsageDomainService, UsageSubscriptionsService],
})
export class UsageServiceModule {}
