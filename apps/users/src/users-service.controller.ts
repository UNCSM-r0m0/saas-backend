import { Controller, HttpException } from '@nestjs/common';
import { MessagePattern, RpcException } from '@nestjs/microservices';
import { USERS_PATTERNS } from 'libs/contracts/users';
import type {
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
    return { service: 'users', status: 'ok' };
  }

  @MessagePattern(USERS_PATTERNS.create)
  async create(payload: UsersCreatePayload) {
    try {
      // UsersService already returns sanitized User entities.
      return await this.usersService.create(payload.data);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findAll)
  async findAll() {
    try {
      return await this.usersService.findAll();
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findOne)
  async findOne(payload: UsersFindOnePayload) {
    try {
      return await this.usersService.findOne(payload.id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.update)
  async update(payload: UsersUpdatePayload) {
    try {
      return await this.usersService.update(payload.id, payload.data);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.remove)
  async remove(payload: UsersRemovePayload) {
    try {
      return await this.usersService.remove(payload.id);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.findByEmail)
  async findByEmail(payload: UsersFindByEmailPayload) {
    try {
      return await this.usersService.findByEmail(payload.email);
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern(USERS_PATTERNS.updateLastLogin)
  async updateLastLogin(payload: UsersUpdateLastLoginPayload) {
    try {
      await this.usersService.updateLastLogin(payload.id);
      return { ok: true };
    } catch (error) {
      this.handleError(error);
    }
  }
}
