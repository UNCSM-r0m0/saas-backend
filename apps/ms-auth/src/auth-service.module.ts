import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthServiceController } from './auth-service.controller';
import { PrismaModule } from 'libs/platform/prisma';
import { UsersService } from 'libs/users';
import { AuthDomainService } from './auth-domain.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuthTokenService } from './auth-token.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthServiceController],
  providers: [
    AuthDomainService,
    UsersService,
    RefreshTokenService,
    AuthTokenService,
  ],
})
export class AuthServiceModule {}
