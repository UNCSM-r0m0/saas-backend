import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        
        // Permitir peticiones OPTIONS (CORS preflight) sin autenticación
        if (request.method === 'OPTIONS') {
            return true;
        }
        
        // Verificar si el endpoint requiere autenticación
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true; // Endpoint público, no requiere autenticación
        }

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        console.log('🔍 JwtAuthGuard.handleRequest:', { err, user, info });
        if (err || !user) {
            console.log('🔍 JwtAuthGuard.handleRequest: ❌ Error o usuario nulo');
            throw new UnauthorizedException('Token inválido o expirado');
        }
        console.log('🔍 JwtAuthGuard.handleRequest: ✅ Usuario válido');
        return user;
    }
}

