import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('success')
  getSuccess(@Query('session_id') sessionId: string): object {
    return {
      message: '¡Pago exitoso!',
      sessionId: sessionId,
      status: 'success',
      timestamp: new Date().toISOString(),
    };
  }
}
