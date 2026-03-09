const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { lastValueFrom } = require('rxjs');

async function main() {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  const client = ClientProxyFactory.create({
    transport: Transport.NATS,
    options: { servers: [natsUrl] },
  });

  try {
    const response = await lastValueFrom(client.send('chat.health', {}));
    console.log('chat.health response:', response);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('chat.health error:', error);
  process.exit(1);
});
