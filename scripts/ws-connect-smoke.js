let io;
try {
  ({ io } = require('socket.io-client'));
} catch {
  ({
    io,
  } = require('D:/WORKSPACES/NESTJS/chat/r3-chat/node_modules/socket.io-client/build/cjs'));
}

async function run() {
  const baseUrl = process.env.GATEWAY_URL || 'http://localhost:3001';
  const chatId = `smoke-connect-${Date.now()}`;

  const socket = io(`${baseUrl}/chat`, {
    transports: ['websocket'],
    withCredentials: true,
    timeout: 15000,
  });

  const wait = (event, timeoutMs = 10000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout esperando ${event}`)),
        timeoutMs,
      );
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  try {
    await wait('connect', 15000);
    socket.emit('joinChat', { chatId });
    const joined = await wait('joinedChat', 10000);
    if (!joined?.chatId) throw new Error('joinedChat sin chatId');

    socket.emit('listChats');
    await wait('chatsListed', 10000);

    console.log('WS connect smoke OK');
  } finally {
    socket.disconnect();
  }
}

run().catch((error) => {
  console.error('WS connect smoke FAIL:', error.message);
  process.exit(1);
});
