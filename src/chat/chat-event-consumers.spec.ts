import { CHAT_EVENTS } from '../../libs/contracts/chat';
import { UsageServiceController } from '../../apps/usage/src/usage-service.controller';
import { BillingServiceController } from '../../apps/billing/src/billing-service.controller';

describe('Chat event consumers', () => {
  it('usage consumer should increment usage from chat event', async () => {
    const usageServiceMock = {
      incrementMessageCount: jest.fn().mockResolvedValue(undefined),
    };
    const prismaMock = {
      usageConsumedEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const controller = new UsageServiceController(
      usageServiceMock as any,
      prismaMock as any,
    );

    await controller.onUsageIncremented({
      eventId: 'evt-usage-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      tokensUsed: 42,
      at: new Date().toISOString(),
    });

    expect(usageServiceMock.incrementMessageCount).toHaveBeenCalledWith(
      42,
      'user-1',
      undefined,
    );
  });

  it('billing consumer should persist usage increment event', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaMock = {
      billingUsageEvent: { create, findUnique },
    };
    const controller = new BillingServiceController(prismaMock as any);

    const at = new Date().toISOString();
    await controller.onUsageIncremented({
      eventId: 'evt-bill-usage-1',
      conversationId: 'conv-2',
      anonymousId: 'anon-2',
      tokensUsed: 20,
      at,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'chat',
          eventType: CHAT_EVENTS.usageIncremented,
          anonymousId: 'anon-2',
          tokensUsed: 20,
        }),
      }),
    );
  });

  it('billing consumer should persist message created event', async () => {
    const create = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaMock = {
      billingUsageEvent: { create, findUnique },
    };
    const controller = new BillingServiceController(prismaMock as any);

    await controller.onMessageCreated({
      eventId: 'evt-bill-msg-1',
      conversationId: 'conv-3',
      messageId: 'msg-3',
      userId: 'user-3',
      model: 'ollama',
      tokensUsed: 12,
      createdAt: new Date().toISOString(),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'chat',
          eventType: CHAT_EVENTS.messageCreated,
          conversationId: 'conv-3',
          messageId: 'msg-3',
          model: 'ollama',
          tokensUsed: 12,
        }),
      }),
    );
  });
});
