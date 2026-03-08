import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingServiceController } from './billing-service.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [BillingServiceController],
})
export class BillingServiceModule {}
