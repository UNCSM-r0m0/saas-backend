import { Module, Global } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Global()
@Module({
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule { }
