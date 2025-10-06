import {
    Controller,
    Post,
    Get,
    Body,
    Req,
    UseGuards,
    Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@ApiTags('stripe')
@Controller('stripe')
export class StripeController {
    constructor(
        private readonly stripeService: StripeService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Crear sesión de checkout para suscripción premium
     */
    @Post('create-checkout-session')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Crear sesión de checkout para suscripción premium',
        description: 'Crea una sesión de Stripe Checkout para que el usuario se suscriba al plan premium',
    })
    @ApiResponse({
        status: 200,
        description: 'Sesión de checkout creada exitosamente',
        schema: {
            example: {
                url: 'https://checkout.stripe.com/pay/cs_test_...',
                sessionId: 'cs_test_...',
            },
        },
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                priceId: {
                    type: 'string',
                    example: 'price_1234567890',
                    description: 'ID del precio de Stripe para el plan premium',
                },
            },
            required: ['priceId'],
        },
    })
    async createCheckoutSession(
        @Body('priceId') priceId: string,
        @Req() req: any,
    ) {
        const session = await this.stripeService.createCheckoutSession(
            req.user.id,
            priceId,
        );

        return {
            url: session.url,
            sessionId: session.id,
        };
    }

    /**
     * Crear sesión del portal de facturación
     */
    @Post('create-portal-session')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Crear sesión del portal de facturación',
        description: 'Crea una sesión del portal de facturación de Stripe para gestionar la suscripción',
    })
    @ApiResponse({
        status: 200,
        description: 'Sesión del portal creada exitosamente',
        schema: {
            example: {
                url: 'https://billing.stripe.com/p/session/...',
            },
        },
    })
    async createPortalSession(@Req() req: any) {
        const session = await this.stripeService.createBillingPortalSession(
            req.user.id,
        );

        return {
            url: session.url,
        };
    }

    /**
     * Obtener información de suscripción del usuario
     */
    @Get('subscription')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Obtener información de suscripción',
        description: 'Obtiene la información de suscripción actual del usuario',
    })
    @ApiResponse({
        status: 200,
        description: 'Información de suscripción',
        schema: {
            example: {
                id: 'sub_1234567890',
                tier: 'PREMIUM',
                status: 'ACTIVE',
                currentPeriodStart: '2025-01-01T00:00:00.000Z',
                currentPeriodEnd: '2025-02-01T00:00:00.000Z',
                stripeCustomerId: 'cus_1234567890',
                stripeSubscriptionId: 'sub_1234567890',
            },
        },
    })
    async getUserSubscription(@Req() req: any) {
        return this.stripeService.getUserSubscription(req.user.id);
    }

    /**
     * Webhook de Stripe
     */
    @Post('webhook')
    @ApiOperation({
        summary: 'Webhook de Stripe',
        description: 'Endpoint para recibir webhooks de Stripe',
    })
    @ApiResponse({
        status: 200,
        description: 'Webhook procesado exitosamente',
    })
    async handleWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ) {
        const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is required');
        }

        let event: Stripe.Event;

        try {
            // Verificar la firma del webhook
            event = Stripe.webhooks.constructEvent(
                req.rawBody || Buffer.alloc(0),
                signature,
                webhookSecret,
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            throw new Error('Invalid signature');
        }

        // Procesar el webhook
        await this.stripeService.handleWebhook(event);

        return { received: true };
    }
}
