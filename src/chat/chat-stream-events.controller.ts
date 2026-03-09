import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CHAT_EVENTS } from 'libs/contracts/chat';
import type {
  ChatStreamChunkEvent,
  ChatStreamErrorEvent,
  ChatStreamFinishedEvent,
  ChatStreamStartedEvent,
} from 'libs/contracts/chat';
import { ChatStreamSessionService } from './gateway/chat-stream-session.service';
import { WsEmitterService } from '../common/ws/ws-emitter.service';

@Controller()
export class ChatStreamEventsController {
  constructor(
    private readonly streamSessions: ChatStreamSessionService,
    private readonly wsEmitter: WsEmitterService,
  ) {}

  @EventPattern(CHAT_EVENTS.streamStarted)
  onStreamStarted(@Payload() payload: ChatStreamStartedEvent) {
    const session = this.streamSessions.get(payload.streamId);
    if (!session) return;
    this.emit(session, 'responseStart', {
      chatId: session.chatId,
      messageId: session.messageId,
      correlationId: payload.correlationId,
      timestamp: payload.startedAt,
    });
  }

  @EventPattern(CHAT_EVENTS.streamChunk)
  onStreamChunk(@Payload() payload: ChatStreamChunkEvent) {
    const session = this.streamSessions.get(payload.streamId);
    if (!session) return;
    this.emit(session, 'responseChunk', {
      chatId: session.chatId,
      conversationId: payload.conversationId,
      messageId: session.messageId,
      seq: payload.seq,
      partial: true,
      content: payload.content,
      contentType: payload.contentType || 'markdown',
      correlationId: payload.correlationId,
      timestamp: payload.timestamp,
    });
  }

  @EventPattern(CHAT_EVENTS.streamFinished)
  onStreamFinished(@Payload() payload: ChatStreamFinishedEvent) {
    const streamId = payload.streamId;
    if (!streamId) return;
    const session = this.streamSessions.get(streamId);
    if (!session) return;
    this.emit(session, 'responseEnd', {
      chatId: session.chatId,
      conversationId: payload.conversationId,
      messageId: session.messageId,
      fullContent: payload.fullContent || '',
      totalChunks: payload.totalChunks || 0,
      finished: true,
      correlationId: payload.correlationId,
      timestamp: payload.finishedAt,
    });
    this.streamSessions.remove(streamId);
  }

  @EventPattern(CHAT_EVENTS.streamError)
  onStreamError(@Payload() payload: ChatStreamErrorEvent) {
    const session = this.streamSessions.get(payload.streamId);
    if (!session) return;
    this.emit(session, 'error', {
      message: payload.message,
      code: payload.code,
      chatId: session.chatId,
      messageId: session.messageId,
      correlationId: payload.correlationId,
    });
    this.streamSessions.remove(payload.streamId);
  }

  private emit(
    session: {
      clientId: string;
      chatId: string;
      broadcast: boolean;
    },
    event: string,
    payload: unknown,
  ) {
    if (session.broadcast) {
      this.wsEmitter.emitToRoom(session.chatId, event, payload);
      return;
    }
    this.wsEmitter.emitToSocket(session.clientId, event, payload);
  }
}
