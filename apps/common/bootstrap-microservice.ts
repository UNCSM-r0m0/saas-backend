/**
 * Utilidad compartida para bootstrap de microservicios NestJS con NATS.
 * Proporciona reintentos de conexión, health checks y logging consistente.
 */

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { INestMicroservice, Logger } from '@nestjs/common';

export interface BootstrapOptions {
  serviceName: string;
  module: any;
  natsUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  enableHealthCheck?: boolean;
  healthCheckPort?: number;
}

/**
 * Bootstrap un microservicio NATS con reintentos y health check opcional.
 */
export async function bootstrapMicroservice(options: BootstrapOptions): Promise<void> {
  const {
    serviceName,
    module,
    natsUrl = process.env.NATS_URL || 'nats://localhost:4222',
    maxRetries = parseInt(process.env.NATS_MAX_RETRIES || '10', 10),
    retryDelayMs = parseInt(process.env.NATS_RETRY_DELAY_MS || '3000', 10),
    enableHealthCheck = true,
    healthCheckPort = parseInt(process.env.HEALTH_CHECK_PORT || '0', 10),
  } = options;

  const logger = new Logger(`${serviceName}Service`);
  
  logger.log(`🚀 Starting ${serviceName} service...`);
  logger.log(`📡 NATS URL: ${natsUrl}`);

  let app: INestMicroservice | null = null;
  let connected = false;
  let retries = 0;

  while (!connected && retries < maxRetries) {
    try {
      app = await NestFactory.createMicroservice<MicroserviceOptions>(module, {
        transport: Transport.NATS,
        options: {
          servers: [natsUrl],
          reconnect: true,
          reconnectTimeWait: 3000,
          maxReconnectAttempts: -1,
        },
        logger: process.env.NODE_ENV === 'production' 
          ? ['error', 'warn', 'log'] 
          : ['error', 'warn', 'log', 'debug', 'verbose'],
      });

      // Health check HTTP simple (opcional)
      if (enableHealthCheck && healthCheckPort > 0) {
        const http = require('http');
        const server = http.createServer((req: any, res: any) => {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'ok',
              service: serviceName.toLowerCase(),
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
            }));
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });
        server.listen(healthCheckPort, '0.0.0.0', () => {
          logger.log(`❤️  Health check available on port ${healthCheckPort}`);
        });
      }

      await app.listen();
      connected = true;
      logger.log(`✅ ${serviceName} service is listening (NATS)`);
      
      // Manejar señales de terminación graceful
      const gracefulShutdown = async (signal: string) => {
        logger.log(`📥 Received ${signal}. Starting graceful shutdown...`);
        if (app) {
          await app.close();
        }
        logger.log(`👋 ${serviceName} service shut down gracefully`);
        process.exit(0);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
    } catch (error: any) {
      retries++;
      logger.warn(`⚠️  Connection attempt ${retries}/${maxRetries} failed: ${error.message}`);
      
      if (retries < maxRetries) {
        logger.log(`⏳ Retrying in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      } else {
        logger.error(`❌ Max retries reached. Exiting...`);
        process.exit(1);
      }
    }
  }
}
