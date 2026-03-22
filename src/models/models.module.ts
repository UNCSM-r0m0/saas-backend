import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { OllamaModule } from '../integrations/ai/ollama/ollama.module';
import { GeminiModule } from '../integrations/ai/gemini/gemini.module';
import { OpenAIModule } from '../integrations/ai/openai/openai.module';
import { DeepSeekModule } from '../integrations/ai/deepseek/deepseek.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [OllamaModule, GeminiModule, OpenAIModule, DeepSeekModule, PrismaModule],
    controllers: [ModelsController],
})
export class ModelsModule { }
