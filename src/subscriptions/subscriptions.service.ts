import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
    SubscriptionTier,
    SubscriptionStatus,
    Subscription,
} from '@prisma/client';

export interface UserLimits {
    tier: SubscriptionTier;
    messagesPerDay: number;
    maxTokensPerMessage: number;
    canUploadImages: boolean;
}

@Injectable()
export class SubscriptionsService {
    private readonly logger = new Logger(SubscriptionsService.name);

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) { }

    /**
     * Obtiene o crea una suscripción para un usuario
     */
    async getOrCreateSubscription(userId: string): Promise<Subscription> {
        let subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            subscription = await this.prisma.subscription.create({
                data: {
                    userId,
                    tier: SubscriptionTier.REGISTERED,
                    status: SubscriptionStatus.ACTIVE,
                },
            });
            this.logger.log(`Suscripción REGISTERED creada para usuario ${userId}`);
        }

        return subscription;
    }

    /**
     * Obtiene los límites de uso según el tier del usuario
     */
    getUserLimits(tier: SubscriptionTier): UserLimits {
        switch (tier) {
            case SubscriptionTier.FREE:
                return {
                    tier: SubscriptionTier.FREE,
                    messagesPerDay: this.configService.get<number>(
                        'FREE_USER_MESSAGE_LIMIT',
                        3,
                    ),
                    maxTokensPerMessage: this.configService.get<number>(
                        'FREE_USER_MAX_TOKENS',
                        512,
                    ),
                    canUploadImages: false,
                };

            case SubscriptionTier.REGISTERED:
                return {
                    tier: SubscriptionTier.REGISTERED,
                    messagesPerDay: this.configService.get<number>(
                        'REGISTERED_USER_MESSAGE_LIMIT',
                        10,
                    ),
                    maxTokensPerMessage: this.configService.get<number>(
                        'REGISTERED_USER_MAX_TOKENS',
                        2048,
                    ),
                    canUploadImages: false,
                };

            case SubscriptionTier.PREMIUM:
                return {
                    tier: SubscriptionTier.PREMIUM,
                    messagesPerDay: this.configService.get<number>(
                        'PREMIUM_USER_MESSAGE_LIMIT',
                        1000,
                    ),
                    maxTokensPerMessage: this.configService.get<number>(
                        'PREMIUM_USER_MAX_TOKENS',
                        8192,
                    ),
                    canUploadImages: true,
                };

            default:
                return this.getUserLimits(SubscriptionTier.FREE);
        }
    }

    /**
     * Actualiza el tier de una suscripción
     */
    async updateSubscriptionTier(
        userId: string,
        tier: SubscriptionTier,
    ): Promise<Subscription> {
        const subscription = await this.prisma.subscription.update({
            where: { userId },
            data: { tier },
        });

        this.logger.log(`Suscripción actualizada a ${tier} para usuario ${userId}`);
        return subscription;
    }

    /**
     * Cancela una suscripción (cambiar status a CANCELED)
     */
    async cancelSubscription(userId: string): Promise<Subscription> {
        return this.prisma.subscription.update({
            where: { userId },
            data: { status: SubscriptionStatus.CANCELED },
        });
    }

    /**
     * Verifica si una suscripción está activa
     */
    async isSubscriptionActive(userId: string): Promise<boolean> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) return false;

        // Verificar si la suscripción no ha expirado (para Stripe)
        if (
            subscription.stripeCurrentPeriodEnd &&
            subscription.stripeCurrentPeriodEnd < new Date()
        ) {
            return false;
        }

        return subscription.status === SubscriptionStatus.ACTIVE;
    }

    /**
     * Maneja webhook de Stripe (para activar premium)
     */
    async handleStripeWebhook(event: any): Promise<void> {
        const { type, data } = event;

        switch (type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(data.object);
                break;

            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(data.object);
                break;

            case 'customer.subscription.deleted':
                await this.handleSubscriptionCanceled(data.object);
                break;

            default:
                this.logger.warn(`Evento Stripe no manejado: ${type}`);
        }
    }

    private async handleCheckoutCompleted(session: any): Promise<void> {
        const userId = session.client_reference_id;
        if (!userId) return;

        await this.prisma.subscription.upsert({
            where: { userId },
            create: {
                userId,
                tier: SubscriptionTier.PREMIUM,
                status: SubscriptionStatus.ACTIVE,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
            },
            update: {
                tier: SubscriptionTier.PREMIUM,
                status: SubscriptionStatus.ACTIVE,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
            },
        });

        this.logger.log(`Usuario ${userId} actualizado a PREMIUM via Stripe`);
    }

    private async handleSubscriptionUpdated(subscription: any): Promise<void> {
        const sub = await this.prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscription.id },
        });

        if (!sub) return;

        await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
                status:
                    subscription.status === 'active'
                        ? SubscriptionStatus.ACTIVE
                        : SubscriptionStatus.CANCELED,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000,
                ),
            },
        });
    }

    private async handleSubscriptionCanceled(subscription: any): Promise<void> {
        const sub = await this.prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscription.id },
        });

        if (!sub) return;

        await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
                tier: SubscriptionTier.REGISTERED,
                status: SubscriptionStatus.CANCELED,
            },
        });

        this.logger.log(
            `Suscripción cancelada para usuario ${sub.userId}, downgrade a REGISTERED`,
        );
    }
}
