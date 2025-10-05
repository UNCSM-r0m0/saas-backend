import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionTier } from '@prisma/client';

@Injectable()
export class UsageService {
    private readonly logger = new Logger(UsageService.name);

    constructor(
        private prisma: PrismaService,
        private subscriptionsService: SubscriptionsService,
    ) { }

    /**
     * Verifica si un usuario (o anónimo) puede enviar un mensaje
     */
    async canSendMessage(
        userId?: string,
        anonymousId?: string,
    ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Obtener tier del usuario
        let tier: SubscriptionTier = SubscriptionTier.FREE;
        if (userId) {
            const subscription =
                await this.subscriptionsService.getOrCreateSubscription(userId);
            tier = subscription.tier;
        }

        // Obtener límites según tier
        const limits = this.subscriptionsService.getUserLimits(tier);

        // Buscar o crear registro de uso del día
        const usageRecord = await this.prisma.usageRecord.upsert({
            where: userId
                ? { userId_date: { userId, date: today } }
                : { anonymousId_date: { anonymousId: anonymousId!, date: today } },
            create: {
                userId,
                anonymousId,
                date: today,
                messageCount: 0,
                tokensUsed: 0,
            },
            update: {},
        });

        const allowed = usageRecord.messageCount < limits.messagesPerDay;
        const remaining = Math.max(
            0,
            limits.messagesPerDay - usageRecord.messageCount,
        );

        return {
            allowed,
            remaining,
            limit: limits.messagesPerDay,
        };
    }

    /**
     * Incrementa el contador de mensajes
     */
    async incrementMessageCount(
        tokensUsed: number,
        userId?: string,
        anonymousId?: string,
    ): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.usageRecord.upsert({
            where: userId
                ? { userId_date: { userId, date: today } }
                : { anonymousId_date: { anonymousId: anonymousId!, date: today } },
            create: {
                userId,
                anonymousId,
                date: today,
                messageCount: 1,
                tokensUsed,
            },
            update: {
                messageCount: { increment: 1 },
                tokensUsed: { increment: tokensUsed },
            },
        });

        this.logger.log(
            `Mensaje registrado: ${userId || anonymousId} (${tokensUsed} tokens)`,
        );
    }

    /**
     * Obtiene estadísticas de uso de un usuario
     */
    async getUserStats(userId: string): Promise<{
        todayMessages: number;
        todayTokens: number;
        totalMessages: number;
        totalTokens: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Uso de hoy
        const todayUsage = await this.prisma.usageRecord.findUnique({
            where: { userId_date: { userId, date: today } },
        });

        // Uso total
        const totalUsage = await this.prisma.usageRecord.aggregate({
            where: { userId },
            _sum: {
                messageCount: true,
                tokensUsed: true,
            },
        });

        return {
            todayMessages: todayUsage?.messageCount || 0,
            todayTokens: todayUsage?.tokensUsed || 0,
            totalMessages: totalUsage._sum.messageCount || 0,
            totalTokens: totalUsage._sum.tokensUsed || 0,
        };
    }

    /**
     * Limpia registros antiguos (más de 30 días)
     */
    async cleanupOldRecords(): Promise<number> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await this.prisma.usageRecord.deleteMany({
            where: {
                date: { lt: thirtyDaysAgo },
            },
        });

        this.logger.log(`${result.count} registros antiguos eliminados`);
        return result.count;
    }
}
