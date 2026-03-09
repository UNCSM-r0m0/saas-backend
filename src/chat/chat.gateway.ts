import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { WsEmitterService } from '../common/ws/ws-emitter.service';
import { ChatGatewayAuthService } from './gateway/chat-gateway-auth.service';
import { ChatGatewayRoomService } from './gateway/chat-gateway-room.service';
import { ChatClient } from './chat.client';

interface AuthSocket extends Socket {
  user?: { sub?: string } | null;
}

@WebSocketGateway({
  cors: {
    origin: [
      /https?:\/\/([a-z0-9-]+\.)*r0lm0\.dev$/i,
      'http://localhost:5173',
      'http://localhost:3001',
      process.env.FRONTEND_URL || 'https://r3chat.r0lm0.dev',
    ],
    credentials: true,
  },
  namespace: '/chat',
  transports: ['websocket'],
  pingTimeout: 120000, // 2 minutos para modelos lentos
  pingInterval: 25000, // default ok
  perMessageDeflate: false, // MUY importante con proxys
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer() server: Server;

  // Active stream cancel handlers by messageId
  private activeStreams = new Map<string, () => void>();

  constructor(
    private wsEmitter: WsEmitterService,
    private chatClient: ChatClient,
    private authService: ChatGatewayAuthService,
    private roomService: ChatGatewayRoomService,
  ) {}

  afterInit(server: Server) {
    // Disponibiliza el server para emisores globales (Stripe -> WS)
    try {
      this.wsEmitter.setServer(server);
    } catch {}
  }

  async handleConnection(client: AuthSocket) {
    try {
      // Debug: Log del handshake completo
      this.logger.debug(`🔍 Handshake para cliente ${client.id}:`, {
        auth: client.handshake?.auth,
        query: client.handshake?.query,
        headers: client.handshake?.headers,
      });

      // Debug fino (sin interferir con callbacks)
      client.onAny((eventName, ...args) => {
        this.logger.log(`🎯 EVENTO ${eventName} de ${client.id}`, {
          argsLen: args.length,
          hasAck: typeof args[args.length - 1] === 'function',
        });
      });

      // Log de desconexión con razón (Nest no la pasa en handleDisconnect)
      client.on('disconnect', (reason) => {
        this.logger.log(
          `❌ Cliente desconectado (reason): ${client.id} (${reason})`,
        );
      });

      this.logger.log(`🔗 Namespace usado: ${client.nsp?.name}`); // Debe ser '/chat'

      const auth = this.authService.authenticate(client);
      if (auth.userId) {
        try {
          client.join(`user:${auth.userId}`);
        } catch {}
        this.logger.log(
          `✅ Cliente autenticado conectado: ${client.id} (User: ${auth.userId})`,
        );
      } else {
        this.logger.log(`🔓 Cliente anónimo conectado: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error en conexión: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: {
      message?: string;
      content?: string;
      chatId?: string;
      model?: string;
      broadcast?: boolean;
    },
    @ConnectedSocket() client: AuthSocket,
    callback?: (ack: { status: 'ok' | 'error'; message?: string }) => void,
  ) {
    this.logger.log(`🎯 MÉTODO handleSendMessage para ${client.id}`);

    const chatId = data.chatId || `anonymous-${client.id}`;
    const message = (data.message ?? data.content ?? '').trim();

    if (!message) {
      client.emit('error', {
        message: 'El mensaje no puede estar vacío.',
        code: 'BAD_REQUEST',
        chatId,
      });
      return;
    }

    // Guardar la preferencia de broadcast para este chat
    const broadcast = data.broadcast !== false; // default true
    this.roomService.setBroadcastMode(chatId, broadcast);

    this.logger.log(
      `📡 Broadcast(${chatId}) = ${broadcast ? 'SALA' : 'SOLO_EMISOR'}`,
    );

    // ✅ ACK inmediato (el cliente ya no depende de esto para la UX)
    if (typeof callback === 'function') {
      callback({ status: 'ok', message: 'Mensaje recibido' });
    } else {
      this.logger.warn('⚠️ No vino callback de ACK (client.timeout?)');
    }

    // Procesar en background
    this.processMessageInBackground(
      client,
      data,
      client.user?.sub,
      chatId,
      message,
    );
  }

  /** Emite según flag: broadcast=true -> sala; false -> solo emisor */
  private emitChat(
    client: AuthSocket,
    chatId: string,
    event: string,
    payload: any,
  ) {
    this.roomService.emitChat(this.server, client, chatId, event, payload);
  }

  private async processMessageInBackground(
    client: AuthSocket,
    data: any,
    userId: string | undefined,
    chatId: string,
    message: string,
  ) {
    try {
      // El gateway ya no genera IA localmente: delega al microservicio chat (NATS)
      this.roomService.ensureJoined(client, chatId);
      await new Promise((resolve) => setTimeout(resolve, 60));

      const messageId = randomUUID
        ? randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.emitChat(client, chatId, 'responseStart', {
        chatId,
        messageId,
        content: 'Pensando...',
        timestamp: new Date().toISOString(),
      });
      this.logger.log(`📤 [START] Enviando responseStart a sala ${chatId}`);

      let chunkCount = 0;
      let seq = 0;
      let aborted = false;

      const onDisconnect = (reason: string) => {
        aborted = true;
        this.logger.warn(
          `Client disconnected during stream: ${client.id} (${reason})`,
        );
      };
      client.once('disconnect', onDisconnect);
      this.activeStreams.set(messageId, () => {
        aborted = true;
      });

      try {
        const result = (await this.chatClient.sendMessage(
          {
            content: message,
            model: data.model,
            conversationId: userId ? chatId : undefined,
            anonymousId: userId ? undefined : chatId,
          },
          userId,
        )) as any;

        const fullContent = String(result?.message?.content ?? '');
        const finalChatId = String(result?.conversationId ?? chatId);

        if (!fullContent) {
          this.emitChat(client, chatId, 'error', {
            message: 'El servicio chat no devolvió contenido.',
            code: 'EMPTY_RESPONSE',
            chatId,
            messageId,
          });
          return;
        }

        const chunkSize = 120;
        for (let i = 0; i < fullContent.length; i += chunkSize) {
          if (aborted) break;
          const piece = fullContent.slice(i, i + chunkSize);
          if (!piece) continue;
          chunkCount++;
          this.emitChat(client, finalChatId, 'responseChunk', {
            chatId: finalChatId,
            messageId,
            seq: ++seq,
            partial: true,
            content: piece,
            contentType: 'markdown',
            timestamp: new Date().toISOString(),
          });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        client.off('disconnect', onDisconnect);
        this.activeStreams.delete(messageId);

        if (aborted) {
          this.logger.warn(
            `Stream abortado por cliente ${client.id} en chat ${finalChatId}`,
          );
          return;
        }

        this.emitChat(client, finalChatId, 'responseEnd', {
          chatId: finalChatId,
          conversationId: finalChatId,
          messageId,
          fullContent,
          totalChunks: chunkCount,
          finished: true,
          timestamp: new Date().toISOString(),
        });

        this.logger.log(
          `✅ Respuesta WS completada para ${finalChatId} (${chunkCount} chunks)`,
        );
      } catch (streamError: any) {
        client.off('disconnect', onDisconnect);
        this.activeStreams.delete(messageId);
        this.logger.error(
          `Error en stream delegado a chat microservice para ${chatId}:`,
          streamError,
        );
        this.emitChat(client, chatId, 'error', {
          message:
            streamError?.message ||
            'Error generando respuesta. Intenta nuevamente.',
          code: 'STREAM_ERROR',
          chatId,
          messageId,
        });
      }
    } catch (error) {
      this.logger.error(`Error en sendMessage para ${chatId}:`, error);

      this.server.to(client.id).emit('error', {
        message: 'Error al procesar mensaje. Intenta nuevamente.',
        code: 'PROCESSING_ERROR',
        chatId,
      });
    }
  }

  @SubscribeMessage('stopGeneration')
  async handleStopGeneration(
    @MessageBody() data: { chatId: string; messageId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const { messageId } = data || ({} as any);
    if (!messageId) return;
    const stop = this.activeStreams.get(messageId);
    if (stop) {
      stop();
      this.activeStreams.delete(messageId);
      this.logger.log(
        `Stream cancelled by ${client.id} (messageId=${messageId})`,
      );
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const { chatId } = data;
    this.roomService.ensureJoined(client, chatId);
    this.roomService.logJoin(this.server, chatId, client.id);

    client.emit('joinedChat', { chatId });
  }

  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    const { chatId } = data;
    client.leave(chatId);
    this.logger.log(`👋 Cliente ${client.id} salió del chat: ${chatId}`);

    client.emit('leftChat', { chatId });
  }

  // ========== EVENTOS DE SESIÓN DE CHAT ==========

  @SubscribeMessage('newChat')
  async handleNewChat(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { title?: string },
  ) {
    try {
      const session = (await this.chatClient.createChat(
        client.user?.sub,
        data?.title,
      )) as any;

      // El cliente se une a la sala
      this.roomService.ensureJoined(client, session.id);
      client.emit('joinedChat', { chatId: session.id });

      this.logger.log(
        `Nuevo chat creado: ${session.id} para usuario: ${client.user?.sub || 'anónimo'}`,
      );
      return session;
    } catch (error) {
      this.logger.error('Error creando nuevo chat:', error);
      client.emit('error', {
        message: 'Error creando nuevo chat',
        code: 'CHAT_CREATE_ERROR',
      });
    }
  }

  @SubscribeMessage('listChats')
  async handleListChats(@ConnectedSocket() client: AuthSocket) {
    try {
      if (!client.user?.sub) {
        client.emit('chatsListed', []);
        return;
      }
      const sessions = (await this.chatClient.listChats(
        client.user.sub,
      )) as any[];
      client.emit('chatsListed', sessions);

      this.logger.log(
        `Listando ${sessions.length} chats para usuario: ${client.user?.sub || 'anónimo'}`,
      );
    } catch (error) {
      this.logger.error('Error listando chats:', error);
      client.emit('error', {
        message: 'Error listando chats',
        code: 'CHAT_LIST_ERROR',
      });
    }
  }

  @SubscribeMessage('renameChat')
  async handleRenameChat(
    @MessageBody() data: { chatId: string; title: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      if (!client.user?.sub) {
        client.emit('error', {
          message: 'Usuario no autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }
      await this.chatClient.renameChat(
        data.chatId,
        data.title,
        client.user.sub,
      );

      client.emit('chatRenamed', {
        chatId: data.chatId,
        title: data.title,
      });

      this.logger.log(`Chat renombrado: ${data.chatId} -> "${data.title}"`);
    } catch (error) {
      this.logger.error('Error renombrando chat:', error);
      client.emit('error', {
        message: 'Error renombrando chat',
        code: 'CHAT_RENAME_ERROR',
      });
    }
  }

  @SubscribeMessage('deleteChat')
  async handleDeleteChat(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      if (!client.user?.sub) {
        client.emit('error', {
          message: 'Usuario no autenticado',
          code: 'UNAUTHORIZED',
        });
        return;
      }
      await this.chatClient.deleteChat(data.chatId, client.user.sub);

      client.emit('chatDeleted', { chatId: data.chatId });

      this.logger.log(`Chat eliminado: ${data.chatId}`);
    } catch (error) {
      this.logger.error('Error eliminando chat:', error);
      client.emit('error', {
        message: 'Error eliminando chat',
        code: 'CHAT_DELETE_ERROR',
      });
    }
  }

  @SubscribeMessage('getHistory')
  async handleGetHistory(
    @MessageBody() data: { chatId: string; limit?: number; cursor?: string },
    @ConnectedSocket() client: AuthSocket,
  ) {
    try {
      const history = (await this.chatClient.getChatHistory(
        data.chatId,
      )) as any[];

      client.emit('history', {
        chatId: data.chatId,
        messages: history,
      });

      this.logger.log(
        `Historial enviado para chat: ${data.chatId} (${history.length} mensajes)`,
      );
    } catch (error) {
      this.logger.error('Error obteniendo historial:', error);
      client.emit('error', {
        message: 'Error obteniendo historial',
        code: 'HISTORY_ERROR',
      });
    }
  }
}
