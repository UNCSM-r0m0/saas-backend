import { Controller, HttpException } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { USERS_PATTERNS } from 'libs/contracts/users';
import type {
  UsersResponseEnvelopeV1,
  UsersCreatePayload,
  UsersFindOnePayload,
  UsersUpdatePayload,
  UsersRemovePayload,
  UsersFindByEmailPayload,
  UsersUpdateLastLoginPayload,
} from 'libs/contracts/users';
import { UsersService } from 'libs/users';

@Controller()
export class UsersServiceController {
  constructor(private readonly usersService: UsersService) {}

  private v1<T>(data: T): UsersResponseEnvelopeV1<T> {
    return { version: 'v1', data };
  }

  // Map HTTP-style errors to RPC errors so the gateway can translate them.
  private handleError(error: unknown): never {
    if (error instanceof HttpException) {
      throw new RpcException({
        statusCode: error.getStatus(),
        message: error.message,
      });
    }

    const fallbackMessage = (error as any)?.message || 'Users service error';
    throw new RpcException({ statusCode: 500, message: fallbackMessage });
  }

  @MessagePattern(USERS_PATTERNS.health)
  health() {
    return this.v1({ service: 'users', status: 'ok' as const });
  }

  @MessagePattern(USERS_PATTERNS.create)
  async create(payload: UsersCreatePayload) {
    try {
      // UsersService already returns sanitized User entities.
      return this.v1(await this.usersService.create(payload.data));
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findAll)
  async findAll() {
    try {
      return this.v1(await this.usersService.findAll());
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findOne)
  async findOne(payload: UsersFindOnePayload) {
    try {
      return this.v1(await this.usersService.findOne(payload.id));
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.update)
  async update(payload: UsersUpdatePayload) {
    try {
      return this.v1(await this.usersService.update(payload.id, payload.data));
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.remove)
  async remove(payload: UsersRemovePayload) {
    try {
      return this.v1(await this.usersService.remove(payload.id));
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findByEmail)
  async findByEmail(payload: UsersFindByEmailPayload) {
    try {
      return this.v1(await this.usersService.findByEmail(payload.email));
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.updateLastLogin)
  async updateLastLogin(payload: UsersUpdateLastLoginPayload) {
    try {
      await this.usersService.updateLastLogin(payload.id);
      return this.v1({ ok: true as const });
    } catch (error) {
      this.handleError(error);
    }
  }
}
