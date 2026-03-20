import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { OllamaModule } from './ollama/ollama.module';
import { UsageService } from './usage/usage.service';
import { StripeModule } from './stripe/stripe.module';
import { GeminiModule } from './gemini/gemini.module';
import { OpenAIModule } from './openai/openai.module';
import { DeepSeekModule } from './deepseek/deepseek.module';
import { ModelsModule } from './models/models.module';
import { UploadModule } from './upload/upload.module';
import { PaypalModule } from './paypal/paypal.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3000),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('7d'),
        JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES: Joi.string().default('30d'),
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_CALLBACK_URL: Joi.string().optional(),
        GITHUB_CLIENT_ID: Joi.string().optional(),
        GITHUB_CLIENT_SECRET: Joi.string().optional(),
        GITHUB_CALLBACK_URL: Joi.string().optional(),
        FRONTEND_URL: Joi.string().default('http://localhost:3001'),
        OLLAMA_URL: Joi.string().default('http://localhost:11434'),
        OLLAMA_MODEL: Joi.string().default('qwen2.5-coder:7b'),
        OLLAMA_PROXY_URL: Joi.string().optional(),
        OLLAMA_PROXY_API_KEY: Joi.string().optional(),
        NATS_URL: Joi.string().default('nats://localhost:4222'),
        PUBLIC_MODELS: Joi.string().optional(),
        PRO_MODELS: Joi.string().optional(),
        FREE_USER_MESSAGE_LIMIT: Joi.number().default(3),
        FREE_USER_MAX_TOKENS: Joi.number().default(512),
        REGISTERED_USER_MESSAGE_LIMIT: Joi.number().default(10),
        REGISTERED_USER_MAX_TOKENS: Joi.number().default(2048),
        PREMIUM_USER_MESSAGE_LIMIT: Joi.number().default(1000),
        PREMIUM_USER_MAX_TOKENS: Joi.number().default(8192),
        STRIPE_SECRET_KEY: Joi.string().allow('').optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().allow('').optional(),
        STRIPE_PREMIUM_PRICE_ID: Joi.string().allow('').optional(),
        GEMINI_API_KEY: Joi.string().allow('').optional(),
        OPENAI_API_KEY: Joi.string().allow('').optional(),
        DEEPSEEK_API_KEY: Joi.string().allow('').optional(),
        MAX_FILE_SIZE_MB: Joi.number().default(10),
        ALLOWED_FILE_TYPES: Joi.string().default(
          'image/jpeg,image/png,image/gif,image/webp',
        ),
        // Cloudflare Images
        CF_ACCOUNT_ID: Joi.string().allow('').optional(),
        CF_API_TOKEN: Joi.string().allow('').optional(),
        CF_IMAGES_ACCOUNT_HASH: Joi.string().allow('').optional(),
        ADMIN_EMAIL: Joi.string().default('admin@saas.com'),
        ADMIN_PASSWORD: Joi.string().default('Admin123!'),
        // Chat concurrency controls (optional)
        CHAT_MAX_CONCURRENCY: Joi.number().default(2),
        CHAT_MAX_STREAMS_PER_USER: Joi.number().default(1),
        CHAT_QUEUE_TIMEOUT_MS: Joi.number().default(8000),
        CHAT_QUEUE_MAX_WAITERS: Joi.number().default(50),
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ChatModule,
    SubscriptionsModule,
    OllamaModule,
    StripeModule,
    GeminiModule,
    OpenAIModule,
    DeepSeekModule,
    ModelsModule,
    UploadModule,
    PaypalModule,
  ],
  controllers: [AppController],
  providers: [AppService, UsageService],
})
export class AppModule {}
