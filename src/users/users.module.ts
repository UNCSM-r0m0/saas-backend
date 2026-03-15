import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersService } from 'libs/users';
import { UsersController } from './users.controller';
import { UsersClient } from './users.client';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_NATS',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersClient],
  exports: [UsersService, UsersClient],
})
export class UsersModule {}
