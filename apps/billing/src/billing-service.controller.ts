import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class BillingServiceController {
  @MessagePattern('billing.health')
  health() {
    return { service: 'billing', status: 'ok' };
  }
}
