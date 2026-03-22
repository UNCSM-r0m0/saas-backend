import { Module, Global } from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { CacheConfigModule } from '../../../common/cache/cache.module';

@Global()
@Module({
  imports: [CacheConfigModule],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule { }
