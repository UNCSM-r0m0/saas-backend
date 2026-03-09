import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import {
  getUserIdFromAuthHeader,
  getUserIdFromReq,
} from '../common/utils/auth.util';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatClient } from './chat.client';
import type { ChatSendMessageResponseV1 } from 'libs/contracts/chat';

@ApiTags('chat')
@Controller('chat')
export class ChatMessagesController {
  private readonly logger = new Logger(ChatMessagesController.name);

  constructor(private readonly chatClient: ChatClient) {}

  @Post('message')
  @Public()
  @ApiOperation({ summary: 'Enviar mensaje al chat' })
  @ApiResponse({
    status: 200,
    description: 'Respuesta del chat',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Límite de mensajes alcanzado' })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    let userId = getUserIdFromReq(req);
    if (!userId) {
      userId = getUserIdFromAuthHeader(req.headers?.authorization);
    }

    this.logger.log(
      `📨 [POST /chat/message] Procesando mensaje para usuario ${userId || 'anónimo'}, modelo: ${dto.model || 'ollama'}`,
    );
    const result: ChatSendMessageResponseV1 = await this.chatClient.sendMessage(
      dto,
      userId || undefined,
    );
    this.logger.log(
      `✅ [POST /chat/message] Respuesta enviada exitosamente: ${result.message.content.length} caracteres`,
    );
    return result;
  }

  @Post('message/authenticated')
  @UseGuards(ClientTypeGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar mensaje autenticado (guarda historial)' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  async sendAuthenticatedMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    const userId = getUserIdFromReq(req)!;
    return this.chatClient.sendMessage(dto, userId);
  }
}
