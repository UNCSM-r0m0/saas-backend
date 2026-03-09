export const CHAT_PATTERNS = {
  health: 'chat.health',
  sendMessage: 'chat.sendMessage',
  createChat: 'chat.createChat',
  listChats: 'chat.listChats',
  renameChat: 'chat.renameChat',
  deleteChat: 'chat.deleteChat',
  getChat: 'chat.getChat',
  getChatHistory: 'chat.getChatHistory',
  getUsageStats: 'chat.getUsageStats',
  updateFirstMessage: 'chat.updateFirstMessage',
} as const;

export const CHAT_EVENTS = {
  messageCreated: 'chat.events.message.created',
  streamStarted: 'chat.events.stream.started',
  streamChunk: 'chat.events.stream.chunk',
  streamFinished: 'chat.events.stream.finished',
  streamError: 'chat.events.stream.error',
  usageIncremented: 'chat.events.usage.incremented',
  chatCreated: 'chat.events.session.created',
  chatDeleted: 'chat.events.session.deleted',
} as const;
