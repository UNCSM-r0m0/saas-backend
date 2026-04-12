export interface ModelConfigDto {
  name: string;
  displayName: string;
  provider: string;
  tier: 'PUBLIC' | 'PREMIUM';
  maxTokens?: number;
  isActive: boolean;
  isDefault: boolean;
  fallbackModel?: string;
}

export interface ChatSendMessageDto {
  content: string;
  model?: string;
  anonymousId?: string;
  conversationId?: string;
  context?: string;
  modelConfig?: ModelConfigDto;
}

export interface ChatSendMessagePayload {
  dto: ChatSendMessageDto;
  userId?: string;
  streamId?: string;
  messageId?: string;
  correlationId?: string;
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

export interface ChatMessageV1 {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  createdAt: string | Date;
  tokensUsed?: number;
}

export interface ChatSendMessageResponseV1 {
  conversationId: string;
  message: ChatMessageV1;
  remaining: number;
  limit: number;
  tier: string;
}

export interface ChatSessionV1 {
  id: string;
  title: string;
  ownerId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChatHistoryEntryV1 {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatUsageStatsResponseV1 {
  todayMessages: number;
  todayTokens: number;
  totalMessages: number;
  totalTokens: number;
  tier: string;
  limits: {
    messagesPerDay: number;
    maxTokensPerMessage: number;
    canUploadImages: boolean;
  };
}

export interface ChatUpdateFirstMessageResponseV1 {
  success: boolean;
  data: { title: string };
  message: string;
}

export interface ChatConversationMessageV1 {
  id: string;
  role: string;
  content: string;
  createdAt: string | Date;
  model?: string | null;
  tokensUsed?: number | null;
}

export interface ChatConversationV1 {
  id: string;
  title: string;
  ownerId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  messages: ChatConversationMessageV1[];
}

export interface ChatHealthResponseV1 {
  service: 'chat';
  status: 'ok';
}

export interface ChatResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}

export interface ChatMessageCreatedEvent {
  eventId: string;
  correlationId?: string;
  conversationId: string;
  messageId: string;
  userId?: string;
  model?: string;
  tokensUsed?: number;
  createdAt: string;
}

export interface ChatStreamStartedEvent {
  eventId: string;
  correlationId?: string;
  streamId: string;
  chatId: string;
  messageId: string;
  userId?: string;
  startedAt: string;
}

export interface ChatStreamChunkEvent {
  eventId: string;
  correlationId?: string;
  streamId: string;
  chatId: string;
  conversationId?: string;
  messageId: string;
  seq: number;
  content: string;
  contentType?: 'markdown' | 'code';
  timestamp: string;
}

export interface ChatStreamFinishedEvent {
  eventId: string;
  correlationId?: string;
  streamId?: string;
  chatId?: string;
  messageId?: string;
  conversationId: string;
  userId?: string;
  totalChunks?: number;
  fullContent?: string;
  finishedAt: string;
}

export interface ChatStreamErrorEvent {
  eventId: string;
  correlationId?: string;
  streamId: string;
  chatId: string;
  messageId: string;
  code: string;
  message: string;
  at: string;
}

export interface ChatUsageIncrementedEvent {
  eventId: string;
  correlationId?: string;
  conversationId?: string;
  userId?: string;
  anonymousId?: string;
  tokensUsed: number;
  at: string;
}

export interface ChatSessionCreatedEvent {
  eventId: string;
  correlationId?: string;
  chatId: string;
  ownerId?: string | null;
  createdAt: string;
}

export interface ChatSessionDeletedEvent {
  eventId: string;
  correlationId?: string;
  chatId: string;
  ownerId?: string;
  deletedAt: string;
}
