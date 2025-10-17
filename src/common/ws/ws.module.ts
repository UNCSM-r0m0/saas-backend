import { Module } from '@nestjs/common';
import { WsEmitterService } from './ws-emitter.service';

@Module({
  providers: [WsEmitterService],
  exports: [WsEmitterService],
})
export class WsModule {}

