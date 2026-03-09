import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getUserIdFromReq } from '../common/utils/auth.util';
import { ChatClient } from './chat.client';
import type { ChatConversationV1 } from 'libs/contracts/chat';

@ApiTags('chat')
@Controller('chat')
export class ChatSessionsController {
  constructor(private readonly chatClient: ChatClient) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear un nuevo chat' })
  @ApiBearerAuth('JWT-auth')
  async createChat(@Body() createChatDto: any, @Req() req: any) {
    const userId = getUserIdFromReq(req);
    const chat = await this.chatClient.createChat(userId, createChatDto?.title);
    return { success: true, data: chat, message: 'Chat creado exitosamente' };
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  async createChatSession(
    @Request() req: any,
    @Body() body: { title?: string },
  ) {
    const userId = getUserIdFromReq(req)!;
    const chat = await this.chatClient.createChat(userId, body.title);
    return { success: true, data: chat };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Vary', 'Cookie, Authorization, Origin')
  async listChatSessions(@Request() req: any) {
    const userId = getUserIdFromReq(req)!;
    const chats = await this.chatClient.listChats(userId);
    return { success: true, data: chats };
  }

  @Patch('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async renameChatSession(
    @Param('id') chatId: string,
    @Body() body: { title: string },
    @Request() req: any,
  ) {
    const userId = getUserIdFromReq(req)!;
    await this.chatClient.renameChat(chatId, body.title, userId);
    return { success: true, message: 'Chat renombrado exitosamente' };
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async deleteChatSession(@Param('id') chatId: string, @Request() req: any) {
    const userId = getUserIdFromReq(req)!;
    await this.chatClient.deleteChat(chatId, userId);
    return { success: true, message: 'Chat eliminado exitosamente' };
  }

  @Get('sessions/:id/messages')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('Vary', 'Cookie, Authorization, Origin')
  async getChatSessionMessages(
    @Param('id') chatId: string,
    @Query('limit') _limit?: string,
    @Query('cursor') _cursor?: string,
  ) {
    const messages = await this.chatClient.getChatHistory(chatId);
    return { success: true, data: messages };
  }

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
    return this.chatClient.updateFirstMessage(
      conversationId,
      userId,
      body.content,
    );
  }

  @Get('usage/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de uso del usuario' })
  async getUserStats(@Req() req: any) {
    const userId = getUserIdFromReq(req)!;
    return this.chatClient.getUsageStats(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener un chat específico' })
  @ApiResponse({ status: 200, description: 'Chat obtenido exitosamente' })
  @ApiBearerAuth('JWT-auth')
  async getChat(@Param('id') id: string, @Req() req: any) {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return { success: false, message: 'Usuario no autenticado' };
    }

    const conversation: ChatConversationV1 = await this.chatClient.getChat(
      id,
      userId,
    );
    if (!conversation) {
      return { success: false, message: 'Chat no encontrado' };
    }

    const chatData = {
      id: conversation.id,
      title: conversation.title,
      model: 'ollama',
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        role: String(msg.role).toLowerCase(),
        content: msg.content,
        createdAt: msg.createdAt,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    return {
      success: true,
      data: chatData,
      message: 'Chat obtenido exitosamente',
    };
  }
}
