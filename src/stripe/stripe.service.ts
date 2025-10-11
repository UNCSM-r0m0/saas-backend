import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
    private readonly logger = new Logger(StripeService.name);
    private readonly stripe: Stripe;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!secretKey || secretKey === '') {
            this.logger.warn('STRIPE_SECRET_KEY not configured, Stripe features will be disabled');
            return;
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2025-09-30.clover',
        });
    }

    /**
     * Crear sesión de checkout para suscripción premium
     */
    async createCheckoutSession(userId: string, priceId: string): Promise<Stripe.Checkout.Session> {
        if (!this.stripe) {
            throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.');
        }

        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            const session = await this.stripe.checkout.sessions.create({
                customer_email: user.email,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${this.configService.get('FRONTEND_URL')}/#/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${this.configService.get('FRONTEND_URL')}/#/payment/cancel`,
                metadata: {
                    userId: userId,
                },
                subscription_data: {
                    metadata: {
                        userId: userId,
                    },
                },
            });

            this.logger.log(`Checkout session created for user ${userId}: ${session.id}`);
            return session;
        } catch (error) {
            this.logger.error(`Error creating checkout session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Crear portal de facturación para gestionar suscripción
     */
    async createBillingPortalSession(userId: string): Promise<Stripe.BillingPortal.Session> {
        if (!this.stripe) {
            throw new Error('Stripe not configured. Please set STRIPE_SECRET_KEY in environment variables.');
        }

        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { subscription: true },
            });

            if (!user || !user.subscription?.stripeCustomerId) {
                throw new Error('Usuario sin suscripción activa');
            }

            const session = await this.stripe.billingPortal.sessions.create({
                customer: user.subscription.stripeCustomerId,
                return_url: `${this.configService.get('FRONTEND_URL')}/dashboard`,
            });

            this.logger.log(`Billing portal session created for user ${userId}: ${session.id}`);
            return session;
        } catch (error) {
            this.logger.error(`Error creating billing portal session: ${error.message}`);
            throw error;
        }
    }

    /**
     * Procesar webhook de Stripe
     */
    async handleWebhook(event: Stripe.Event): Promise<void> {
        this.logger.log(`Processing webhook: ${event.type}`);

        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;

            case 'invoice.payment_succeeded':
                await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;

            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            default:
                this.logger.log(`Unhandled event type: ${event.type}`);
        }
    }

    /**
     * Manejar checkout completado
     */
    private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
        const userId = session.metadata?.userId;
        if (!userId) {
            this.logger.error('No userId in checkout session metadata');
            return;
        }

        const subscription = await this.stripe.subscriptions.retrieve(
            session.subscription as string,
        );

        await this.createOrUpdateSubscription(userId, subscription);
        this.logger.log(`Subscription created for user ${userId}`);
    }

    /**
     * Manejar actualización de suscripción
     */
    private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            this.logger.error('No userId in subscription metadata');
            return;
        }

        await this.createOrUpdateSubscription(userId, subscription);
        this.logger.log(`Subscription updated for user ${userId}`);
    }

    /**
     * Manejar eliminación de suscripción
     */
    private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
        const userId = subscription.metadata?.userId;
        if (!userId) {
            this.logger.error('No userId in subscription metadata');
            return;
        }

        await this.prisma.subscription.updateMany({
            where: { userId },
            data: {
                status: 'CANCELED',
                stripeCurrentPeriodEnd: new Date(),
            },
        });

        this.logger.log(`Subscription canceled for user ${userId}`);
    }

    /**
     * Manejar pago exitoso
     */
    private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
        // Los pagos exitosos se manejan en checkout.session.completed
        this.logger.log(`Payment succeeded for invoice ${invoice.id}`);
    }

    /**
     * Manejar pago fallido
     */
    private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        // Los pagos fallidos se manejan en customer.subscription.updated con status past_due
        this.logger.log(`Payment failed for invoice ${invoice.id}`);
    }

    /**
     * Crear o actualizar suscripción en la base de datos
     */
    private async createOrUpdateSubscription(
        userId: string,
        stripeSubscription: Stripe.Subscription,
    ): Promise<void> {
        const tier = this.getTierFromPriceId(stripeSubscription.items.data[0]?.price.id);
        const status = this.mapStripeStatusToSubscriptionStatus(stripeSubscription.status);

        await this.prisma.subscription.upsert({
            where: { userId },
            update: {
                tier,
                status,
                stripeCustomerId: stripeSubscription.customer as string,
                stripeSubscriptionId: stripeSubscription.id,
            },
            create: {
                userId,
                tier,
                status,
                stripeCustomerId: stripeSubscription.customer as string,
                stripeSubscriptionId: stripeSubscription.id,
            },
        });
    }

    /**
     * Mapear ID de precio a tier
     */
    private getTierFromPriceId(priceId: string): 'PREMIUM' {
        // Por ahora solo tenemos PREMIUM, pero puedes expandir esto
        return 'PREMIUM';
    }

    /**
     * Mapear estado de Stripe a estado de suscripción
     */
    private mapStripeStatusToSubscriptionStatus(
        stripeStatus: Stripe.Subscription.Status,
    ): 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'TRIALING' {
        switch (stripeStatus) {
            case 'active':
                return 'ACTIVE';
            case 'canceled':
                return 'CANCELED';
            case 'incomplete':
            case 'incomplete_expired':
            case 'past_due':
            case 'unpaid':
                return 'EXPIRED';
            case 'trialing':
                return 'TRIALING';
            default:
                return 'EXPIRED';
        }
    }

    /**
     * Obtener información de suscripción del usuario
     */
    async getUserSubscription(userId: string) {
        return this.prisma.subscription.findUnique({
            where: { userId },
        });
    }
}
