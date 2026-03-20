import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import {
  PAYPAL_PATTERNS,
  CreatePaypalProductDto,
  CreatePaypalPlanDto,
  CreatePaypalSubscriptionDto,
} from 'libs/contracts/paypal';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private paypalClient: ClientProxy;

  constructor(private readonly configService: ConfigService) {
    const natsUrl = this.configService.get<string>('NATS_URL', 'nats://localhost:4222');
    
    this.paypalClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [natsUrl],
      },
    });
  }

  /**
   * Obtiene la configuración pública para el frontend
   */
  getPublicConfig() {
    return {
      clientId: this.configService.get<string>('PAYPAL_CLIENT_ID', ''),
      environment: this.configService.get<string>('PAYPAL_ENVIRONMENT', 'sandbox'),
    };
  }

  /**
   * Crea un producto en PayPal
   */
  async createProduct(dto: CreatePaypalProductDto) {
    try {
      const result = await lastValueFrom(
        this.paypalClient.send(PAYPAL_PATTERNS.createProduct, dto),
      );
      return result;
    } catch (error) {
      this.logger.error('Error creando producto:', error.message);
      throw error;
    }
  }

  /**
   * Crea un plan en PayPal
   */
  async createPlan(dto: CreatePaypalPlanDto) {
    try {
      const result = await lastValueFrom(
        this.paypalClient.send(PAYPAL_PATTERNS.createPlan, dto),
      );
      return result;
    } catch (error) {
      this.logger.error('Error creando plan:', error.message);
      throw error;
    }
  }

  /**
   * Crea una suscripción en PayPal
   */
  async createSubscription(dto: CreatePaypalSubscriptionDto & { userId: string }) {
    try {
      const result = await lastValueFrom(
        this.paypalClient.send(PAYPAL_PATTERNS.createSubscription, dto),
      );
      return result;
    } catch (error) {
      this.logger.error('Error creando suscripción:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene una suscripción por ID
   */
  async getSubscription(subscriptionId: string) {
    try {
      const result = await lastValueFrom(
        this.paypalClient.send(PAYPAL_PATTERNS.getSubscription, { subscriptionId }),
      );
      return result;
    } catch (error) {
      this.logger.error('Error obteniendo suscripción:', error.message);
      throw error;
    }
  }

  /**
   * Cancela una suscripción
   */
  async cancelSubscription(subscriptionId: string, reason?: string) {
    try {
      const result = await lastValueFrom(
        this.paypalClient.send(PAYPAL_PATTERNS.cancelSubscription, { 
          subscriptionId, 
          reason 
        }),
      );
      return result;
    } catch (error) {
      this.logger.error('Error cancelando suscripción:', error.message);
      throw error;
    }
  }

  /**
   * Procesa eventos de webhook
   */
  async processWebhookEvent(payload: any) {
    try {
      // Emitir evento al microservicio (fire and forget)
      this.paypalClient.emit(PAYPAL_PATTERNS.webhook, payload);
      this.logger.log(`Evento webhook enviado: ${payload.event_type}`);
    } catch (error) {
      this.logger.error('Error procesando webhook:', error.message);
      throw error;
    }
  }
}
