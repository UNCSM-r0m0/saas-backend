import { Module } from '@nestjs/common';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MODELS_SERVICE } from 'libs/ai';
import { CacheConfigModule } from '../common/cache/cache.module';

@Module({
    imports: [PrismaModule, CacheConfigModule],
    controllers: [ModelsController],
    providers: [
        ModelsService,
        {
            provide: MODELS_SERVICE,
            useExisting: ModelsService,
        },
    ],
    exports: [ModelsService, MODELS_SERVICE],
})
export class ModelsModule { }
