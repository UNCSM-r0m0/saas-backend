export interface ChatSendMessagePayload {
  dto: any;
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
