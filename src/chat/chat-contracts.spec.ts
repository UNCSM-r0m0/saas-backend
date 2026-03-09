import { CHAT_EVENTS, CHAT_PATTERNS } from '../../libs/contracts/chat';

describe('Chat NATS contracts', () => {
  it('CHAT_PATTERNS should keep stable keys', () => {
    expect(CHAT_PATTERNS).toMatchObject({
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
    });
  });

  it('CHAT_EVENTS should keep stable keys', () => {
    expect(CHAT_EVENTS).toMatchObject({
      messageCreated: 'chat.events.message.created',
      streamStarted: 'chat.events.stream.started',
      streamChunk: 'chat.events.stream.chunk',
      streamFinished: 'chat.events.stream.finished',
      streamError: 'chat.events.stream.error',
      usageIncremented: 'chat.events.usage.incremented',
      chatCreated: 'chat.events.session.created',
      chatDeleted: 'chat.events.session.deleted',
    });
  });

  it('all pattern values should be unique', () => {
    const values = Object.values(CHAT_PATTERNS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all event values should be unique', () => {
    const values = Object.values(CHAT_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});
