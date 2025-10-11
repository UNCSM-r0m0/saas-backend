import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WsException,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { OllamaService } from '../ollama/ollama.service';
import { UsageService } from '../usage/usage.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthSocket extends Socket {
    user?: any; // Del JWT
}

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        credentials: true,
    },
    namespace: '/chat',
    transports: ['websocket'],
    pingTimeout: 60000,        // antes 20000
    pingInterval: 25000,       // default ok
    perMessageDeflate: false,  // MUY importante con proxys
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer() server: Server;

    // chatId -> broadcast?
    private chatBroadcast = new Map<string, boolean>();

    constructor(
        private chatService: ChatService,
        private ollamaService: OllamaService,
        private usageService: UsageService,
        private jwtService: JwtService,
    ) { }

    async handleConnection(client: AuthSocket) {
        try {
            // Debug: Log del handshake completo
            this.logger.debug(`🔍 Handshake para cliente ${client.id}:`, {
                auth: client.handshake?.auth,
                query: client.handshake?.query,
                headers: client.handshake?.headers
            });

            // Debug fino (sin interferir con callbacks)
            client.onAny((eventName, ...args) => {
                this.logger.log(`🎯 EVENTO ${eventName} de ${client.id}`, {
                    argsLen: args.length,
                    hasAck: typeof args[args.length - 1] === 'function'
                });
            });

            // Log de desconexión con razón (Nest no la pasa en handleDisconnect)
            client.on('disconnect', (reason) => {
                this.logger.log(`❌ Cliente desconectado (reason): ${client.id} (${reason})`);
            });

            this.logger.log(`🔗 Namespace usado: ${client.nsp?.name}`); // Debe ser '/chat'

            // Extraer token del handshake
            const token = this.extractTokenFromSocket(client);
            this.logger.debug(`🔍 Token extraído para ${client.id}:`, token ? 'Presente' : 'Ausente');

            if (token) {
                try {
                    const payload = this.jwtService.verify(token);
                    client.user = payload;
                    this.logger.log(`✅ Cliente autenticado conectado: ${client.id} (User: ${payload.sub})`);
                } catch (error) {
                    this.logger.warn(`❌ Token inválido para cliente: ${client.id}`, error.message);
                    client.user = null; // Cliente anónimo
                }
            } else {
                this.logger.log(`🔓 Cliente anónimo conectado: ${client.id}`);
                client.user = null;
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
        @MessageBody() data: {
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
            client.emit('error', { message: 'El mensaje no puede estar vacío.', code: 'BAD_REQUEST', chatId });
            return;
        }

        // Guardar la preferencia de broadcast para este chat
        const broadcast = data.broadcast !== false; // default true
        this.chatBroadcast.set(chatId, broadcast);

        this.logger.log(`📡 Broadcast(${chatId}) = ${broadcast ? 'SALA' : 'SOLO_EMISOR'}`);

        // ✅ ACK inmediato (el cliente ya no depende de esto para la UX)
        if (typeof callback === 'function') {
            callback({ status: 'ok', message: 'Mensaje recibido' });
        } else {
            this.logger.warn('⚠️ No vino callback de ACK (client.timeout?)');
        }

        // Procesar en background
        this.processMessageInBackground(client, data, client.user?.sub, chatId, message);
    }

    private ensureJoined(client: AuthSocket, roomId: string) {
        if (!client.rooms.has(roomId)) {
            client.join(roomId);
        }
    }

    /** Emite según flag: broadcast=true -> sala; false -> solo emisor */
    private emitChat(
        client: AuthSocket,
        chatId: string,
        event: string,
        payload: any,
    ) {
        const broadcast = this.chatBroadcast.get(chatId) ?? true;
        if (broadcast) {
            this.server.to(chatId).emit(event, payload);
        } else {
            // Siempre garantizamos que el emisor lo reciba
            client.emit(event, payload);
        }
    }

    private async processMessageInBackground(
        client: AuthSocket,
        data: any,
        userId: string | undefined,
        chatId: string,
        message: string
    ) {
        try {
            this.logger.log(`📤 Payload recibido de ${client.id}:`, JSON.stringify(data, null, 2));
            this.logger.log(`📤 Mensaje extraído: "${message}"`);

            // 1) Límites (si autenticado)
            if (userId) {
                const canSend = await this.usageService.canSendMessage(userId);
                if (!canSend.allowed) {
                    // Emitimos solo al usuario actual por su socket id
                    this.server.to(client.id).emit('error', {
                        message: 'Has alcanzado tu límite de mensajes por día.',
                        code: 'LIMIT_EXCEEDED',
                        chatId,
                    });
                    return;
                }
            }

            // 2) Únete (y garantiza unión) a la sala del chat (incluye emisor)
            this.ensureJoined(client, chatId);

            // 3) Generar stream IA con batching
            const model = data.model || 'deepseek-r1:7b';

            // 4) Guarda mensaje del usuario si aplica
            if (userId) {
                await this.chatService.saveUserMessageToChat(chatId, userId, message, model);
            }

            // 5) Notifica inicio de respuesta (según flag de broadcast)
            this.emitChat(client, chatId, 'responseStart', {
                chatId,
                content: 'Pensando...',
                timestamp: new Date().toISOString(),
            });

            // 6) Historial (si autenticado)
            const history = userId ? await this.chatService.getChatHistory(chatId) : [];
            const messages = [...history, { role: 'user' as const, content: message }];
            let fullContent = '';
            let chunkCount = 0;

            // === Buffer de envío ===
            let buffer = '';
            let aborted = false;

            const flush = () => {
                if (!buffer || aborted) return;
                this.emitChat(client, chatId, 'responseChunk', {
                    chatId,
                    content: buffer,
                    timestamp: new Date().toISOString(),
                });
                buffer = '';
            };

            // flush cada 60ms
            const flushTimer = setInterval(flush, 60);

            // abortar si el cliente se desconecta (no sigas consumiendo CPU)
            const onDisconnect = (reason: string) => {
                aborted = true;
                this.logger.warn(`⚠️ Cliente desconectado durante stream: ${client.id} (${reason})`);
            };
            client.once('disconnect', onDisconnect);

            try {
                const stream = this.ollamaService.generateStream(messages, model);

                // Pegador inteligente para espacios
                const isAlphaNum = (ch: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(ch);
                const needsSpaceBetween = (a: string, b: string) => {
                    if (!a || !b) return false;
                    const last = a[a.length - 1];
                    const first = b[0];
                    // si el chunk ya trae espacio/nueva línea, no hacemos nada
                    if (first === ' ' || first === '\n' || first === '\t') return false;
                    // no ponemos espacio antes de puntuación
                    if (/[.,;:!?)]/.test(first)) return false;
                    // si el anterior termina con apertura o salto, tampoco
                    if (/[(\n\t ]/.test(last)) return false;
                    // letra/número pegado a letra/número → sí espacio
                    return isAlphaNum(last) && isAlphaNum(first);
                };

                for await (const chunk of stream) {
                    if (aborted) break;
                    const piece = chunk?.content ?? '';
                    if (!piece) continue;

                    // Filtrar pensamiento
                    const cleanPiece = this.stripThink(piece);
                    if (!cleanPiece) continue;

                    // pega con espacio solo si hace falta
                    const glue = needsSpaceBetween(fullContent, cleanPiece) ? ' ' : '';

                    fullContent += glue + cleanPiece;
                    buffer += glue + cleanPiece;
                    chunkCount++;

                    // flush por tamaño también
                    if (buffer.length >= 800) flush();

                    if (chunkCount % 50 === 0) {
                        this.logger.log(`📥 Chunk ${chunkCount} (batched) para ${chatId}`);
                    }
                }

                // flush final
                flush();
                clearInterval(flushTimer);
                client.off('disconnect', onDisconnect);

                if (aborted) {
                    this.logger.warn(`⚠️ Stream abortado (cliente desconectado) ${chatId} tras ${chunkCount} chunks`);
                    return; // opcional: persistir parcial o no
                }

                this.logger.log(`✅ Stream completado para ${chatId} (${chunkCount} chunks batched)`);
            } catch (streamError) {
                clearInterval(flushTimer);
                client.off('disconnect', onDisconnect);
                this.logger.error(`❌ Error en stream para ${chatId}:`, streamError);

                // Error del stream → informar según flag de broadcast
                this.emitChat(client, chatId, 'error', {
                    message: 'Error generando respuesta. Intenta nuevamente.',
                    code: 'STREAM_ERROR',
                    chatId,
                });
                return;
            }

            // 8) Persistir mensaje del assistant y uso (contenido ya limpio)
            if (userId) {
                await this.chatService.saveAssistantMessageToChat(chatId, userId, fullContent, model);
                await this.usageService.incrementMessageCount(0, userId);
            } else {
                await this.chatService.saveAssistantMessageToChat(chatId, null, fullContent, model);
                const anonymousId = chatId;
                await this.usageService.incrementMessageCount(0, undefined, anonymousId);
            }

            // 9) Final de respuesta (según flag de broadcast)
            this.emitChat(client, chatId, 'responseEnd', {
                chatId,
                fullContent,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`✅ Respuesta completada para ${chatId} (${chunkCount} chunks)`);
        } catch (error) {
            this.logger.error(`❌ Error en sendMessage para ${chatId}:`, error);

            // Mensaje de error directo al socket emisor (no a toda la sala)
            this.server.to(client.id).emit('error', {
                message: 'Error al procesar mensaje. Intenta nuevamente.',
                code: 'PROCESSING_ERROR',
                chatId,
            });
        }
    }

    @SubscribeMessage('joinChat')
    async handleJoinChat(
        @MessageBody() data: { chatId: string },
        @ConnectedSocket() client: AuthSocket,
    ) {
        const { chatId } = data;
        client.join(chatId);
        this.logger.log(`👥 Cliente ${client.id} se unió al chat: ${chatId}`);

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

    private extractTokenFromSocket(client: Socket): string | undefined {
        // Intentar extraer token de diferentes lugares
        const auth = client.handshake?.auth;
        const query = client.handshake?.query;
        const headers = client.handshake?.headers;

        // 1. De auth.token
        if (auth?.token && typeof auth.token === 'string') {
            return auth.token;
        }

        // 2. De query.token
        if (query?.token && typeof query.token === 'string') {
            return query.token;
        } else if (Array.isArray(query?.token) && query.token.length > 0) {
            return query.token[0];
        }

        // 3. De Authorization header (SAFE: check type)
        const authHeader = headers?.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7); // Línea 76: ahora safe
        } else if (Array.isArray(authHeader) && authHeader.length > 0) {
            const headerStr = authHeader[0];
            if (typeof headerStr === 'string' && headerStr.startsWith('Bearer ')) {
                return headerStr.substring(7);
            }
        }

        // 4. De cookie (si está disponible)
        const cookieHeader = headers?.cookie;
        if (typeof cookieHeader === 'string') {
            const cookies = this.parseCookies(cookieHeader);
            return cookies['access_token'] || cookies['token'];
        }

        return undefined;
    }

    private parseCookies(cookieString: string): Record<string, string> {
        const cookies: Record<string, string> = {};

        cookieString.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[name] = decodeURIComponent(value);
            }
        });

        return cookies;
    }

    // Helper para limpiar contenido de R1
    private stripThink(text: string): string {
        return text.replace(/<think>[\s\S]*?<\/think>/g, '');
    }

    // ========== EVENTOS DE SESIÓN DE CHAT ==========

    @SubscribeMessage('newChat')
    async handleNewChat(
        @ConnectedSocket() client: AuthSocket,
        @MessageBody() data: { title?: string }
    ) {
        try {
            const session = await this.chatService.createChat(
                client.user?.sub ?? null,
                data?.title
            );

            // El cliente se une a la sala
            this.ensureJoined(client, session.id);
            client.emit('joinedChat', { chatId: session.id });

            this.logger.log(`Nuevo chat creado: ${session.id} para usuario: ${client.user?.sub || 'anónimo'}`);
            return session;
        } catch (error) {
            this.logger.error('Error creando nuevo chat:', error);
            client.emit('error', {
                message: 'Error creando nuevo chat',
                code: 'CHAT_CREATE_ERROR'
            });
        }
    }

    @SubscribeMessage('listChats')
    async handleListChats(@ConnectedSocket() client: AuthSocket) {
        try {
            const sessions = await this.chatService.listChats(client.user?.sub ?? null);
            client.emit('chatsListed', sessions);

            this.logger.log(`Listando ${sessions.length} chats para usuario: ${client.user?.sub || 'anónimo'}`);
        } catch (error) {
            this.logger.error('Error listando chats:', error);
            client.emit('error', {
                message: 'Error listando chats',
                code: 'CHAT_LIST_ERROR'
            });
        }
    }

    @SubscribeMessage('renameChat')
    async handleRenameChat(
        @MessageBody() data: { chatId: string; title: string },
        @ConnectedSocket() client: AuthSocket,
    ) {
        try {
            await this.chatService.renameChat(
                data.chatId,
                data.title,
                client.user?.sub ?? null
            );

            client.emit('chatRenamed', {
                chatId: data.chatId,
                title: data.title
            });

            this.logger.log(`Chat renombrado: ${data.chatId} -> "${data.title}"`);
        } catch (error) {
            this.logger.error('Error renombrando chat:', error);
            client.emit('error', {
                message: 'Error renombrando chat',
                code: 'CHAT_RENAME_ERROR'
            });
        }
    }

    @SubscribeMessage('deleteChat')
    async handleDeleteChat(
        @MessageBody() data: { chatId: string },
        @ConnectedSocket() client: AuthSocket,
    ) {
        try {
            await this.chatService.deleteChat(
                data.chatId,
                client.user?.sub ?? null
            );

            client.emit('chatDeleted', { chatId: data.chatId });

            this.logger.log(`Chat eliminado: ${data.chatId}`);
        } catch (error) {
            this.logger.error('Error eliminando chat:', error);
            client.emit('error', {
                message: 'Error eliminando chat',
                code: 'CHAT_DELETE_ERROR'
            });
        }
    }

    @SubscribeMessage('getHistory')
    async handleGetHistory(
        @MessageBody() data: { chatId: string; limit?: number; cursor?: string },
        @ConnectedSocket() client: AuthSocket,
    ) {
        try {
            const history = await this.chatService.getChatHistory(
                data.chatId,
                data.limit || 100,
                data.cursor
            );

            client.emit('history', {
                chatId: data.chatId,
                messages: history
            });

            this.logger.log(`Historial enviado para chat: ${data.chatId} (${history.length} mensajes)`);
        } catch (error) {
            this.logger.error('Error obteniendo historial:', error);
            client.emit('error', {
                message: 'Error obteniendo historial',
                code: 'HISTORY_ERROR'
            });
        }
    }
}

