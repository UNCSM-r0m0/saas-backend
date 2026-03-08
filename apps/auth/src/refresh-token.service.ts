import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';

function parseDurationToMs(value: string, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  createRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  async persist(userId: string, refreshToken: string, ttl: string) {
    const ttlMs = parseDurationToMs(ttl, 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + ttlMs);
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
    return { expiresAt };
  }

  async rotate(refreshToken: string, ttl: string) {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing || existing.revokedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const nextToken = this.createRefreshToken();
    const { expiresAt } = await this.persist(existing.userId, nextToken, ttl);
    return { user: existing.user, refreshToken: nextToken, expiresAt };
  }

  async revoke(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
