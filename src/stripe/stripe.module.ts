import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WsModule } from '../common/ws/ws.module';

@Module({
    imports: [PrismaModule, WsModule],
    controllers: [StripeController],
    providers: [StripeService],
    exports: [StripeService],
})
export class StripeModule { }
