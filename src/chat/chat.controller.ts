import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
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
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly ollamaService: OllamaService,
        private readonly geminiService: GeminiService,
    ) { }

    /**
     * Enviar mensaje (anónimos y registrados)
     */
    @Post('message')
    @ApiOperation({
        summary: 'Enviar mensaje al chat',
        description:
            'Usuarios anónimos: 3 mensajes/día sin historial. Registrados: 10 mensajes/día con historial. Premium: 1000 mensajes/día + imágenes.',
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
        const userId = req.user?.id;
        return this.chatService.sendMessage(dto, userId);
    }

    /**
     * Enviar mensaje (solo usuarios registrados con JWT)
     */
    @Post('message/authenticated')
    @UseGuards(JwtAuthGuard)
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
     * Listar conversaciones del usuario
     */
    @Get('conversations')
    @UseGuards(JwtAuthGuard)
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
    @UseGuards(JwtAuthGuard)
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
    @UseGuards(JwtAuthGuard)
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

    /**
     * Obtener modelos de IA disponibles
     */
    @Get('models')
    @ApiOperation({
        summary: 'Obtener modelos de IA disponibles',
        description: 'Lista todos los modelos de IA disponibles para usar en el chat',
    })
    @ApiResponse({
        status: 200,
        description: 'Lista de modelos disponibles',
        schema: {
            example: {
                models: [
                    {
                        id: 'ollama',
                        name: 'Ollama Local',
                        provider: 'Local',
                        available: true,
                        features: ['text-generation', 'local-processing'],
                        description: 'Modelo local ejecutándose en tu servidor'
                    },
                    {
                        id: 'gemini',
                        name: 'Gemini 2.0 Flash',
                        provider: 'Google',
                        available: true,
                        features: ['text-generation', 'multimodal', 'streaming'],
                        description: 'Modelo avanzado de Google con capacidades multimodales'
                    }
                ]
            }
        }
    })
    async getAvailableModels() {
        const models = [
            {
                id: 'ollama',
                name: 'Ollama Local',
                provider: 'Local',
                available: this.ollamaService.isAvailable(),
                features: ['text-generation', 'local-processing'],
                description: 'Modelo local ejecutándose en tu servidor',
                defaultModel: 'deepseek-r1:7b'
            },
            {
                id: 'gemini',
                name: 'Gemini 2.0 Flash',
                provider: 'Google',
                available: this.geminiService.isAvailable(),
                features: ['text-generation', 'multimodal', 'streaming'],
                description: 'Modelo avanzado de Google con capacidades multimodales',
                defaultModel: 'gemini-2.0-flash-exp'
            }
        ];

        return { models };
    }
}
