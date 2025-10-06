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
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        GOOGLE_CLIENT_SECRET: Joi.string().optional(),
        GOOGLE_CALLBACK_URL: Joi.string().optional(),
        GITHUB_CLIENT_ID: Joi.string().optional(),
        GITHUB_CLIENT_SECRET: Joi.string().optional(),
        GITHUB_CALLBACK_URL: Joi.string().optional(),
        FRONTEND_URL: Joi.string().default('http://localhost:3001'),
        OLLAMA_URL: Joi.string().default('http://localhost:11434'),
        OLLAMA_MODEL: Joi.string().default('deepseek-r1:7b'),
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
        ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,image/webp'),
        ADMIN_EMAIL: Joi.string().default('admin@saas.com'),
        ADMIN_PASSWORD: Joi.string().default('Admin123!'),
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
  ],
  controllers: [AppController],
  providers: [AppService, UsageService],
})
export class AppModule { }
