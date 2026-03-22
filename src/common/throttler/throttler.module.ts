import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_DEFAULT_TTL', 60000), // 1 minuto
            limit: config.get<number>('THROTTLE_DEFAULT_LIMIT', 100), // 100 requests
          },
          {
            name: 'auth',
            ttl: config.get<number>('THROTTLE_AUTH_TTL', 60000), // 1 minuto
            limit: config.get<number>('THROTTLE_AUTH_LIMIT', 10), // 10 intentos login
          },
          {
            name: 'ai',
            ttl: config.get<number>('THROTTLE_AI_TTL', 60000), // 1 minuto
            limit: config.get<number>('THROTTLE_AI_LIMIT', 20), // 20 requests AI
          },
          {
            name: 'upload',
            ttl: config.get<number>('THROTTLE_UPLOAD_TTL', 60000), // 1 minuto
            limit: config.get<number>('THROTTLE_UPLOAD_LIMIT', 10), // 10 uploads
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class ThrottlerConfigModule {}
