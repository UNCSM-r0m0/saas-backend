import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CHAT_EVENTS,
  ChatMessageCreatedEvent,
  ChatSessionCreatedEvent,
  ChatSessionDeletedEvent,
  ChatStreamFinishedEvent,
  ChatUsageIncrementedEvent,
} from 'libs/contracts/chat';

@Injectable()
export class ChatEventsPublisher {
  private readonly logger = new Logger(ChatEventsPublisher.name);

  constructor(
    @Inject('CHAT_EVENTS_NATS') private readonly eventsClient: ClientProxy,
  ) {}

  emitMessageCreated(payload: ChatMessageCreatedEvent) {
    this.eventsClient.emit(CHAT_EVENTS.messageCreated, payload);
  }

  emitStreamFinished(payload: ChatStreamFinishedEvent) {
    this.eventsClient.emit(CHAT_EVENTS.streamFinished, payload);
  }

  emitUsageIncremented(payload: ChatUsageIncrementedEvent) {
    this.eventsClient.emit(CHAT_EVENTS.usageIncremented, payload);
  }

  emitSessionCreated(payload: ChatSessionCreatedEvent) {
    this.eventsClient.emit(CHAT_EVENTS.chatCreated, payload);
  }

  emitSessionDeleted(payload: ChatSessionDeletedEvent) {
    this.eventsClient.emit(CHAT_EVENTS.chatDeleted, payload);
  }

  logEmitError(event: string, error: unknown) {
    this.logger.warn(`No se pudo publicar evento ${event}: ${String(error)}`);
  }
}
