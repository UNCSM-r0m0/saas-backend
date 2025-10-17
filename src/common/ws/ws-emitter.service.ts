import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class WsEmitterService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: any) {
    if (!this.server || !userId) return;
    const room = `user:${userId}`;
    this.server.to(room).emit(event, payload);
  }
}

