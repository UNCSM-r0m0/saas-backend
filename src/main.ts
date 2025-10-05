import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global /api
  app.setGlobalPrefix('api');

  // CORS - Permitir requests desde frontend y Tailscale
  app.enableCors({
    origin: [
      /https?:\/\/([a-z0-9-]+\.)*vercel\.app$/i,
      /https?:\/\/([a-z0-9-]+\.)*ts\.net$/i,
      /https?:\/\/([a-z0-9-]+\.)*trycloudflare\.com$/i,
      /https?:\/\/([a-z0-9-]+\.)*ngrok-free\.(dev|app)$/i, // <= ngrok
      'http://localhost:3001',
      'http://localhost:5173',
      'https://jeanett-uncolorable-pickily.ngrok-free.dev', // explícito (opcional)
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Accept',
  });

  // ValidationPipe global con whitelist y forbidNonWhitelisted
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('SaaS Backend API')
    .setDescription(
      'API SaaS con IA local (Ollama), autenticación multiestrategy y sistema de suscripciones',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación (Local, Google, GitHub)')
    .addTag('users', 'Gestión de usuarios')
    .addTag('chat', 'Chat con IA (Anónimos: 3 msg, Registrados: 10 msg, Premium: 1000 msg)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
