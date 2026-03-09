import { AuthServiceController } from '../../apps/auth/src/auth-service.controller';
import { UsersServiceController } from '../../apps/users/src/users-service.controller';

describe('NATS v1 envelope compatibility', () => {
  it('auth health should return v1 envelope', () => {
    const authService = {
      register: jest.fn(),
      validateUser: jest.fn(),
      validateOAuthUser: jest.fn(),
    };
    const tokenService = {
      issueTokens: jest.fn(),
      rotateTokens: jest.fn(),
      revoke: jest.fn(),
    };
    const controller = new AuthServiceController(
      authService as any,
      tokenService as any,
    );

    expect(controller.health()).toEqual({
      version: 'v1',
      data: { service: 'auth', status: 'ok' },
    });
  });

  it('users health should return v1 envelope', () => {
    const usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findByEmail: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    const controller = new UsersServiceController(usersService as any);

    expect(controller.health()).toEqual({
      version: 'v1',
      data: { service: 'users', status: 'ok' },
    });
  });
});
