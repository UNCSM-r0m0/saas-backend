import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { UserRole, AuthProvider } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, password: string): Promise<any> {
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

        // Actualizar último login
        await this.usersService.updateLastLogin(user.id);

        const { password: _, ...result } = user;
        return result;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: new User(user),
        };
    }

    async register(registerDto: RegisterDto): Promise<User> {
        const user = await this.usersService.create({
            ...registerDto,
            role: UserRole.USER,
            provider: AuthProvider.LOCAL,
        });

        return user;
    }

    async validateOAuthUser(profile: any): Promise<any> {
        let user = await this.usersService.findByEmail(profile.email);

        if (!user) {
            // Crear nuevo usuario desde OAuth
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
            // Actualizar último login
            await this.usersService.updateLastLogin(user.id);
        }

        return user;
    }
}
