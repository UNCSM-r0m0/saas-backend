import { Module, Global } from '@nestjs/common';
import { OllamaService } from './ollama.service';

@Global()
@Module({
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule { }
