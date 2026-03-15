import { Inject, Injectable, HttpException, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  USERS_PATTERNS,
  UsersCreatePayload,
  UsersFindOnePayload,
  UsersUpdatePayload,
  UsersRemovePayload,
  UsersFindByEmailPayload,
  UsersHealthResponseV1,
  UsersUpdateLastLoginPayload,
  UsersResponseEnvelopeV1,
  CreateUserDto,
  UpdateUserDto,
} from 'libs/contracts/users';

@Injectable()
export class UsersClient {
  private readonly logger = new Logger(UsersClient.name);

  constructor(@Inject('USERS_NATS') private readonly client: ClientProxy) {}

  private unwrapV1<T>(response: T | UsersResponseEnvelopeV1<T>): T {
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

  // Centralized send to keep controller thin and errors consistent.
  private async send<T>(pattern: string, payload?: unknown): Promise<T> {
    try {
      const raw = await lastValueFrom(
        this.client.send<T | UsersResponseEnvelopeV1<T>>(
          pattern,
          payload ?? {},
        ),
      );
      return this.unwrapV1<T>(raw);
    } catch (error: any) {
      const statusCode =
        error?.statusCode ?? error?.response?.statusCode ?? 500;
      const message = error?.message ?? 'Users service error';
      this.logger.error(`Users NATS error: ${message}`);
      throw new HttpException(message, statusCode);
    }
  }

  create(dto: CreateUserDto): Promise<any> {
    const payload: UsersCreatePayload = { data: dto };
    return this.send<any>(USERS_PATTERNS.create, payload);
  }

  findAll(): Promise<any[]> {
    return this.send<any[]>(USERS_PATTERNS.findAll);
  }

  findOne(id: string): Promise<any> {
    const payload: UsersFindOnePayload = { id };
    return this.send<any>(USERS_PATTERNS.findOne, payload);
  }

  update(id: string, dto: UpdateUserDto): Promise<any> {
    const payload: UsersUpdatePayload = { id, data: dto };
    return this.send<any>(USERS_PATTERNS.update, payload);
  }

  remove(id: string): Promise<any> {
    const payload: UsersRemovePayload = { id };
    return this.send<any>(USERS_PATTERNS.remove, payload);
  }

  findByEmail(email: string): Promise<any | null> {
    const payload: UsersFindByEmailPayload = { email };
    return this.send<any | null>(USERS_PATTERNS.findByEmail, payload);
  }

  updateLastLogin(id: string): Promise<void> {
    const payload: UsersUpdateLastLoginPayload = { id };
    return this.send<void>(USERS_PATTERNS.updateLastLogin, payload);
  }

  health(): Promise<UsersHealthResponseV1> {
    return this.send<UsersHealthResponseV1>(USERS_PATTERNS.health, {});
  }
}
