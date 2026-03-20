import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreatePaypalProductDto,
  CreatePaypalPlanDto,
  CreatePaypalSubscriptionDto,
  PaypalProduct,
  PaypalPlan,
  PaypalSubscription,
  PaypalWebhookEvent,
  PaypalConfig,
} from 'libs/contracts/paypal';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly config: PaypalConfig;
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private readonly configService: ConfigService) {
    const environment = this.configService.get<string>('PAYPAL_ENVIRONMENT', 'sandbox');
    this.config = {
      clientId: this.configService.get<string>('PAYPAL_CLIENT_ID', ''),
      clientSecret: this.configService.get<string>('PAYPAL_CLIENT_SECRET', ''),
      environment: environment as 'sandbox' | 'production',
      webhookId: this.configService.get<string>('PAYPAL_WEBHOOK_ID', ''),
    };
    this.baseUrl = environment === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';
  }

  /**
   * Verifica si PayPal está configurado
   */
  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret);
  }

  /**
   * Obtiene un access token de PayPal
   */
  private async getAccessToken(): Promise<string> {
    // Reutilizar token si aún es válido (con margen de 5 minutos)
    if (this.accessToken && this.tokenExpiry && new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new InternalServerErrorException('PayPal no está configurado');
    }

    try {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal auth error: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      this.logger.log('Access token de PayPal obtenido');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Error obteniendo access token:', error.message);
      throw new InternalServerErrorException('Error autenticando con PayPal');
    }
  }

  /**
   * Crea un producto en PayPal
   */
  async createProduct(dto: CreatePaypalProductDto): Promise<PaypalProduct> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          name: dto.name,
          description: dto.description,
          type: dto.type || 'SERVICE',
          category: dto.category || 'SOFTWARE',
          image_url: dto.imageUrl,
          home_url: dto.homeUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal API error: ${error}`);
      }

      const product = await response.json();
      this.logger.log(`Producto creado: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error('Error creando producto:', error.message);
      throw new InternalServerErrorException('Error creando producto en PayPal');
    }
  }

  /**
   * Crea un plan de suscripción en PayPal
   */
  async createPlan(dto: CreatePaypalPlanDto): Promise<PaypalPlan> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          product_id: dto.productId,
          name: dto.name,
          description: dto.description,
          billing_cycles: dto.billingCycles.map(cycle => ({
            frequency: {
              interval_unit: cycle.frequency.intervalUnit,
              interval_count: cycle.frequency.intervalCount,
            },
            tenure_type: cycle.tenureType,
            sequence: cycle.sequence,
            total_cycles: cycle.totalCycles,
            pricing_scheme: {
              fixed_price: {
                currency_code: cycle.pricingScheme.fixedPrice.currencyCode,
                value: cycle.pricingScheme.fixedPrice.value,
              },
            },
          })),
          payment_preferences: dto.paymentPreferences ? {
            auto_bill_outstanding: dto.paymentPreferences.autoBillOutstanding,
            setup_fee: dto.paymentPreferences.setupFee ? {
              currency_code: dto.paymentPreferences.setupFee.currencyCode,
              value: dto.paymentPreferences.setupFee.value,
            } : undefined,
            setup_fee_failure_action: dto.paymentPreferences.setupFeeFailureAction,
            payment_failure_threshold: dto.paymentPreferences.paymentFailureThreshold,
          } : undefined,
          taxes: dto.taxes ? {
            percentage: dto.taxes.percentage,
            inclusive: dto.taxes.inclusive,
          } : undefined,
          quantity_supported: dto.quantitySupported ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal API error: ${error}`);
      }

      const plan = await response.json();
      this.logger.log(`Plan creado: ${plan.id}`);
      return plan;
    } catch (error) {
      this.logger.error('Error creando plan:', error.message);
      throw new InternalServerErrorException('Error creando plan en PayPal');
    }
  }

  /**
   * Crea una suscripción en PayPal
   */
  async createSubscription(dto: CreatePaypalSubscriptionDto): Promise<PaypalSubscription> {
    const accessToken = await this.getAccessToken();

    try {
      const body: any = {
        plan_id: dto.planId,
        quantity: dto.quantity?.toString() || '1',
      };

      if (dto.startTime) {
        body.start_time = dto.startTime;
      }

      if (dto.shippingAmount) {
        body.shipping_amount = {
          currency_code: dto.shippingAmount.currencyCode,
          value: dto.shippingAmount.value,
        };
      }

      if (dto.applicationContext) {
        body.application_context = {
          brand_name: dto.applicationContext.brandName,
          locale: dto.applicationContext.locale,
          shipping_preference: dto.applicationContext.shippingPreference,
          user_action: dto.applicationContext.userAction,
          payment_method: dto.applicationContext.paymentMethod,
          return_url: dto.applicationContext.returnUrl,
          cancel_url: dto.applicationContext.cancelUrl,
        };
      }

      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal API error: ${error}`);
      }

      const subscription = await response.json();
      this.logger.log(`Suscripción creada: ${subscription.id} para usuario ${dto.userId}`);
      
      // TODO: Guardar en base de datos la relación usuario-suscripción
      
      return subscription;
    } catch (error) {
      this.logger.error('Error creando suscripción:', error.message);
      throw new InternalServerErrorException('Error creando suscripción en PayPal');
    }
  }

  /**
   * Obtiene una suscripción por ID
   */
  async getSubscription(subscriptionId: string): Promise<PaypalSubscription> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PayPal API error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Error obteniendo suscripción:', error.message);
      throw new InternalServerErrorException('Error obteniendo suscripción de PayPal');
    }
  }

  /**
   * Cancela una suscripción
   */
  async cancelSubscription(subscriptionId: string, reason?: string): Promise<void> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason || 'Cancelado por el usuario',
        }),
      });

      if (!response.ok && response.status !== 204) {
        const error = await response.text();
        throw new Error(`PayPal API error: ${error}`);
      }

      this.logger.log(`Suscripción cancelada: ${subscriptionId}`);
      
      // TODO: Actualizar estado en base de datos
      
    } catch (error) {
      this.logger.error('Error cancelando suscripción:', error.message);
      throw new InternalServerErrorException('Error cancelando suscripción en PayPal');
    }
  }

  /**
   * Procesa un webhook de PayPal
   */
  async processWebhook(event: PaypalWebhookEvent): Promise<void> {
    this.logger.log(`Webhook recibido: ${event.eventType} - ${event.id}`);

    // Verificar firma del webhook si es producción
    // if (this.config.environment === 'production') {
    //   await this.verifyWebhookSignature(event);
    // }

    switch (event.eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        await this.handleSubscriptionCreated(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.handleSubscriptionActivated(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await this.handleSubscriptionCancelled(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await this.handleSubscriptionSuspended(event.resource);
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await this.handlePaymentFailed(event.resource);
        break;
      default:
        this.logger.warn(`Evento de webhook no manejado: ${event.eventType}`);
    }
  }

  private async handleSubscriptionCreated(resource: any): Promise<void> {
    this.logger.log(`Suscripción creada en PayPal: ${resource.id}`);
    // TODO: Actualizar base de datos
  }

  private async handleSubscriptionActivated(resource: any): Promise<void> {
    this.logger.log(`Suscripción activada: ${resource.id}`);
    // TODO: Actualizar estado a ACTIVE, otorgar beneficios premium
  }

  private async handleSubscriptionCancelled(resource: any): Promise<void> {
    this.logger.log(`Suscripción cancelada: ${resource.id}`);
    // TODO: Actualizar estado a CANCELLED, revocar beneficios premium
  }

  private async handleSubscriptionSuspended(resource: any): Promise<void> {
    this.logger.log(`Suscripción suspendida: ${resource.id}`);
    // TODO: Actualizar estado a SUSPENDED
  }

  private async handlePaymentFailed(resource: any): Promise<void> {
    this.logger.warn(`Pago fallido para suscripción: ${resource.id}`);
    // TODO: Notificar al usuario, marcar para revisión
  }
}
