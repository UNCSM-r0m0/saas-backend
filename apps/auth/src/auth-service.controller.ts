import { Controller, HttpException } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { AUTH_PATTERNS } from 'libs/contracts/auth';
import type {
  AuthRegisterPayload,
  AuthValidateUserPayload,
  AuthValidateOAuthPayload,
  AuthIssueTokensPayload,
  AuthRefreshPayload,
  AuthRevokePayload,
} from 'libs/contracts/auth';
import { AuthDomainService } from './auth-domain.service';
import { AuthTokenService } from './auth-token.service';

@Controller()
export class AuthServiceController {
  constructor(
    private readonly authService: AuthDomainService,
    private readonly tokenService: AuthTokenService,
  ) {}

  private handleError(error: unknown): never {
    if (error instanceof HttpException) {
      throw new RpcException({
        statusCode: error.getStatus(),
        message: error.message,
      });
    }

    const fallbackMessage = (error as any)?.message || 'Auth service error';
    throw new RpcException({ statusCode: 500, message: fallbackMessage });
  }

  @MessagePattern(AUTH_PATTERNS.health)
  health() {
    return { service: 'auth', status: 'ok' };
  }

  @MessagePattern(AUTH_PATTERNS.register)
  async register(payload: AuthRegisterPayload) {
    try {
      const user = await this.authService.register(payload.data);
      const tokens = await this.tokenService.issueTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });
      return { ...tokens, user };
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.validateUser)
  async validateUser(payload: AuthValidateUserPayload) {
    try {
      return await this.authService.validateUser(
        payload.email,
        payload.password,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.validateOAuthUser)
  async validateOAuthUser(payload: AuthValidateOAuthPayload) {
    try {
      return await this.authService.validateOAuthUser(payload.profile);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.issueTokens)
  async issueTokens(payload: AuthIssueTokensPayload) {
    try {
      const tokens = await this.tokenService.issueTokens({
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      });
      return tokens;
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.refresh)
  async refresh(payload: AuthRefreshPayload) {
    try {
      return await this.tokenService.rotateTokens(payload.refreshToken);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.revoke)
  async revoke(payload: AuthRevokePayload) {
    try {
      await this.tokenService.revoke(payload.refreshToken);
      return { ok: true };
    } catch (error) {
      this.handleError(error);
    }
  }
}
