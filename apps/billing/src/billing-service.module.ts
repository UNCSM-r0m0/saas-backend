import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingServiceController } from './billing-service.controller';
import { PrismaModule } from 'libs/platform/prisma';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [BillingServiceController],
})
export class BillingServiceModule {}
