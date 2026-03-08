import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class UsageServiceController {
  @MessagePattern('usage.health')
  health() {
    return { service: 'usage', status: 'ok' };
  }
}
