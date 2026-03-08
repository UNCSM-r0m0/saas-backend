import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class AuthServiceController {
  @MessagePattern('auth.health')
  health() {
    return { service: 'auth', status: 'ok' };
  }
}
