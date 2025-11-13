import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

// Función personalizada para extraer JWT de cookies
const cookieExtractor = (req: any) => {
    let token = null;
    console.log('🔍 cookieExtractor: Req cookies:', req?.cookies);
    console.log('🔍 cookieExtractor: Authorization header:', req?.headers?.authorization ? 'EXISTS' : 'NULL');
    if (req && req.cookies) {
        token = req.cookies['access_token'];
        console.log('🔍 cookieExtractor: Token extraído de cookie:', token ? 'EXISTS' : 'NULL');
    } else {
        console.log('🔍 cookieExtractor: No hay cookies en req');
    }
    return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private usersService: UsersService,
    ) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                cookieExtractor, // Primero intenta extraer de cookies
                ExtractJwt.fromAuthHeaderAsBearerToken(), // Fallback al header Authorization
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    async validate(payload: JwtPayload) {
        console.log('🔍 JwtStrategy.validate: Payload recibido:', payload);

        // Verificar que el usuario existe en la base de datos
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            console.log('🔍 JwtStrategy.validate: ❌ Usuario no encontrado en BD:', payload.sub);
            throw new UnauthorizedException('Usuario no encontrado');
        }

        if (!user.isActive) {
            console.log('🔍 JwtStrategy.validate: ❌ Usuario inactivo:', payload.sub);
            throw new UnauthorizedException('Usuario inactivo');
        }

        console.log('🔍 JwtStrategy.validate: ✅ Usuario válido:', user.email);
        return {
            id: user.id,
            email: user.email,
            role: user.role,
        };
    }
}

