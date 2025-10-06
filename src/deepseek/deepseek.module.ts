import { Global, Module } from '@nestjs/common';
import { DeepSeekService } from './deepseek.service';

@Global()
@Module({
    providers: [DeepSeekService],
    exports: [DeepSeekService],
})
export class DeepSeekModule { }
