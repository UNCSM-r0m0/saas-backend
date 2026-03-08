import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  AUTH_PATTERNS,
  AuthRegisterPayload,
  AuthValidateUserPayload,
  AuthValidateOAuthPayload,
  AuthIssueTokensPayload,
  AuthRefreshPayload,
  AuthRevokePayload,
  AuthTokensResponse,
  RegisterDto,
} from 'libs/contracts/auth';
import { User } from 'libs/users';

@Injectable()
export class AuthClient {
  private readonly logger = new Logger(AuthClient.name);

  constructor(@Inject('AUTH_NATS') private readonly client: ClientProxy) {}

  private async send<T>(pattern: string, payload?: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.client.send<T>(pattern, payload ?? {}));
    } catch (error: any) {
      const statusCode =
        error?.statusCode ?? error?.response?.statusCode ?? 500;
      const message = error?.message ?? 'Auth service error';
      this.logger.error(`Auth NATS error: ${message}`);
      throw new HttpException(message, statusCode);
    }
  }

  register(dto: RegisterDto): Promise<AuthTokensResponse> {
    const payload: AuthRegisterPayload = { data: dto };
    return this.send<AuthTokensResponse>(AUTH_PATTERNS.register, payload);
  }

  validateUser(email: string, password: string): Promise<User | null> {
    const payload: AuthValidateUserPayload = { email, password };
    return this.send<User | null>(AUTH_PATTERNS.validateUser, payload);
  }

  validateOAuthUser(profile: any): Promise<User> {
    const payload: AuthValidateOAuthPayload = { profile };
    return this.send<User>(AUTH_PATTERNS.validateOAuthUser, payload);
  }

  issueTokens(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<AuthTokensResponse> {
    const payload: AuthIssueTokensPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return this.send<AuthTokensResponse>(AUTH_PATTERNS.issueTokens, payload);
  }

  refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const payload: AuthRefreshPayload = { refreshToken };
    return this.send<AuthTokensResponse>(AUTH_PATTERNS.refresh, payload);
  }

  revoke(refreshToken: string): Promise<{ ok: true }> {
    const payload: AuthRevokePayload = { refreshToken };
    return this.send<{ ok: true }>(AUTH_PATTERNS.revoke, payload);
  }
}
