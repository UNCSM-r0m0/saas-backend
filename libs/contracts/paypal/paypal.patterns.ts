export const PAYPAL_PATTERNS = {
  health: 'paypal.health',
  createSubscription: 'paypal.subscription.create',
  cancelSubscription: 'paypal.subscription.cancel',
  getSubscription: 'paypal.subscription.get',
  createProduct: 'paypal.product.create',
  createPlan: 'paypal.plan.create',
  webhook: 'paypal.webhook',
} as const;
