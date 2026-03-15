import { Controller, HttpException } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { AUTH_PATTERNS } from 'libs/contracts/auth';
import type {
  AuthResponseEnvelopeV1,
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

  private v1<T>(data: T): AuthResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

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
    return this.v1({ service: 'auth', status: 'ok' as const });
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
      return this.v1({ ...tokens, user });
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.validateUser)
  async validateUser(payload: AuthValidateUserPayload) {
    try {
      return this.v1(
        await this.authService.validateUser(payload.email, payload.password),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.validateOAuthUser)
  async validateOAuthUser(payload: AuthValidateOAuthPayload) {
    try {
      return this.v1(await this.authService.validateOAuthUser(payload.profile));
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
      return this.v1(tokens);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.refresh)
  async refresh(payload: AuthRefreshPayload) {
    try {
      return this.v1(
        await this.tokenService.rotateTokens(payload.refreshToken),
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(AUTH_PATTERNS.revoke)
  async revoke(payload: AuthRevokePayload) {
    try {
      await this.tokenService.revoke(payload.refreshToken);
      return this.v1({ ok: true as const });
    } catch (error) {
      this.handleError(error);
    }
  }
}
