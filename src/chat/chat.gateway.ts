import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
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
    ) {
        const userId = client.user?.sub; // Del JWT
        const chatId = data.chatId || `anonymous-${client.id}`;
        const message = data.message || data.content || '';

        // Validar que el mensaje no esté vacío
        if (!message || message.trim() === '') {
            this.logger.warn(`❌ Mensaje vacío recibido de ${client.id}`);
            client.emit('error', {
                message: 'El mensaje no puede estar vacío.',
                code: 'EMPTY_MESSAGE',
                chatId
            });
            return;
        }

        // 0. Enviar ACK inmediato al cliente ANTES de procesar
        const ackResponse = { status: 'ok', message: 'Mensaje recibido' };

        // Procesar en background sin bloquear el ACK
        this.processMessageInBackground(client, data, userId, chatId, message);

        // Enviar ACK usando emit directo
        client.emit('sendMessage', ackResponse);
    }

    private async processMessageInBackground(
        client: AuthSocket,
        data: any,
        userId: string | undefined,
        chatId: string,
        message: string
    ) {
        try {
            // Debug: Log completo del payload recibido
            this.logger.log(`📤 Payload recibido de ${client.id}:`, JSON.stringify(data, null, 2));
            this.logger.log(`📤 Mensaje extraído: "${message}"`);

            // 1. Validar límites si está autenticado
            if (userId) {
                const canSend = await this.usageService.canSendMessage(userId);
                if (!canSend.allowed) {
                    client.emit('error', {
                        message: 'Has alcanzado tu límite de mensajes por día.',
                        code: 'LIMIT_EXCEEDED'
                    });
                    return;
                }
            }

            // 2. Unirse a la sala del chat
            client.join(chatId);

            // 3. Guardar mensaje del usuario si está autenticado
            if (userId) {
                await this.chatService.saveUserMessage(chatId, userId, message);
            }

            // 4. Emitir "pensando..." inmediatamente
            client.to(chatId).emit('responseStart', {
                chatId,
                content: 'pensando...',
                timestamp: new Date().toISOString()
            });

            // 5. Obtener historial de conversación
            const history = userId ? await this.chatService.getConversationHistory(chatId) : [];
            const messages = [
                ...history,
                { role: 'user' as const, content: message }
            ];

            // 6. Generar stream de IA
            const model = data.model || 'deepseek-r1:7b';
            let fullContent = '';
            let chunkCount = 0;

            try {
                const stream = this.ollamaService.generateStream(messages, model);

                // 7. Emitir evento de inicio de respuesta
                client.to(chatId).emit('responseStart', {
                    chatId,
                    content: 'Pensando...',
                    timestamp: new Date().toISOString()
                });

                // 8. Procesar stream y emitir chunks
                for await (const chunk of stream) {
                    if (chunk.content) {
                        fullContent += chunk.content;
                        chunkCount++;

                        // Emitir chunk al cliente
                        client.to(chatId).emit('responseChunk', {
                            chatId,
                            content: chunk.content,
                            timestamp: new Date().toISOString()
                        });

                        // Log cada 5 chunks para debug
                        if (chunkCount % 5 === 0) {
                            this.logger.log(`📥 Chunk ${chunkCount} enviado para ${chatId}: "${chunk.content}"`);
                        }
                    }
                }

                this.logger.log(`✅ Stream completado para ${chatId} (${chunkCount} chunks)`);

            } catch (streamError) {
                this.logger.error(`❌ Error en stream para ${chatId}:`, streamError);

                // Emitir error al cliente
                client.to(chatId).emit('error', {
                    message: 'Error generando respuesta. Intenta nuevamente.',
                    code: 'STREAM_ERROR',
                    chatId
                });
                return;
            }

            // 9. Guardar mensaje del assistant y finalizar
            if (userId) {
                await this.chatService.saveAssistantMessage(chatId, userId, fullContent);
                await this.usageService.incrementMessageCount(0, userId);
            } else {
                // Para usuarios anónimos, usar anonymousId basado en el socket ID
                const anonymousId = `anonymous-${client.id}`;
                await this.usageService.incrementMessageCount(0, undefined, anonymousId);
            }

            client.to(chatId).emit('responseEnd', {
                chatId,
                fullContent,
                timestamp: new Date().toISOString()
            });

            this.logger.log(`✅ Respuesta completada para ${chatId} (${chunkCount} chunks)`);

        } catch (error) {
            this.logger.error(`❌ Error en sendMessage para ${chatId}:`, error);

            client.emit('error', {
                message: 'Error al procesar mensaje. Intenta nuevamente.',
                code: 'PROCESSING_ERROR',
                chatId
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
        if (auth?.token) {
            return auth.token;
        }

        // 2. De query.token
        if (query?.token) {
            return Array.isArray(query.token) ? query.token[0] : query.token;
        }

        // 3. De Authorization header
        if (headers?.authorization) {
            const authHeader = headers.authorization as string;
            if (authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
        }

        // 4. De cookie (si está disponible)
        if (headers?.cookie) {
            const cookies = this.parseCookies(headers.cookie as string);
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
