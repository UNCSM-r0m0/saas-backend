import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UsersServiceModule } from './users-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UsersServiceModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
      },
    },
  );

  await app.listen();
  console.log('✅ Users service listening (NATS)');
}

bootstrap();
