import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersServiceController } from './users-service.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersService } from 'libs/users';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [UsersServiceController],
  // Reuse the domain service while the monolith is still being extracted.
  providers: [UsersService],
})
export class UsersServiceModule {}
