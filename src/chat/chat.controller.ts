import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    Req,
    Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageService } from '../usage/usage.service';
import { JwtService } from '@nestjs/jwt';
import { DeepSeekService } from '../deepseek/deepseek.service';
import { getUserIdFromReq, getUserIdFromAuthHeader } from '../common/utils/auth.util';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly ollamaService: OllamaService,
        private readonly geminiService: GeminiService,
        private readonly openaiService: OpenAIService,
        private readonly deepseekService: DeepSeekService,
        private readonly subscriptionsService: SubscriptionsService,
        private readonly usageService: UsageService,
    ) { }

    // MÃ‰TODO ELIMINADO: getChats() - duplicado con listConversations()
    // Usar /api/chat/conversations en su lugar

    /**
     * Crear un nuevo chat
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Crear un nuevo chat',
        description: 'Crea un nuevo chat para el usuario autenticado',
    })
    @ApiResponse({
        status: 201,
        description: 'Chat creado exitosamente',
        schema: {
            type: 'object',
            properties: {
                chat: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        model: { type: 'string' },
                        messages: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    role: { type: 'string' },
                                    content: { type: 'string' },
                                    createdAt: { type: 'string' },
                                },
                            },
                        },
                        createdAt: { type: 'string' },
                        updatedAt: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth('JWT-auth')
    async createChat(@Body() createChatDto: any, @Req() req: any) {
        const userId = getUserIdFromReq(req);
        const chat = await this.chatService.createChat(userId, createChatDto?.title);
        return {
            success: true,
            data: chat,
            message: 'Chat creado exitosamente'
        };
    }

    // ENDPOINT ELIMINADO: /api/chat/models
    // Usar /api/models/public en su lugar para evitar duplicaciÃ³n

    // ENDPOINT ELIMINADO: /api/chat (duplicado con /api/chat/conversations)
    // Usar /api/chat/conversations en su lugar

    /**
     * Obtener un chat especÃ­fico con sus mensajes
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Obtener un chat especÃ­fico',
        description: 'Retorna un chat especÃ­fico con todos sus mensajes',
    })
    @ApiResponse({
        status: 200,
        description: 'Chat obtenido exitosamente',
        schema: {
            type: 'object',
            properties: {
                chat: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        model: { type: 'string' },
                        messages: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    role: { type: 'string' },
                                    content: { type: 'string' },
                                    createdAt: { type: 'string' },
                                },
                            },
                        },
                        createdAt: { type: 'string' },
                        updatedAt: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth('JWT-auth')
    async getChat(@Param('id') id: string, @Req() req: any) {
        const userId = getUserIdFromReq(req);

        if (!userId) {
            return {
                success: false,
                message: 'Usuario no autenticado'
            };
        }

        try {
            const conversation = await this.chatService.getChat(id, userId);

            if (!conversation) {
                return {
                    success: false,
                    message: 'Chat no encontrado'
                };
            }

            // Convertir a formato esperado por el frontend
            const chatData = {
                id: conversation.id,
                title: conversation.title,
                model: 'ollama', // Por defecto
                messages: conversation.messages.map(msg => ({
                    id: msg.id,
                    role: msg.role.toLowerCase(),
                    content: msg.content,
                    createdAt: msg.createdAt,
                })),
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            };

            return {
                success: true,
                data: chatData,
                message: 'Chat obtenido exitosamente'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Error al obtener chat'
            };
        }
    }

    /**
     * Enviar mensaje (anÃ³nimos y registrados)
     */
    @Post('message')
    @Public() // Permitir acceso pÃºblico para usuarios anÃ³nimos
    @ApiOperation({
        summary: 'Enviar mensaje al chat',
        description:
            'Usuarios anÃ³nimos: 3 mensajes/dÃ­a sin historial. Registrados: 50 mensajes/dÃ­a con historial. Premium: 1000 mensajes/dÃ­a + imÃ¡genes.',
    })
    @ApiResponse({
        status: 200,
        description: 'Respuesta del chat',
        type: ChatResponseDto,
    })
    @ApiResponse({
        status: 403,
        description: 'LÃ­mite de mensajes alcanzado',
    })
    @ApiBody({ type: SendMessageDto })
    async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
        // Obtener userId si estÃ¡ autenticado (opcional)
        let userId = getUserIdFromReq(req);
        if (!userId) {
            userId = getUserIdFromAuthHeader(req.headers?.authorization);
        }
        return this.chatService.sendMessage(dto, userId || undefined);
    }

    /**
     * Enviar mensaje (solo usuarios registrados con JWT)
     */

    /**
     * Streaming via SSE (HTTP) para anónimos y registrados.
     * Emite chunks con 'data: {"content":"..."}' y finaliza con 'data: {"finished":true}'.
     */
    @Post('message/stream')
    @Public()
    @ApiOperation({ summary: 'Enviar mensaje con streaming (SSE)' })
    @ApiResponse({ status: 200, description: 'Stream iniciado' })
    @ApiBody({ type: SendMessageDto })
    async streamMessage(
        @Body() dto: SendMessageDto,
        @Req() req: any,
        @Res() res: Response,
    ) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        let userId = getUserIdFromReq(req);
        if (!userId) {
            userId = getUserIdFromAuthHeader(req.headers?.authorization);
        }

        const canSend = await this.usageService.canSendMessage(
            userId || undefined,
            userId ? undefined : dto.anonymousId,
        );
        if (!canSend.allowed) {
            res.write(`data: ${JSON.stringify({ error: 'LIMIT_EXCEEDED', message: 'Has alcanzado tu límite de mensajes por día.' })}\n\n`);
            return res.end();
        }

        let tier = 'FREE' as any;
        if (userId) {
            const sub = await this.subscriptionsService.getOrCreateSubscription(userId);
            tier = sub?.tier || 'FREE';
        }
        const limits = this.subscriptionsService.getUserLimits(tier);

        let chatId = dto.conversationId;
        if (userId && !chatId) {
            const chat = await this.chatService.createChat(userId, this.chatService['generateTitle'](dto.content));
            chatId = chat.id;
        }

        if (userId && chatId) {
            await this.chatService.saveUserMessageToChat(chatId, userId, dto.content, dto.model);
        }

        const history = userId && chatId ? await this.chatService.getChatHistory(chatId) : [];

        const selectedModel = (dto.model || 'ollama').trim();
        const premium = ['gemini', 'openai', 'deepseek'];
        if (premium.includes(selectedModel) && tier !== 'PREMIUM') {
            res.write(`data: ${JSON.stringify({ error: 'PREMIUM_REQUIRED', message: 'Este modelo es Premium.' })}\n\n`);
            return res.end();
        }

        const sendChunk = (text: string) => {
            if (!text) return;
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        };

        const finish = async (fullContent: string) => {
            if (chatId) {
                await this.chatService.saveAssistantMessageToChat(chatId, userId || null, fullContent, selectedModel);
                await this.usageService.incrementMessageCount(0, userId || undefined, userId ? undefined : dto.anonymousId);
            }
            res.write(`data: ${JSON.stringify({ finished: true, conversationId: chatId || 'temp-chat-id' })}\n\n`);
            res.end();
        };

        try {
            let fullContent = '';

            if (selectedModel === 'gemini') {
                const prompt = dto.content;
                for await (const chunk of await this.geminiService.generateStreamingResponse(prompt, { maxTokens: limits.maxTokensPerMessage })) {
                    fullContent += chunk;
                    sendChunk(chunk);
                }
                return await finish(fullContent);
            }

            if (selectedModel === 'openai') {
                const prompt = dto.content;
                for await (const chunk of await this.openaiService.generateStreamingResponse(prompt, { maxTokens: limits.maxTokensPerMessage })) {
                    fullContent += chunk;
                    sendChunk(chunk);
                }
                return await finish(fullContent);
            }

            if (selectedModel === 'deepseek') {
                const result = await this.deepseekService.generateResponse(dto.content, { maxTokens: limits.maxTokensPerMessage });
                fullContent = result.response;
                sendChunk(fullContent);
                return await finish(fullContent);
            }

            const ollamaMessages = [
                ...history.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
                { role: 'user' as const, content: dto.content },
            ];
            let ollamaModel: string | undefined = selectedModel;
            if (selectedModel.startsWith('ollama-')) {
                ollamaModel = selectedModel.replace('ollama-', '');
            } else if (selectedModel === 'ollama') {
                ollamaModel = undefined;
            }

            const makeR1Processor = () => {
                let inThink = false;
                return (chunk: string) => {
                    let i = 0; let resp = '';
                    const startTag = '<think>'; const endTag = '</think>';
                    while (i < chunk.length) {
                        if (!inThink) {
                            const j = chunk.indexOf(startTag, i);
                            if (j === -1) { resp += chunk.slice(i); break; }
                            resp += chunk.slice(i, j); i = j + startTag.length; inThink = true;
                        } else {
                            const k = chunk.indexOf(endTag, i);
                            if (k === -1) { break; }
                            i = k + endTag.length; inThink = false;
                        }
                    }
                    return resp;
                };
            };
            const processR1 = makeR1Processor();

            for await (const part of this.ollamaService.generateStream(ollamaMessages, ollamaModel, limits.maxTokensPerMessage)) {
                const piece = typeof part === 'string' ? part : (part?.content ?? '');
                if (!piece) continue;
                const cleaned = processR1(piece);
                if (cleaned) {
                    fullContent += cleaned;
                    sendChunk(cleaned);
                }
            }

            return await finish(fullContent);
        } catch (err: any) {
            res.write(`data: ${JSON.stringify({ error: 'STREAM_ERROR', message: err?.message || 'Error en streaming' })}\n\n`);
            return res.end();
        }
    }
    @Post('message/authenticated')
    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Enviar mensaje autenticado (guarda historial)',
    })
    @ApiResponse({ status: 200, type: ChatResponseDto })
    async sendAuthenticatedMessage(
        @Body() dto: SendMessageDto,
        @Req() req: any,
    ) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.sendMessage(dto, userId);
    }

    /**
     * Actualiza el primer mensaje del usuario y regenera el tÃ­tulo si procede
     */
    @Patch(':conversationId/first-message')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar primer mensaje y regenerar tÃ­tulo' })
    async updateFirstMessage(
        @Param('conversationId') conversationId: string,
        @Body() body: { content: string },
        @Req() req: any,
    ) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.updateFirstMessageAndTitle(conversationId, userId, body.content);
    }

    /**
     * Listar conversaciones del usuario
     */
    @Get('usage/stats')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener estadÃ­sticas de uso del usuario' })
    @ApiResponse({
        status: 200,
        description: 'EstadÃ­sticas de uso',
        schema: {
            example: {
                todayMessages: 5,
                todayTokens: 1024,
                totalMessages: 50,
                totalTokens: 10240,
                tier: 'REGISTERED',
                limits: {
                    messagesPerDay: 10,
                    maxTokensPerMessage: 2048,
                    canUploadImages: false,
                },
            },
        },
    })
    async getUserStats(@Req() req: any) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.getUserUsageStats(userId);
    }

    // ========== ENDPOINTS REST PARA GESTIÃ“N DE CHATS ==========

    @Post('sessions')
    @UseGuards(JwtAuthGuard)
    async createChatSession(
        @Request() req: any,
        @Body() body: { title?: string }
    ) {
        const userId = getUserIdFromReq(req)!;
        const chat = await this.chatService.createChat(userId, body.title);
        return { success: true, data: chat };
    }

    @Get('sessions')
    @UseGuards(JwtAuthGuard)
    async listChatSessions(@Request() req: any) {
        const userId = getUserIdFromReq(req)!;
        const chats = await this.chatService.listChats(userId);
        try { console.log("[GET /chat/sessions] userId:", userId, "count:", Array.isArray(chats) ? chats.length : "n/a"); } catch { }
        return { success: true, data: chats };
    }

    @Patch('sessions/:id')
    @UseGuards(JwtAuthGuard)
    async renameChatSession(
        @Param('id') chatId: string,
        @Body() body: { title: string },
        @Request() req: any
    ) {
        const userId = getUserIdFromReq(req)!;
        await this.chatService.renameChat(chatId, body.title, userId);
        return { success: true, message: 'Chat renombrado exitosamente' };
    }

    @Delete('sessions/:id')
    @UseGuards(JwtAuthGuard)
    async deleteChatSession(
        @Param('id') chatId: string,
        @Request() req: any
    ) {
        const userId = getUserIdFromReq(req)!;
        await this.chatService.deleteChat(chatId, userId);
        return { success: true, message: 'Chat eliminado exitosamente' };
    }

    @Get('sessions/:id/messages')
    @UseGuards(JwtAuthGuard)
    async getChatSessionMessages(
        @Param('id') chatId: string,
        @Request() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string
    ): Promise<any> {
        const messages = await this.chatService.getChatHistory(chatId);
        return { success: true, data: messages };
    }
}



