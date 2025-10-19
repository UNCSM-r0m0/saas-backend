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
} from '@nestjs/common';
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
    ) { }

    // MÉTODO ELIMINADO: getChats() - duplicado con listConversations()
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
    // Usar /api/models/public en su lugar para evitar duplicación

    // ENDPOINT ELIMINADO: /api/chat (duplicado con /api/chat/conversations)
    // Usar /api/chat/conversations en su lugar

    /**
     * Obtener un chat específico con sus mensajes
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Obtener un chat específico',
        description: 'Retorna un chat específico con todos sus mensajes',
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
        console.log('🔍 getChat: Iniciando con id:', id);
        const userId = getUserIdFromReq(req);

        if (!userId) {
            return {
                success: false,
                message: 'Usuario no autenticado'
            };
        }

        try {
            const conversation = await this.chatService.getChat(id, userId);

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
     * Enviar mensaje (anónimos y registrados)
     */
    @Post('message')
    @Public() // Permitir acceso público para usuarios anónimos
    @ApiOperation({
        summary: 'Enviar mensaje al chat',
        description:
            'Usuarios anónimos: 3 mensajes/día sin historial. Registrados: 50 mensajes/día con historial. Premium: 1000 mensajes/día + imágenes.',
    })
    @ApiResponse({
        status: 200,
        description: 'Respuesta del chat',
        type: ChatResponseDto,
    })
    @ApiResponse({
        status: 403,
        description: 'Límite de mensajes alcanzado',
    })
    @ApiBody({ type: SendMessageDto })
    async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
        // Obtener userId si está autenticado (opcional)
        let userId = getUserIdFromReq(req);
        if (!userId) {
            userId = getUserIdFromAuthHeader(req.headers?.authorization);
        }
        return this.chatService.sendMessage(dto, userId || undefined);
    }

    /**
     * Enviar mensaje (solo usuarios registrados con JWT)
     */
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
     * Actualiza el primer mensaje del usuario y regenera el título si procede
     */
    @Patch(':conversationId/first-message')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar primer mensaje y regenerar título' })
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
    @Get('conversations')
    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar chats del usuario' })
    @ApiResponse({ status: 200, description: 'Lista de chats' })
    async listConversations(@Req() req: any) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.getUserChats(userId);
    }

    /**
     * Obtener conversación específica
     */
    @Get('conversations/:id')
    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener una conversación con todos sus mensajes' })
    @ApiResponse({ status: 200, description: 'Conversación completa' })
    @ApiResponse({ status: 404, description: 'Conversación no encontrada' })
    async getConversation(@Param('id') id: string, @Req() req: any) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.getChat(id, userId);
    }

    /**
     * Actualizar título de conversación
     */
    @Patch('conversations/:id/title')
    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar título de conversación' })
    @ApiResponse({ status: 200, description: 'Título actualizado' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string', example: 'Mi conversación sobre NestJS' },
            },
        },
    })
    async updateConversationTitle(
        @Param('id') id: string,
        @Body('title') title: string,
        @Req() req: any,
    ) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.updateChatTitle(id, userId, title);
    }

    /**
     * Eliminar conversación
     */
    @Delete('conversations/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Eliminar conversación' })
    @ApiResponse({ status: 200, description: 'Conversación eliminada' })
    async deleteConversation(@Param('id') id: string, @Req() req: any) {
        const userId = getUserIdFromReq(req)!;
        return this.chatService.deleteChat(id, userId);
    }

    /**
     * Obtener estadísticas de uso
     */
    @Get('usage/stats')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener estadísticas de uso del usuario' })
    @ApiResponse({
        status: 200,
        description: 'Estadísticas de uso',
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

    // ========== ENDPOINTS REST PARA GESTIÓN DE CHATS ==========

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
