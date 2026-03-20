import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { PaypalService } from './paypal.service';
import { PAYPAL_PATTERNS } from 'libs/contracts/paypal';
import type {
  CreatePaypalProductDto,
  CreatePaypalPlanDto,
  CreatePaypalSubscriptionDto,
  PaypalWebhookEvent,
  PaypalResponseEnvelopeV1,
} from 'libs/contracts/paypal';

@Controller()
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(private readonly paypalService: PaypalService) {}

  private v1<T>(data: T): PaypalResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

  @MessagePattern(PAYPAL_PATTERNS.health)
  health() {
    return this.v1({ 
      service: 'paypal', 
      status: 'ok' as const,
      configured: this.paypalService.isConfigured(),
    });
  }

  @MessagePattern(PAYPAL_PATTERNS.createProduct)
  async createProduct(@Payload() dto: CreatePaypalProductDto) {
    this.logger.log(`Creando producto: ${dto.name}`);
    const product = await this.paypalService.createProduct(dto);
    return this.v1(product);
  }

  @MessagePattern(PAYPAL_PATTERNS.createPlan)
  async createPlan(@Payload() dto: CreatePaypalPlanDto) {
    this.logger.log(`Creando plan para producto: ${dto.productId}`);
    const plan = await this.paypalService.createPlan(dto);
    return this.v1(plan);
  }

  @MessagePattern(PAYPAL_PATTERNS.createSubscription)
  async createSubscription(@Payload() dto: CreatePaypalSubscriptionDto) {
    this.logger.log(`Creando suscripción para usuario: ${dto.userId}`);
    const subscription = await this.paypalService.createSubscription(dto);
    return this.v1(subscription);
  }

  @MessagePattern(PAYPAL_PATTERNS.getSubscription)
  async getSubscription(@Payload() payload: { subscriptionId: string }) {
    this.logger.log(`Obteniendo suscripción: ${payload.subscriptionId}`);
    const subscription = await this.paypalService.getSubscription(payload.subscriptionId);
    return this.v1(subscription);
  }

  @MessagePattern(PAYPAL_PATTERNS.cancelSubscription)
  async cancelSubscription(@Payload() payload: { subscriptionId: string; reason?: string }) {
    this.logger.log(`Cancelando suscripción: ${payload.subscriptionId}`);
    await this.paypalService.cancelSubscription(payload.subscriptionId, payload.reason);
    return this.v1({ success: true });
  }

  @EventPattern(PAYPAL_PATTERNS.webhook)
  async handleWebhook(@Payload() event: PaypalWebhookEvent) {
    this.logger.log(`Procesando webhook: ${event.eventType}`);
    await this.paypalService.processWebhook(event);
  }
}
