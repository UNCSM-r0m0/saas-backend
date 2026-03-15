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
  const chatId = `smoke-${Date.now()}`;

  const socket = io(`${baseUrl}/chat`, {
    transports: ['websocket'],
    withCredentials: true,
    timeout: 15000,
  });

  const wait = (event, timeoutMs = 15000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout esperando evento: ${event}`));
      }, timeoutMs);
      socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  try {
    await wait('connect', 15000);
    console.log('WS conectado:', socket.id);

    socket.emit('joinChat', { chatId });
    const joined = await wait('joinedChat', 10000);
    console.log('joinedChat:', joined);

    socket.emit('listChats');
    const listed = await wait('chatsListed', 10000);
    console.log(
      'chatsListed length:',
      Array.isArray(listed) ? listed.length : 'n/a',
    );

    let chunks = 0;
    let full = '';
    socket.on('responseChunk', (p) => {
      if (p?.content) {
        chunks += 1;
        full += p.content;
      }
    });

    const endPromise = wait('responseEnd', 60000);
    const errPromise = wait('error', 60000).then((e) => {
      throw new Error(`Evento error recibido: ${JSON.stringify(e)}`);
    });

    socket.emit(
      'sendMessage',
      {
        chatId,
        message: 'Smoke test WS chat',
        model: 'ollama-deepseek-v3.1:671b-cloud',
        broadcast: false,
      },
      (ack) => {
        console.log('ACK sendMessage:', ack);
      },
    );

    const start = await wait('responseStart', 20000);
    console.log('responseStart:', {
      chatId: start?.chatId,
      messageId: start?.messageId,
    });

    const end = await Promise.race([endPromise, errPromise]);
    console.log('responseEnd:', {
      chatId: end?.chatId,
      totalChunks: end?.totalChunks,
      finished: end?.finished,
    });

    if (!full.trim()) {
      throw new Error('No se recibio contenido en responseChunk');
    }

    console.log('WS smoke OK. Chars:', full.length, 'Chunks:', chunks);
  } finally {
    socket.disconnect();
  }
}

run().catch((err) => {
  console.error('WS smoke FAIL:', err.message);
  process.exit(1);
});
