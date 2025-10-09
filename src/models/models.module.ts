import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { OllamaModule } from '../ollama/ollama.module';
import { GeminiModule } from '../gemini/gemini.module';
import { OpenAIModule } from '../openai/openai.module';
import { DeepSeekModule } from '../deepseek/deepseek.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [OllamaModule, GeminiModule, OpenAIModule, DeepSeekModule, PrismaModule],
    controllers: [ModelsController],
})
export class ModelsModule { }
