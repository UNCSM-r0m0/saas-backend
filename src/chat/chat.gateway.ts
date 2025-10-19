import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    WsException,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { DeepSeekService } from '../deepseek/deepseek.service';
import { UsageService } from '../usage/usage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { WsEmitterService } from '../common/ws/ws-emitter.service';

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
    pingTimeout: 120000,       // 2 minutos para modelos lentos
    pingInterval: 25000,       // default ok
    perMessageDeflate: false,  // MUY importante con proxys
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer() server: Server;

    // chatId -> broadcast?
    private chatBroadcast = new Map<string, boolean>();
    // Active stream cancel handlers by messageId
    private activeStreams = new Map<string, () => void>();
    // --- Concurrency control (global and per-user) ---
    private globalActive = 0;
    private userActive = new Map<string, number>();
    private waitQueue: Array<{ userKey: string; resolve: (release: () => void) => void; created: number }> = [];
    private readonly MAX_GLOBAL = Number(process.env.CHAT_MAX_CONCURRENCY ?? 2);
    private readonly MAX_PER_USER = Number(process.env.CHAT_MAX_STREAMS_PER_USER ?? 1);
    private readonly QUEUE_TIMEOUT_MS = Number(process.env.CHAT_QUEUE_TIMEOUT_MS ?? 8000);
    private readonly QUEUE_MAX_WAITERS = Number(process.env.CHAT_QUEUE_MAX_WAITERS ?? 50);

    constructor(
        private chatService: ChatService,
        private ollamaService: OllamaService,
        private geminiService: GeminiService,
        private openaiService: OpenAIService,
        private deepseekService: DeepSeekService,
        private usageService: UsageService,
        private jwtService: JwtService,
        private wsEmitter: WsEmitterService,
    ) { }

    afterInit(server: Server) {
        // Disponibiliza el server para emisores globales (Stripe -> WS)
        try { this.wsEmitter.setServer(server); } catch { }
    }

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
                    try { client.join(`user:${payload.sub}`); } catch { }
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

    // ===== Concurrency helpers =====
    private canStart(userKey: string) {
        const ua = this.userActive.get(userKey) || 0;
        return this.globalActive < this.MAX_GLOBAL && ua < this.MAX_PER_USER;
    }

    private tryDrainQueue() {
        for (let i = 0; i < this.waitQueue.length; i++) {
            const t = this.waitQueue[i];
            if (this.canStart(t.userKey)) {
                this.waitQueue.splice(i, 1);
                this.globalActive++;
                this.userActive.set(t.userKey, (this.userActive.get(t.userKey) || 0) + 1);
                t.resolve(() => this.releaseSlot(t.userKey));
                break;
            }
        }
    }

    private releaseSlot(userKey: string) {
        this.globalActive = Math.max(0, this.globalActive - 1);
        this.userActive.set(userKey, Math.max(0, (this.userActive.get(userKey) || 1) - 1));
        this.tryDrainQueue();
    }

    private async acquireSlot(userKey: string): Promise<() => void> {
        if (this.canStart(userKey)) {
            this.globalActive++;
            this.userActive.set(userKey, (this.userActive.get(userKey) || 0) + 1);
            return () => this.releaseSlot(userKey);
        }
        if (this.waitQueue.length >= this.QUEUE_MAX_WAITERS) {
            throw new WsException('SERVER_BUSY');
        }
        return await new Promise<() => void>((resolve, reject) => {
            const ticket = { userKey, resolve, created: Date.now() };
            this.waitQueue.push(ticket);
            setTimeout(() => {
                const idx = this.waitQueue.indexOf(ticket);
                if (idx >= 0) this.waitQueue.splice(idx, 1);
                reject(new WsException('SERVER_BUSY_TIMEOUT'));
            }, this.QUEUE_TIMEOUT_MS);
        });
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
            const room = this.server.sockets.adapter.rooms.get(chatId);
            const clientCount = room ? room.size : 0;
            this.logger.log(`📡 [EMIT] ${event} → sala ${chatId} (${clientCount} clientes)`);
            this.server.to(chatId).emit(event, payload);
        } else {
            // Siempre garantizamos que el emisor lo reciba
            this.logger.log(`📡 [EMIT] ${event} → cliente ${client.id}`);
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
            this.logger.log(`STREAM input from ${client.id}`, JSON.stringify(data, null, 2));
            this.logger.log(`STREAM extracted message: "${message}"`);

            // 1) Límites (si autenticado)
            if (userId) {
                const canSend = await this.usageService.canSendMessage(userId);
                if (!canSend.allowed) {
                    this.server.to(client.id).emit('error', {
                        message: 'Has alcanzado tu límite de mensajes por día.',
                        code: 'LIMIT_EXCEEDED',
                        chatId,
                    });
                    return;
                }
            }

            // 2) Únete a la sala del chat (incluye emisor)
            this.ensureJoined(client, chatId);

            // 3) Generar stream IA (con control de concurrencia)
            const model = data.model || 'deepseek-r1:7b';
            const userKey = (userId ?? `anon:${client.id}`);
            let release: (() => void) | null = null;
            try {
                release = await this.acquireSlot(userKey);
            } catch {
                this.server.to(client.id).emit('error', {
                    message: 'Servidor ocupado, intenta en unos segundos.',
                    code: 'SERVER_BUSY',
                    chatId,
                });
                return;
            }

            // 4) Garantiza que el chat exista antes de guardar mensaje
            if (userId) {
                const existingChat = await this.chatService['prisma'].chat.findUnique({
                    where: { id: chatId }
                });
                if (!existingChat) {
                    await this.chatService['prisma'].chat.create({
                        data: {
                            id: chatId,
                            ownerId: userId,
                            isAnonymous: false,
                            title: 'New chat',
                        },
                    });
                }
                await this.chatService.saveUserMessageToChat(chatId, userId, message, model);
            }

            // 5) Inicio de respuesta
            const messageId = randomUUID ? randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            this.emitChat(client, chatId, 'responseStart', {
                chatId,
                messageId,
                content: 'Pensando...',
                timestamp: new Date().toISOString(),
            });
            this.logger.log(`📤 [START] Enviando responseStart a sala ${chatId}`);

            // 6) Historial
            const history = userId ? await this.chatService.getChatHistory(chatId) : [];
            const messages = [...history, { role: 'user' as const, content: message }];

            let fullContent = '';
            let fullThought = '';
            let chunkCount = 0;
            let seq = 0;

            // Buffer y estado
            let buffer = '';
            let aborted = false;
            let openCodeBlock = false;
            let openCodeLang: string | null = null;
            let openMathBlock = false; // para $$ ... $$

            const updateAssemblerState = (text: string) => {
                let i = 0;
                while (i < text.length) {
                    if (text.startsWith('```', i)) {
                        if (!openCodeBlock) {
                            const nl = text.indexOf('\n', i + 3);
                            const fenceLine = text.slice(i + 3, nl === -1 ? text.length : nl).trim();
                            openCodeLang = fenceLine.split(/\s+/)[0] || null;
                        } else {
                            openCodeLang = null;
                        }
                        openCodeBlock = !openCodeBlock;
                        i += 3;
                        continue;
                    }
                    if (!openCodeBlock && text.startsWith('$$', i)) {
                        openMathBlock = !openMathBlock;
                        i += 2;
                        continue;
                    }
                    i++;
                }
            };

            const flush = (force = false) => {
                if (!buffer || aborted) return;
                const inBlock = openCodeBlock || openMathBlock;
                if (inBlock && !force && buffer.length < 400) return;
                const payload: any = {
                    chatId,
                    messageId,
                    seq: ++seq,
                    partial: true,
                    content: buffer,
                    contentType: openCodeBlock ? 'code' : 'markdown',
                    lang: openCodeBlock ? (openCodeLang || undefined) : undefined,
                    timestamp: new Date().toISOString(),
                };
                this.emitChat(client, chatId, 'responseChunk', payload);
                this.logger.log(`📤 [CHUNK ${seq}] Enviando a sala ${chatId}: ${payload.content.substring(0, 50)}...`);
                buffer = '';
            };

            const flushTimer = setInterval(() => flush(false), 60);

            const onDisconnect = (reason: string) => {
                aborted = true;
                this.logger.warn(`Client disconnected during stream: ${client.id} (${reason})`);
            };
            client.once('disconnect', onDisconnect);
            this.activeStreams.set(messageId, () => { aborted = true; });

            try {
                let stream: AsyncIterable<any>;

                if (model === 'gemini') {
                    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
                    stream = await this.geminiService.generateStreamingResponse(prompt);
                } else if (model === 'openai') {
                    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
                    stream = await this.openaiService.generateStreamingResponse(prompt, model);
                } else if (model === 'deepseek') {
                    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
                    const response = await this.deepseekService.generateResponse(prompt, model);
                    stream = (async function* () {
                        yield { content: response.response };
                    })();
                } else {
                    // Determinar el modelo específico de Ollama si viene con prefijo 'ollama-'
                    let ollamaModel = model;
                    if (model.startsWith('ollama-')) {
                        ollamaModel = model.replace('ollama-', '');
                    } else if (model === 'ollama') {
                        ollamaModel = 'deepseek-r1:7b'; // Modelo por defecto
                    }
                    stream = this.ollamaService.generateStream(messages, ollamaModel);
                }

                // Procesador R1 incremental
                const makeR1Processor = () => {
                    let inThink = false;
                    return (chunk: string) => {
                        let i = 0;
                        let thought = '';
                        let resp = '';
                        const startTag = '<think>';
                        const endTag = '</think>';
                        while (i < chunk.length) {
                            if (!inThink) {
                                const j = chunk.indexOf(startTag, i);
                                if (j === -1) { resp += chunk.slice(i); break; }
                                resp += chunk.slice(i, j);
                                i = j + startTag.length;
                                inThink = true;
                            } else {
                                const k = chunk.indexOf(endTag, i);
                                if (k === -1) { thought += chunk.slice(i); break; }
                                thought += chunk.slice(i, k);
                                i = k + endTag.length;
                                inThink = false;
                            }
                        }
                        return { thought, response: resp };
                    };
                };
                const processR1 = makeR1Processor();

                for await (const chunk of stream) {
                    if (aborted) break;
                    const piece = typeof chunk === 'string' ? chunk : (chunk?.content ?? '');
                    if (!piece) continue;

                    const processed = processR1(piece);

                    if (processed.thought) {
                        fullThought += processed.thought;
                    }

                    if (processed.response) {
                        buffer += processed.response;
                        fullContent += processed.response;
                        updateAssemblerState(processed.response);
                        chunkCount++;
                        if (buffer.length >= 800) flush(true);
                        if (chunkCount % 50 === 0) {
                            this.logger.log(`Chunk ${chunkCount} (batched) for ${chatId}`);
                        }
                    }
                }

                flush(true);
                clearInterval(flushTimer);
                client.off('disconnect', onDisconnect);
                if (release) release();
                this.activeStreams.delete(messageId);

                if (aborted) {
                    this.logger.warn(`Stream aborted (client disconnected) ${chatId} after ${chunkCount} chunks`);
                    return;
                }

                this.logger.log(`Stream completed for ${chatId} (${chunkCount} chunks batched)`);
            } catch (streamError) {
                clearInterval(flushTimer);
                client.off('disconnect', onDisconnect);
                if (release) release();
                this.activeStreams.delete(messageId);
                this.logger.error(`Error in stream for ${chatId}:`, streamError);

                this.emitChat(client, chatId, 'error', {
                    message: 'Error generando respuesta. Intenta nuevamente.',
                    code: 'STREAM_ERROR',
                    chatId,
                    messageId,
                });
                return;
            }

            // 8) Persistir mensaje del assistant
            const messageToSave = fullThought.trim()
                ? `**Pensamiento:** ${fullThought.trim()}\n\n**Respuesta:** ${fullContent}`
                : fullContent;

            if (userId) {
                await this.chatService.saveAssistantMessageToChat(chatId, userId, messageToSave, model);
                await this.usageService.incrementMessageCount(0, userId);
            } else {
                await this.chatService.saveAssistantMessageToChat(chatId, null, messageToSave, model);
                const anonymousId = chatId;
                await this.usageService.incrementMessageCount(0, undefined, anonymousId);
            }

            // 9) Final de respuesta
            this.emitChat(client, chatId, 'responseEnd', {
                chatId,
                messageId,
                fullContent,
                totalChunks: chunkCount,
                finished: true,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`📤 [END] Enviando responseEnd a sala ${chatId} (${chunkCount} chunks)`);
            this.logger.log(`✅ Respuesta completada para ${chatId} (${chunkCount} chunks)`);
            if (release) release();
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
            this.logger.log(`Stream cancelled by ${client.id} (messageId=${messageId})`);
        }
    }

    @SubscribeMessage('joinChat')
    async handleJoinChat(
        @MessageBody() data: { chatId: string },
        @ConnectedSocket() client: AuthSocket,
    ) {
        const { chatId } = data;
        client.join(chatId);

        const room = this.server.sockets.adapter.rooms.get(chatId);
        const clientCount = room ? room.size : 0;
        this.logger.log(`👥 Cliente ${client.id} se unió al chat: ${chatId} (${clientCount} clientes en sala)`);

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

    // Helper para R1 (versión simple; preserva formato)
    private processR1Content(text: string): { thought: string; response: string; cleanResponse: string } {
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
        const thought = thinkMatch ? (thinkMatch[1] ?? '') : '';
        const response = text.replace(/<think>[\s\S]*?<\/think>/g, '');
        const cleanResponse = response; // no colapsar espacios ni saltos de línea
        return { thought, response, cleanResponse };
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
            const history = await this.chatService.getChatHistory(data.chatId);

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

