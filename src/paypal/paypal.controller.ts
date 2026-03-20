import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  Logger,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaypalService } from './paypal.service';
import {
  CreatePaypalProductDto,
  CreatePaypalPlanDto,
  CreatePaypalSubscriptionDto,
} from './dto';

@ApiTags('paypal')
@Controller('paypal')
export class PaypalController {
  private readonly logger = new Logger(PaypalController.name);

  constructor(private readonly paypalService: PaypalService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook de PayPal para eventos de suscripción' })
  async handleWebhook(
    @Body() payload: any,
    @Headers('paypal-transmission-id') transmissionId: string,
    @Headers('paypal-cert-id') certId: string,
    @Headers('paypal-auth-algo') authAlgo: string,
    @Headers('paypal-transmission-sig') transmissionSig: string,
    @Headers('paypal-transmission-time') transmissionTime: string,
    @Req() req: Request,
  ) {
    this.logger.log(`Webhook recibido: ${payload.event_type || 'unknown'}`);

    // TODO: Verificar firma del webhook en producción
    // if (process.env.NODE_ENV === 'production') {
    //   await this.paypalService.verifyWebhookSignature({...});
    // }

    await this.paypalService.processWebhookEvent(payload);

    return { received: true };
  }

  @Post('products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un producto en PayPal' })
  async createProduct(@Body() dto: CreatePaypalProductDto) {
    this.logger.log(`Creando producto: ${dto.name}`);
    return this.paypalService.createProduct(dto);
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un plan de suscripción en PayPal' })
  async createPlan(@Body() dto: CreatePaypalPlanDto) {
    this.logger.log(`Creando plan para producto: ${dto.productId}`);
    return this.paypalService.createPlan(dto);
  }

  @Post('subscriptions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una suscripción en PayPal' })
  async createSubscription(
    @Body() dto: CreatePaypalSubscriptionDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }

    this.logger.log(`Creando suscripción para usuario: ${userId}`);
    return this.paypalService.createSubscription({
      ...dto,
      userId,
    });
  }

  @Get('subscriptions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener detalles de una suscripción' })
  async getSubscription(@Param('id') subscriptionId: string) {
    this.logger.log(`Consultando suscripción: ${subscriptionId}`);
    return this.paypalService.getSubscription(subscriptionId);
  }

  @Post('subscriptions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar una suscripción' })
  async cancelSubscription(
    @Param('id') subscriptionId: string,
    @Body('reason') reason?: string,
  ) {
    this.logger.log(`Cancelando suscripción: ${subscriptionId}`);
    await this.paypalService.cancelSubscription(subscriptionId, reason);
    return { success: true };
  }

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración pública de PayPal (Client ID)' })
  getConfig() {
    return this.paypalService.getPublicConfig();
  }
}
