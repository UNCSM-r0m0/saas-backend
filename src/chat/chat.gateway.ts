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
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer() server: Server;

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

            // Agregar listener para cualquier evento
            client.onAny((eventName, ...args) => {
                this.logger.log(`🎯 EVENTO RECIBIDO: ${eventName} de ${client.id}`, args);
            });

            // Listener específico para sendMessage
            client.on('sendMessage', (data) => {
                this.logger.log(`🎯 SENDMESSAGE RECIBIDO de ${client.id}:`, data);
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
        @MessageBody() data: any,
        @ConnectedSocket() client: AuthSocket,
        callback: (ack: { status: 'ok' | 'error'; message?: string }) => void,
    ) {
        this.logger.log(`🎯 MÉTODO handleSendMessage EJECUTADO para ${client.id}`);

        const chatId = data.chatId || `anonymous-${client.id}`;
        const message = (data.message || data.content || '').trim();

        if (!message) {
            callback({ status: 'error', message: 'El mensaje no puede estar vacío.' });
            return;
        }

        // ✅ ACK nativo de Socket.IO
        callback({ status: 'ok', message: 'Mensaje recibido' });

        // Procesar en background
        this.processMessageInBackground(client, data, client.user?.sub, chatId, message);
    }

    private ensureJoined(client: AuthSocket, roomId: string) {
        // En Socket.IO v4, client.rooms es un Set
        if (!client.rooms.has(roomId)) {
            client.join(roomId);
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

            // 3) Guarda mensaje del usuario si aplica
            if (userId) {
                await this.chatService.saveUserMessage(chatId, userId, message);
            }

            // 4) Notifica inicio de respuesta (a todos en la sala, incluido emisor)
            this.server.to(chatId).emit('responseStart', {
                chatId,
                content: 'Pensando...',
                timestamp: new Date().toISOString(),
            });

            // 5) Historial (si autenticado)
            const history = userId ? await this.chatService.getConversationHistory(chatId) : [];
            const messages = [...history, { role: 'user' as const, content: message }];

            // 6) Generar stream IA
            const model = data.model || 'deepseek-r1:7b';
            let fullContent = '';
            let chunkCount = 0;

            try {
                const stream = this.ollamaService.generateStream(messages, model);

                for await (const chunk of stream) {
                    if (chunk?.content) {
                        fullContent += chunk.content;
                        chunkCount++;

                        // 7) Emitir chunk al chat (incluye emisor)
                        this.server.to(chatId).emit('responseChunk', {
                            chatId,
                            content: chunk.content,
                            timestamp: new Date().toISOString(),
                        });

                        if (chunkCount % 25 === 0) {
                            this.logger.log(`📥 Chunk ${chunkCount} enviado para ${chatId}`);
                        }
                    }
                }

                this.logger.log(`✅ Stream completado para ${chatId} (${chunkCount} chunks)`);
            } catch (streamError) {
                this.logger.error(`❌ Error en stream para ${chatId}:`, streamError);

                // Error del stream → informar a esa sala
                this.server.to(chatId).emit('error', {
                    message: 'Error generando respuesta. Intenta nuevamente.',
                    code: 'STREAM_ERROR',
                    chatId,
                });
                return;
            }

            // 8) Persistir mensaje del assistant y uso
            if (userId) {
                await this.chatService.saveAssistantMessage(chatId, userId, fullContent);
                await this.usageService.incrementMessageCount(0, userId);
            } else {
                await this.chatService.saveAssistantMessage(chatId, null, fullContent);
                const anonymousId = chatId;
                await this.usageService.incrementMessageCount(0, undefined, anonymousId);
            }

            // 9) Final de respuesta (incluye emisor)
            this.server.to(chatId).emit('responseEnd', {
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
}
