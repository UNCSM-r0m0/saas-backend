import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from 'libs/ai';

@Module({
    imports: [PrismaModule, AIModule.forRoot()],
    controllers: [ModelsController],
})
export class ModelsModule { }
