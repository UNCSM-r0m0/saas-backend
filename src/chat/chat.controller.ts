import { Body, Controller, Get, Logger, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UsageService } from '../usage/usage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { OllamaService } from '../ollama/ollama.service';
import { GeminiService } from '../gemini/gemini.service';
import { OpenAIService } from '../openai/openai.service';
import { DeepSeekService } from '../deepseek/deepseek.service';
import {
  getUserIdFromAuthHeader,
  getUserIdFromReq,
} from '../common/utils/auth.util';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly ollamaService: OllamaService,
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService,
    private readonly deepseekService: DeepSeekService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usageService: UsageService,
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
      res.write(
        `data: ${JSON.stringify({ error: 'LIMIT_EXCEEDED', message: 'Has alcanzado tu límite de mensajes por día.' })}\n\n`,
      );
      return res.end();
    }

    let tier = 'FREE' as any;
    if (userId) {
      const sub =
        await this.subscriptionsService.getOrCreateSubscription(userId);
      tier = sub?.tier || 'FREE';
    }
    const limits = this.subscriptionsService.getUserLimits(tier);

    let chatId = dto.conversationId;
    if (userId && !chatId) {
      const chat = await this.chatService.createChat(
        userId,
        this.chatService['generateTitle'](dto.content),
      );
      chatId = chat.id;
    }

    if (userId && chatId) {
      await this.chatService.saveUserMessageToChat(
        chatId,
        userId,
        dto.content,
        dto.model,
      );
    }

    const history =
      userId && chatId ? await this.chatService.getChatHistory(chatId) : [];

    const selectedModel = (dto.model || 'ollama').trim();
    const premium = ['gemini', 'openai', 'deepseek'];
    if (premium.includes(selectedModel) && tier !== 'PREMIUM') {
      res.write(
        `data: ${JSON.stringify({ error: 'PREMIUM_REQUIRED', message: 'Este modelo es Premium.' })}\n\n`,
      );
      return res.end();
    }

    const sendChunk = (text: string) => {
      if (!text) return;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    };

    const finish = async (fullContent: string) => {
      if (chatId) {
        await this.chatService.saveAssistantMessageToChat(
          chatId,
          userId || null,
          fullContent,
          selectedModel,
        );
        await this.usageService.incrementMessageCount(
          0,
          userId || undefined,
          userId ? undefined : dto.anonymousId,
        );
      }
      res.write(
        `data: ${JSON.stringify({ finished: true, conversationId: chatId || 'temp-chat-id' })}\n\n`,
      );
      res.end();
    };

    try {
      let fullContent = '';

      if (selectedModel === 'gemini') {
        const prompt = dto.content;
        for await (const chunk of await this.geminiService.generateStreamingResponse(
          prompt,
          { maxTokens: limits.maxTokensPerMessage },
        )) {
          fullContent += chunk;
          sendChunk(chunk);
        }
        return await finish(fullContent);
      }

      if (selectedModel === 'openai') {
        const prompt = dto.content;
        for await (const chunk of await this.openaiService.generateStreamingResponse(
          prompt,
          { maxTokens: limits.maxTokensPerMessage },
        )) {
          fullContent += chunk;
          sendChunk(chunk);
        }
        return await finish(fullContent);
      }

      if (selectedModel === 'deepseek') {
        const result = await this.deepseekService.generateResponse(
          dto.content,
          {
            maxTokens: limits.maxTokensPerMessage,
          },
        );
        fullContent = result.response;
        sendChunk(fullContent);
        return await finish(fullContent);
      }

      const ollamaMessages = [
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
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
          let i = 0;
          let resp = '';
          const startTag = '<think>';
          const endTag = '</think>';
          while (i < chunk.length) {
            if (!inThink) {
              const j = chunk.indexOf(startTag, i);
              if (j === -1) {
                resp += chunk.slice(i);
                break;
              }
              resp += chunk.slice(i, j);
              i = j + startTag.length;
              inThink = true;
            } else {
              const k = chunk.indexOf(endTag, i);
              if (k === -1) {
                break;
              }
              i = k + endTag.length;
              inThink = false;
            }
          }
          return resp;
        };
      };
      const processR1 = makeR1Processor();

      for await (const part of this.ollamaService.generateStream(
        ollamaMessages,
        ollamaModel,
        limits.maxTokensPerMessage,
      )) {
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
      this.logger.error('Error en streamMessage', err?.stack || err);
      res.write(
        `data: ${JSON.stringify({ error: 'STREAM_ERROR', message: err?.message || 'Error en streaming' })}\n\n`,
      );
      return res.end();
    }
  }
}
