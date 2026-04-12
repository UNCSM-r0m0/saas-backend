import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ModelsController],
})
export class ModelsModule { }
