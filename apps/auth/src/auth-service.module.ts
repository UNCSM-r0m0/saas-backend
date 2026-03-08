import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthServiceController } from './auth-service.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AuthServiceController],
})
export class AuthServiceModule {}
