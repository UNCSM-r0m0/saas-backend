import { CHAT_EVENTS, CHAT_PATTERNS } from '../../libs/contracts/chat';

const sortedKeys = (value: Record<string, unknown>) =>
  Object.keys(value).sort();

describe('Chat contract shapes snapshot', () => {
  it('request payload shapes should remain stable', () => {
    const payloads = {
      sendMessage: {
        dto: {
          content: 'hello',
          model: 'ollama',
          anonymousId: 'anon-id',
          conversationId: 'conv-id',
          context: 'ctx',
        },
        userId: 'user-id',
        streamId: 'stream-id',
        messageId: 'message-id',
      },
      createChat: {
        userId: 'user-id',
        title: 'Nueva conversación',
      },
      listChats: {
        userId: 'user-id',
      },
      renameChat: {
        chatId: 'chat-id',
        title: 'Nuevo título',
        userId: 'user-id',
      },
      deleteChat: {
        chatId: 'chat-id',
        userId: 'user-id',
      },
      getChat: {
        chatId: 'chat-id',
        userId: 'user-id',
      },
      getChatHistory: {
        chatId: 'chat-id',
      },
      getUsageStats: {
        userId: 'user-id',
      },
      updateFirstMessage: {
        chatId: 'chat-id',
        userId: 'user-id',
        content: 'nuevo contenido',
      },
    };

    expect({
      sendMessage: sortedKeys(payloads.sendMessage),
      sendMessageDto: sortedKeys(payloads.sendMessage.dto),
      createChat: sortedKeys(payloads.createChat),
      listChats: sortedKeys(payloads.listChats),
      renameChat: sortedKeys(payloads.renameChat),
      deleteChat: sortedKeys(payloads.deleteChat),
      getChat: sortedKeys(payloads.getChat),
      getChatHistory: sortedKeys(payloads.getChatHistory),
      getUsageStats: sortedKeys(payloads.getUsageStats),
      updateFirstMessage: sortedKeys(payloads.updateFirstMessage),
    }).toMatchInlineSnapshot(`
{
  "createChat": [
    "title",
    "userId",
  ],
  "deleteChat": [
    "chatId",
    "userId",
  ],
  "getChat": [
    "chatId",
    "userId",
  ],
  "getChatHistory": [
    "chatId",
  ],
  "getUsageStats": [
    "userId",
  ],
  "listChats": [
    "userId",
  ],
  "renameChat": [
    "chatId",
    "title",
    "userId",
  ],
  "sendMessage": [
    "dto",
    "messageId",
    "streamId",
    "userId",
  ],
  "sendMessageDto": [
    "anonymousId",
    "content",
    "context",
    "conversationId",
    "model",
  ],
  "updateFirstMessage": [
    "chatId",
    "content",
    "userId",
  ],
}
`);
  });

  it('event payload shapes should remain stable', () => {
    const events = {
      messageCreated: {
        conversationId: 'conv-id',
        messageId: 'msg-id',
        userId: 'user-id',
        model: 'ollama',
        tokensUsed: 10,
        createdAt: new Date().toISOString(),
      },
      streamStarted: {
        streamId: 'stream-id',
        chatId: 'chat-id',
        messageId: 'msg-id',
        userId: 'user-id',
        startedAt: new Date().toISOString(),
      },
      streamChunk: {
        streamId: 'stream-id',
        chatId: 'chat-id',
        conversationId: 'conv-id',
        messageId: 'msg-id',
        seq: 1,
        content: 'chunk',
        contentType: 'markdown',
        timestamp: new Date().toISOString(),
      },
      streamFinished: {
        streamId: 'stream-id',
        chatId: 'chat-id',
        messageId: 'msg-id',
        conversationId: 'conv-id',
        userId: 'user-id',
        totalChunks: 2,
        fullContent: 'full',
        finishedAt: new Date().toISOString(),
      },
      streamError: {
        streamId: 'stream-id',
        chatId: 'chat-id',
        messageId: 'msg-id',
        code: 'STREAM_ERROR',
        message: 'error',
        at: new Date().toISOString(),
      },
      usageIncremented: {
        conversationId: 'conv-id',
        userId: 'user-id',
        anonymousId: 'anon-id',
        tokensUsed: 10,
        at: new Date().toISOString(),
      },
      chatCreated: {
        chatId: 'chat-id',
        ownerId: 'user-id',
        createdAt: new Date().toISOString(),
      },
      chatDeleted: {
        chatId: 'chat-id',
        ownerId: 'user-id',
        deletedAt: new Date().toISOString(),
      },
    };

    expect({
      messageCreated: sortedKeys(events.messageCreated),
      streamStarted: sortedKeys(events.streamStarted),
      streamChunk: sortedKeys(events.streamChunk),
      streamFinished: sortedKeys(events.streamFinished),
      streamError: sortedKeys(events.streamError),
      usageIncremented: sortedKeys(events.usageIncremented),
      chatCreated: sortedKeys(events.chatCreated),
      chatDeleted: sortedKeys(events.chatDeleted),
    }).toMatchInlineSnapshot(`
{
  "chatCreated": [
    "chatId",
    "createdAt",
    "ownerId",
  ],
  "chatDeleted": [
    "chatId",
    "deletedAt",
    "ownerId",
  ],
  "messageCreated": [
    "conversationId",
    "createdAt",
    "messageId",
    "model",
    "tokensUsed",
    "userId",
  ],
  "streamChunk": [
    "chatId",
    "content",
    "contentType",
    "conversationId",
    "messageId",
    "seq",
    "streamId",
    "timestamp",
  ],
  "streamError": [
    "at",
    "chatId",
    "code",
    "message",
    "messageId",
    "streamId",
  ],
  "streamFinished": [
    "chatId",
    "conversationId",
    "finishedAt",
    "fullContent",
    "messageId",
    "streamId",
    "totalChunks",
    "userId",
  ],
  "streamStarted": [
    "chatId",
    "messageId",
    "startedAt",
    "streamId",
    "userId",
  ],
  "usageIncremented": [
    "anonymousId",
    "at",
    "conversationId",
    "tokensUsed",
    "userId",
  ],
}
`);
  });

  it('pattern/event keys map should stay stable', () => {
    expect({
      patternKeys: sortedKeys(CHAT_PATTERNS as Record<string, unknown>),
      eventKeys: sortedKeys(CHAT_EVENTS as Record<string, unknown>),
    }).toMatchInlineSnapshot(`
{
  "eventKeys": [
    "chatCreated",
    "chatDeleted",
    "messageCreated",
    "streamChunk",
    "streamError",
    "streamFinished",
    "streamStarted",
    "usageIncremented",
  ],
  "patternKeys": [
    "createChat",
    "deleteChat",
    "getChat",
    "getChatHistory",
    "getUsageStats",
    "health",
    "listChats",
    "renameChat",
    "sendMessage",
    "updateFirstMessage",
  ],
}
`);
  });
});
