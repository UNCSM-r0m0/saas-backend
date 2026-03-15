import { Injectable } from '@nestjs/common';
import { User } from 'libs/users';
import { RegisterDto } from 'libs/contracts/auth';
import { AuthClient } from './auth.client';

@Injectable()
export class AuthService {
  constructor(private authClient: AuthClient) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.authClient.validateUser(email, password);
    if (!user) {
      return null;
    }
    return user;
  }

  async login(user: any) {
    const tokens = await this.authClient.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { ...tokens, user: new User(user) };
  }

  async register(registerDto: RegisterDto) {
    return this.authClient.register(registerDto);
  }

  async validateOAuthUser(profile: any): Promise<any> {
    console.log(
      '🔍 [AuthService] validateOAuthUser: Profile recibido:',
      profile,
    );
    const user = await this.authClient.validateOAuthUser(profile);
    const tokens = await this.authClient.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { ...tokens, user: new User(user) };
  }

  async refresh(refreshToken: string) {
    return this.authClient.refresh(refreshToken);
  }

  async revoke(refreshToken: string) {
    return this.authClient.revoke(refreshToken);
  }
}
