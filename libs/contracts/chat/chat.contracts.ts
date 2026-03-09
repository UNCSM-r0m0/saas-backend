export interface ChatSendMessageDto {
  content: string;
  model?: string;
  anonymousId?: string;
  conversationId?: string;
  context?: string;
}

export interface ChatSendMessagePayload {
  dto: ChatSendMessageDto;
  userId?: string;
}

export interface ChatCreatePayload {
  userId?: string;
  title?: string;
}

export interface ChatListPayload {
  userId: string;
}

export interface ChatRenamePayload {
  chatId: string;
  title: string;
  userId: string;
}

export interface ChatDeletePayload {
  chatId: string;
  userId: string;
}

export interface ChatGetPayload {
  chatId: string;
  userId: string;
}

export interface ChatHistoryPayload {
  chatId: string;
}

export interface ChatUsageStatsPayload {
  userId: string;
}

export interface ChatUpdateFirstMessagePayload {
  chatId: string;
  userId: string;
  content: string;
}

export interface ChatMessageCreatedEvent {
  conversationId: string;
  messageId: string;
  userId?: string;
  model?: string;
  tokensUsed?: number;
  createdAt: string;
}

export interface ChatStreamFinishedEvent {
  conversationId: string;
  userId?: string;
  totalChunks?: number;
  finishedAt: string;
}

export interface ChatUsageIncrementedEvent {
  conversationId?: string;
  userId?: string;
  anonymousId?: string;
  tokensUsed: number;
  at: string;
}

export interface ChatSessionCreatedEvent {
  chatId: string;
  ownerId?: string | null;
  createdAt: string;
}

export interface ChatSessionDeletedEvent {
  chatId: string;
  ownerId?: string;
  deletedAt: string;
}
