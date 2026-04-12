import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from 'libs/ai';

@Module({
    imports: [PrismaModule, AIModule.forRoot()],
    controllers: [ModelsController],
    providers: [ModelsService],
    exports: [ModelsService],
})
export class ModelsModule { }
