import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsageServiceController } from './usage-service.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [UsageServiceController],
})
export class UsageServiceModule {}
