import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService, User } from 'libs/users';
import { RegisterDto } from 'libs/contracts/auth';
import { UserRole, AuthProvider } from 'libs/contracts/users';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthDomainService {
  constructor(private usersService: UsersService) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    await this.usersService.updateLastLogin(user.id);
    const { password: _, ...result } = user;
    return result as User;
  }

  async register(registerDto: RegisterDto): Promise<User> {
    return this.usersService.create({
      ...registerDto,
      role: UserRole.USER,
      provider: AuthProvider.LOCAL,
    });
  }

  async validateOAuthUser(profile: any): Promise<User> {
    let user = await this.usersService.findByEmail(profile.email);

    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatar: profile.avatar,
        provider: profile.provider,
        providerId: profile.providerId,
        emailVerified: true,
        role: UserRole.USER,
      });
    } else {
      await this.usersService.updateLastLogin(user.id);
    }

    return user;
  }
}
