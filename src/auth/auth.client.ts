import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  AUTH_PATTERNS,
  AuthRegisterPayload,
  AuthValidateUserPayload,
  AuthValidateOAuthPayload,
  AuthIssueTokensPayload,
  AuthResponseEnvelopeV1,
  AuthRefreshPayload,
  AuthRevokePayload,
  AuthHealthResponseV1,
  AuthTokensResponse,
  RegisterDto,
} from 'libs/contracts/auth';
import { User } from 'libs/users';

@Injectable()
export class AuthClient {
  private readonly logger = new Logger(AuthClient.name);

  constructor(@Inject('AUTH_NATS') private readonly client: ClientProxy) {}

  private unwrapV1<T>(response: T | AuthResponseEnvelopeV1<T>): T {
    if (
      response &&
      typeof response === 'object' &&
      'version' in (response as any) &&
      (response as any).version === 'v1' &&
      'data' in (response as any)
    ) {
      return (response as any).data as T;
    }
    return response as T;
  }

  private async send<T>(pattern: string, payload?: unknown): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.client.send<T | AuthResponseEnvelopeV1<T>>(pattern, payload ?? {}),
      );
      return this.unwrapV1<T>(raw);
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

  health(): Promise<AuthHealthResponseV1> {
    return this.send<AuthHealthResponseV1>(AUTH_PATTERNS.health, {});
  }
}
