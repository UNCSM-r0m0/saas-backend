export interface PaypalHealthResponseV1 {
  service: 'paypal';
  status: 'ok';
}

export interface PaypalResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}

// Productos
export interface CreatePaypalProductDto {
  name: string;
  description: string;
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category?: string;
  imageUrl?: string;
  homeUrl?: string;
}

export interface PaypalProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  category?: string;
  imageUrl?: string;
  homeUrl?: string;
  createTime: string;
  updateTime: string;
  links?: any[];
}

// Planes de suscripción
export interface CreatePaypalPlanDto {
  productId: string;
  name: string;
  description?: string;
  billingCycles: BillingCycle[];
  paymentPreferences?: PaymentPreferences;
  taxes?: Taxes;
  quantitySupported?: boolean;
}

export interface BillingCycle {
  frequency: {
    intervalUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
    intervalCount: number;
  };
  tenureType: 'REGULAR' | 'TRIAL';
  sequence: number;
  totalCycles?: number;
  pricingScheme: {
    fixedPrice: {
      currencyCode: string;
      value: string;
    };
  };
}

export interface PaymentPreferences {
  autoBillOutstanding: boolean;
  setupFee?: {
    currencyCode: string;
    value: string;
  };
  setupFeeFailureAction?: 'CONTINUE' | 'CANCEL';
  paymentFailureThreshold?: number;
}

export interface Taxes {
  percentage: string;
  inclusive: boolean;
}

export interface PaypalPlan {
  id: string;
  productId: string;
  name: string;
  description?: string;
  status: 'CREATED' | 'ACTIVE' | 'INACTIVE';
  billingCycles: BillingCycle[];
  createTime: string;
  updateTime: string;
  links?: any[];
}

// Suscripciones
export interface CreatePaypalSubscriptionDto {
  planId: string;
  userId: string;
  startTime?: string;
  quantity?: number;
  shippingAmount?: {
    currencyCode: string;
    value: string;
  };
  applicationContext?: {
    brandName?: string;
    locale?: string;
    shippingPreference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';
    userAction?: 'CONTINUE' | 'SUBSCRIBE_NOW';
    paymentMethod?: {
      payerSelected?: string;
      payeePreferred?: string;
    };
    returnUrl?: string;
    cancelUrl?: string;
  };
}

export interface PaypalSubscription {
  id: string;
  planId: string;
  startTime?: string;
  quantity?: string;
  shippingAmount?: any;
  subscriber?: {
    emailAddress?: string;
    payerId?: string;
    name?: {
      givenName?: string;
      surname?: string;
    };
  };
  billingInfo?: {
    outstandingBalance?: any;
    cycleExecutions?: any[];
    lastPayment?: any;
    nextBillingTime?: string;
    failedPaymentsCount?: number;
  };
  createTime: string;
  updateTime: string;
  status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  statusUpdateTime: string;
  links?: any[];
}

// Webhook events
export interface PaypalWebhookEvent {
  id: string;
  eventType: string;
  resourceType: string;
  resource: any;
  createTime: string;
  resourceVersion?: string;
  eventVersion?: string;
}

// Configuración
export interface PaypalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  webhookId?: string;
}
