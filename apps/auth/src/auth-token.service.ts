import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  private accessExpires() {
    return this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m';
  }

  private refreshExpires() {
    return this.configService.get<string>('JWT_REFRESH_EXPIRES') || '30d';
  }

  async issueTokens(user: { id: string; email: string; role: string }) {
    const access_token = this.jwtService.sign(
      { email: user.email, sub: user.id, role: user.role },
      { expiresIn: this.accessExpires() },
    );

    const refresh_token = this.refreshTokens.createRefreshToken();
    await this.refreshTokens.persist(
      user.id,
      refresh_token,
      this.refreshExpires(),
    );

    return { access_token, refresh_token };
  }

  async rotateTokens(refreshToken: string) {
    const { user, refreshToken: nextToken } = await this.refreshTokens.rotate(
      refreshToken,
      this.refreshExpires(),
    );
    const access_token = this.jwtService.sign(
      { email: user.email, sub: user.id, role: user.role },
      { expiresIn: this.accessExpires() },
    );

    return { access_token, refresh_token: nextToken, user };
  }

  async revoke(refreshToken: string) {
    await this.refreshTokens.revoke(refreshToken);
  }
}
