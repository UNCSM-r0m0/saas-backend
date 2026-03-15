import { Body, Controller, Get, Logger, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatClient } from './chat.client';
import { OpenAIService } from '../openai/openai.service';
import {
  getUserIdFromAuthHeader,
  getUserIdFromReq,
} from '../common/utils/auth.util';
import { getCorrelationIdFromReq } from '../common/utils/correlation-id.util';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatClient: ChatClient,
    private readonly openaiService: OpenAIService,
  ) {}

  @Get('models/openai/info')
  @Public()
  @ApiOperation({
    summary: 'Información del modelo OpenAI/LLM Studio',
    description:
      'Retorna información del modelo configurado y estadísticas de la cola de concurrencia',
  })
  async getOpenAIModelInfo() {
    return {
      success: true,
      data: this.openaiService.getModelInfo(),
    };
  }

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
    const correlationId = getCorrelationIdFromReq(req);
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let userId = getUserIdFromReq(req);
    if (!userId) {
      userId = getUserIdFromAuthHeader(req.headers?.authorization);
    }

    try {
      const result: any = await this.chatClient.sendMessage(
        dto,
        userId || undefined,
        undefined,
        undefined,
        correlationId,
      );

      const fullContent = String(result?.message?.content || '');
      const conversationId = String(
        result?.conversationId || dto.conversationId || 'temp-chat-id',
      );

      const chunkSize = 120;
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        const content = fullContent.slice(i, i + chunkSize);
        if (!content) continue;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }

      res.write(
        `data: ${JSON.stringify({ finished: true, conversationId })}\n\n`,
      );
      return res.end();
    } catch (err: any) {
      this.logger.error('Error en streamMessage', err?.stack || err);

      const message = String(err?.message || 'Error en streaming');
      const lowered = message.toLowerCase();
      let error = 'STREAM_ERROR';
      if (lowered.includes('premium')) error = 'PREMIUM_REQUIRED';
      if (lowered.includes('límite') || lowered.includes('limite')) {
        error = 'LIMIT_EXCEEDED';
      }

      res.write(`data: ${JSON.stringify({ error, message })}\n\n`);
      return res.end();
    }
  }
}
