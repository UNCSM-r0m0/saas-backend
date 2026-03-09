import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class ChatGatewayRoomService {
  private readonly logger = new Logger(ChatGatewayRoomService.name);
  private readonly chatBroadcast = new Map<string, boolean>();

  setBroadcastMode(chatId: string, broadcast: boolean) {
    this.chatBroadcast.set(chatId, broadcast);
  }

  ensureJoined(client: Socket, roomId: string) {
    if (!client.rooms.has(roomId)) {
      client.join(roomId);
    }
  }

  emitChat(
    server: Server,
    client: Socket,
    chatId: string,
    event: string,
    payload: unknown,
  ) {
    const broadcast = this.chatBroadcast.get(chatId) ?? true;
    const criticalEvents = ['responseStart', 'responseEnd', 'error'];
    const isCritical = criticalEvents.includes(event);

    if (broadcast) {
      const room = (server as any).adapter?.rooms?.get(chatId);
      const isClientInRoom = room?.has(client.id) ?? false;
      server.to(chatId).emit(event, payload);

      if (isCritical && !isClientInRoom) {
        client.emit(event, payload);
      }
      return;
    }

    client.emit(event, payload);
  }

  logJoin(server: Server, chatId: string, clientId: string) {
    const room = (server as any).adapter?.rooms?.get(chatId);
    const clientCount = room ? room.size : 0;
    this.logger.log(
      `Cliente ${clientId} se unió al chat ${chatId} (${clientCount} en sala)`,
    );
  }
}
