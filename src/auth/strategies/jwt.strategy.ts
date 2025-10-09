import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
}

// Función personalizada para extraer JWT de cookies
const cookieExtractor = (req: any) => {
    let token = null;
    console.log('🔍 cookieExtractor: Req cookies:', req?.cookies);
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
    constructor(private configService: ConfigService) {
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
        const user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
        console.log('🔍 JwtStrategy.validate: Usuario validado:', user);
        return user;
    }
}

