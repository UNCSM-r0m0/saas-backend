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

    /**
     * Obtener lista de chats del usuario
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Obtener lista de chats del usuario',
        description: 'Retorna todos los chats del usuario autenticado',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de chats obtenida exitosamente',
        schema: {
            type: 'object',
            properties: {
                chats: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            createdAt: { type: 'string' },
                            updatedAt: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    @ApiBearerAuth('JWT-auth')
    async getChats(@Req() req: any) {
        const userId = req.user?.id;

        if (!userId) {
            return {
                success: true,
                data: [],
                message: 'Usuario no autenticado'
            };
        }

        const chats = await this.chatService.getUserChats(userId);

        return {
            success: true,
            data: chats,
            message: 'Chats obtenidos exitosamente'
        };
    }

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
        const userId = req.user?.id ?? req.user?.sub ?? null;
        const chat = await this.chatService.createChat(userId, createChatDto?.title);
        return {
            success: true,
            data: chat,
            message: 'Chat creado exitosamente'
        };
    }

    /**
     * Obtener modelos de IA disponibles
     */
    @Get('models')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Obtener modelos de IA disponibles según tier de suscripción',
        description: 'Lista los modelos de IA disponibles filtrados por el tier de suscripción del usuario',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de modelos disponibles filtrados por tier',
        schema: {
            example: {
                models: [
                    {
                        id: 'ollama',
                        name: 'Ollama Local',
                        provider: 'Local',
                        available: true,
                        isPremium: false,
                        features: ['text-generation', 'local-processing'],
                        description: 'Modelo local ejecutándose en tu servidor'
                    },
                    {
                        id: 'gemini',
                        name: 'Gemini 2.0 Flash',
                        provider: 'Google',
                        available: true,
                        isPremium: true,
                        features: ['text-generation', 'multimodal', 'streaming'],
                        description: 'Modelo avanzado de Google con capacidades multimodales'
                    }
                ]
            }
        }
    })
    async getAvailableModels(@Request() req: any) {
        console.log('🔍 getAvailableModels: Iniciando...');
        const userId = req.user?.id ?? req.user?.sub ?? null;
        console.log('🔍 getAvailableModels: userId:', userId);

        // Obtener tier del usuario
        let userTier = 'ANONYMOUS';
        if (userId) {
            const subscription = await this.subscriptionsService.getOrCreateSubscription(userId);
            userTier = subscription?.tier || 'REGISTERED';
            console.log('🔍 getAvailableModels: subscription:', subscription);
            console.log('🔍 getAvailableModels: userTier:', userTier);
        }

        const allModels = [
            {
                id: 'ollama',
                name: 'Ollama Local',
                provider: 'Local',
                available: this.ollamaService.isAvailable(),
                isPremium: false,
                features: ['text-generation', 'local-processing'],
                description: 'Modelo local ejecutándose en tu servidor',
                defaultModel: 'deepseek-r1:7b'
            },
            {
                id: 'gemini',
                name: 'Gemini 2.0 Flash',
                provider: 'Google',
                available: this.geminiService.isAvailable(),
                isPremium: true,
                features: ['text-generation', 'multimodal', 'streaming'],
                description: 'Modelo avanzado de Google con capacidades multimodales',
                defaultModel: 'gemini-2.0-flash-exp'
            },
            {
                id: 'openai',
                name: 'GPT-4o Mini',
                provider: 'OpenAI',
                available: this.openaiService.isAvailable(),
                isPremium: true,
                features: ['text-generation', 'streaming', 'chat-completions'],
                description: 'Modelo de OpenAI optimizado para chat y conversaciones',
                defaultModel: 'gpt-4o-mini'
            },
            {
                id: 'deepseek',
                name: 'DeepSeek Chat',
                provider: 'DeepSeek',
                available: this.deepseekService.isAvailable(),
                isPremium: true,
                features: ['text-generation', 'cost-effective', 'high-performance'],
                description: 'Modelo de DeepSeek con excelente relación precio-calidad',
                defaultModel: 'deepseek-chat'
            }
        ];

        // Filtrar modelos según el tier del usuario
        const availableModels = allModels.filter(model => {
            // Modelos locales siempre disponibles
            if (!model.isPremium) return true;

            // Modelos premium solo para usuarios PREMIUM
            return userTier === 'PREMIUM';
        });

        console.log('🔍 getAvailableModels: availableModels:', availableModels);
        console.log('🔍 getAvailableModels: Devolviendo respuesta...');

        return { models: availableModels };
    }

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
        const userId = req.user?.id;

        if (!userId) {
            return {
                success: false,
                message: 'Usuario no autenticado'
            };
        }

        try {
            const conversation = await this.chatService.getConversation(id, userId);

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
        let userId = req.user?.id;

        // Blindaje extra: si viene un Bearer en el header pero no pasó por guard, decodificar JWT y tomar el sub
        if (!userId) {
            const auth = req.headers?.authorization as string | undefined;
            if (auth && auth.startsWith('Bearer ')) {
                const token = auth.slice(7);
                try {
                    const payloadPart = token.split('.')[1];
                    if (payloadPart) {
                        const payloadJson = Buffer.from(payloadPart, 'base64').toString('utf8');
                        const payload = JSON.parse(payloadJson);
                        if (payload && typeof payload.sub === 'string') {
                            userId = payload.sub;
                        }
                    }
                } catch (_) {
                    // Ignorar si es inválido; se tratará como anónimo
                }
            }
        }

        return this.chatService.sendMessage(dto, userId);
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
        return this.chatService.sendMessage(dto, req.user.id);
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
        return this.chatService.updateFirstMessageAndTitle(conversationId, req.user.id, body.content);
    }

    /**
     * Listar conversaciones del usuario
     */
    @Get('conversations')
    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar conversaciones del usuario' })
    @ApiResponse({ status: 200, description: 'Lista de conversaciones' })
    async listConversations(@Req() req: any) {
        return this.chatService.listConversations(req.user.id);
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
        return this.chatService.getConversation(id, req.user.id);
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
        return this.chatService.updateConversationTitle(id, req.user.id, title);
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
        return this.chatService.deleteConversation(id, req.user.id);
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
        return this.chatService.getUserUsageStats(req.user.id);
    }

    // ========== ENDPOINTS REST PARA GESTIÓN DE CHATS ==========

    @Post('sessions')
    @UseGuards(JwtAuthGuard)
    async createChatSession(
        @Request() req: any,
        @Body() body: { title?: string }
    ) {
        const chat = await this.chatService.createChat(req.user.sub, body.title);
        return { success: true, data: chat };
    }

    @Get('sessions')
    @UseGuards(JwtAuthGuard)
    async listChatSessions(@Request() req: any) {
        const chats = await this.chatService.listChats(req.user.sub);
        return { success: true, data: chats };
    }

    @Patch('sessions/:id')
    @UseGuards(JwtAuthGuard)
    async renameChatSession(
        @Param('id') chatId: string,
        @Body() body: { title: string },
        @Request() req: any
    ) {
        await this.chatService.renameChat(chatId, body.title, req.user.sub);
        return { success: true, message: 'Chat renombrado exitosamente' };
    }

    @Delete('sessions/:id')
    @UseGuards(JwtAuthGuard)
    async deleteChatSession(
        @Param('id') chatId: string,
        @Request() req: any
    ) {
        await this.chatService.deleteChat(chatId, req.user.sub);
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
        const messages = await this.chatService.getChatHistory(
            chatId,
            limit ? parseInt(limit) : 100,
            cursor
        );
        return { success: true, data: messages };
    }
}
