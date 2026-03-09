import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageServiceController } from './usage-service.controller';
import { UsageService } from '../../../src/usage/usage.service';
import { PrismaModule } from '../../../src/prisma/prisma.module';
import { SubscriptionsModule } from '../../../src/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SubscriptionsModule,
  ],
  controllers: [UsageServiceController],
  providers: [UsageService],
})
export class UsageServiceModule {}
