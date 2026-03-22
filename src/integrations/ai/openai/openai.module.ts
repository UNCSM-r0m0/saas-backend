import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { LocalModelQueueService } from '../../common/services/local-model-queue.service';

@Module({
    providers: [OpenAIService, LocalModelQueueService],
    exports: [OpenAIService],
})
export class OpenAIModule { }
