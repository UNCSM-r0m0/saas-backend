import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaypalController } from './paypal.controller';
import { PaypalService } from './paypal.service';
import { PrismaModule } from 'libs/platform/prisma';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [PaypalController],
  providers: [PaypalService],
})
export class PaypalModule {}
