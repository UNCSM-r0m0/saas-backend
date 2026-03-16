import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser';
import { cookieAuthMiddleware } from './common/middleware/cookie-auth.middleware';
import { corsOptions } from './common/config/cors.config';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Necesario para webhooks de Stripe
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Trust proxy para Cloudflare Tunnel / Nginx / Traefik
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Cookies
  app.use(cookieParser());

  // ==========================================
  // HEALTH CHECK ENDPOINT (ANTES del prefijo global /api)
  // ==========================================
  const httpAdapter = app.getHttpAdapter();
  
  // Health check simple en /health (sin prefijo /api)
  httpAdapter.get('/health', (req: any, res: any) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gateway',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });
  
  // Prefijo global /api
  app.setGlobalPrefix('api');

  // Desactivar ETag para evitar 304 en endpoints autenticados
  app.getHttpAdapter().getInstance().set('etag', false);

  // CORS - configurado en archivo dedicado
  app.enableCors(corsOptions);

  // Middleware: propagar cookie auth_token a Authorization si no viene
  app.use(cookieAuthMiddleware);

  // Filtro de excepciones global
  app.useGlobalFilters(new HttpExceptionFilter());

  // ValidationPipe global con whitelist y forbidNonWhitelisted
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Health check detallado con dependencias (con prefijo /api)
  httpAdapter.get('/api/health/detailed', async (req: any, res: any) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gateway',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        nats: { status: 'unknown' },
        database: { status: 'unknown' },
      },
    };
    
    // Aquí podrías agregar checks reales de NATS y DB
    // Por ahora retornamos básico para no bloquear el startup
    res.status(200).json(health);
  });

  // Configuración de Swagger (solo en desarrollo o si está explícitamente habilitado)
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('SaaS Backend API')
      .setDescription(
        'API SaaS con IA local (Ollama), autenticación multiestrategy y sistema de suscripciones',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Autenticación (Local, Google, GitHub)')
      .addTag('users', 'Gestión de usuarios')
      .addTag(
        'chat',
        'Chat con IA (Anónimos: 3 msg, Registrados: 10 msg, Premium: 1000 msg)',
      )
      .addTag('stripe', 'Pagos y suscripciones con Stripe')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    
    // Configuración personalizada para usar CDN (mejor compatibilidad con proxies)
    const customOptions: SwaggerCustomOptions = {
      customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js',
      ],
      customfavIcon: 'https://swagger.io/favicon.ico',
      customSiteTitle: 'SaaS Backend API Docs',
    };
    
    SwaggerModule.setup('api/docs', app, document, customOptions);
  }

  // ==========================================
  // CONEXIÓN NATS CON RETRY
  // ==========================================
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  const maxRetries = parseInt(process.env.NATS_MAX_RETRIES || '10', 10);
  const retryDelay = parseInt(process.env.NATS_RETRY_DELAY_MS || '3000', 10);
  
  let connected = false;
  let retries = 0;
  
  while (!connected && retries < maxRetries) {
    try {
      app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.NATS,
        options: {
          servers: [natsUrl],
          reconnect: true,
          reconnectTimeWait: 3000,
          maxReconnectAttempts: -1, // Reintentar indefinidamente
        },
      });
      
      await app.startAllMicroservices();
      connected = true;
      logger.log(`✅ NATS connected successfully to ${natsUrl}`);
    } catch (error) {
      retries++;
      logger.warn(`⚠️ NATS connection attempt ${retries}/${maxRetries} failed: ${error.message}`);
      
      if (retries < maxRetries) {
        logger.log(`⏳ Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        logger.error('❌ Max NATS retries reached. Starting without microservice connection...');
        // En producción, podrías querer fallar aquí
        // process.exit(1);
      }
    }
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Gateway is running on: http://0.0.0.0:${port}/api`);
  logger.log(`❤️  Health check: http://0.0.0.0:${port}/health`);
  
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    logger.log(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
