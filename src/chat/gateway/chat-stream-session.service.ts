import { Injectable } from '@nestjs/common';

export interface ChatStreamSession {
  streamId: string;
  messageId: string;
  chatId: string;
  clientId: string;
  broadcast: boolean;
}

@Injectable()
export class ChatStreamSessionService {
  private readonly byStreamId = new Map<string, ChatStreamSession>();
  private readonly streamIdByMessageId = new Map<string, string>();

  register(session: ChatStreamSession) {
    this.byStreamId.set(session.streamId, session);
    this.streamIdByMessageId.set(session.messageId, session.streamId);
  }

  get(streamId: string) {
    return this.byStreamId.get(streamId);
  }

  resolveByMessageId(messageId: string) {
    const streamId = this.streamIdByMessageId.get(messageId);
    if (!streamId) return undefined;
    return this.byStreamId.get(streamId);
  }

  remove(streamId: string) {
    const session = this.byStreamId.get(streamId);
    if (!session) return;
    this.byStreamId.delete(streamId);
    this.streamIdByMessageId.delete(session.messageId);
  }

  removeByMessageId(messageId: string) {
    const streamId = this.streamIdByMessageId.get(messageId);
    if (!streamId) return;
    this.remove(streamId);
  }
}
