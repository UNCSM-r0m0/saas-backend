import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    Req,
    Res,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Response } from 'express';
import { MobileGoogleVerifyDto } from './dto/mobile-google-verify.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email and password' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto, @CurrentUser() user: any, @Res() res: Response) {
        const { access_token, user: userData } = await this.authService.login(user);

        // Configuración de cookies para cross-origin con HTTPS (ngrok)
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isLocalhostFrontend = frontendUrl.includes('localhost');

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: true,          // siempre true tras CF (HTTPS)
            sameSite: 'lax',       // evita bloqueo cross-site típico
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            domain: '.r0lm0.dev',  // comparte entre subdominios
        });
        return res.json({ user: userData });
    }

    @UseGuards(ClientTypeGuard, JwtAuthGuard)
    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getProfile(@CurrentUser() user: any, @Req() req: any) {
        return user;
    }

    // Google OAuth
    @Public()
    @Get('google')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Initiate Google OAuth login' })
    async googleAuth() {
        // Redirige a Google
    }

    @Public()
    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
        const user = await this.authService.validateOAuthUser(req.user);
        const { access_token, user: userData } = await this.authService.login(user);

        // Configuración de cookies dinámica según entorno (como el proyecto que funciona)
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isCrossSite = !frontendUrl.includes('localhost');

        // Limpiar cookie antigua si existe
        res.clearCookie('auth_token', { path: '/' });

        // Configurar cookie para dominio compartido
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: true,          // siempre true tras CF (HTTPS)
            sameSite: 'lax',       // evita bloqueo cross-site típico
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
            domain: '.r0lm0.dev',  // comparte entre subdominios
        });
        return res.redirect(`${frontendUrl}/auth/callback`);
    }

    // GitHub OAuth
    @Public()
    @Get('github')
    @UseGuards(GithubAuthGuard)
    @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
    async githubAuth() {
        // Redirige a GitHub
    }

    @Public()
    @Get('github/callback')
    @UseGuards(GithubAuthGuard)
    @ApiOperation({ summary: 'GitHub OAuth callback' })
    async githubAuthRedirect(@Req() req: any, @Res() res: Response) {
        const user = await this.authService.validateOAuthUser(req.user);
        const { access_token, user: userData } = await this.authService.login(user);

        // Configuración de cookies dinámica según entorno (como el proyecto que funciona)
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isCrossSite = !frontendUrl.includes('localhost');

        // Limpiar cookie antigua si existe
        res.clearCookie('auth_token', { path: '/' });

        // Configurar cookie para dominio compartido
        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: true,          // siempre true tras CF (HTTPS)
            sameSite: 'lax',       // evita bloqueo cross-site típico
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
            domain: '.r0lm0.dev',  // comparte entre subdominios
        });
        return res.redirect(`${frontendUrl}/auth/callback`);
    }

    @Post('logout')
    @ApiOperation({ summary: 'Logout (borra cookie de autenticación)' })
    async logout(@Res() res: Response) {
        res.clearCookie('access_token', {
            path: '/',
            domain: '.r0lm0.dev'
        });
        return res.json({ success: true });
    }

    // === MÓVIL: Verificación directa de Google ID Token ===
    @Public()
    @Post('mobile/google-verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verificar idToken de Google desde app móvil y devolver JWT' })
    async mobileGoogleVerify(@Body() body: MobileGoogleVerifyDto) {
        const { idToken } = body;
        if (!idToken) {
            return { statusCode: 400, message: 'idToken requerido' };
        }

        // Validar token con Google
        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
        const resp = await fetch(tokenInfoUrl, { method: 'GET' });
        if (!resp.ok) {
            return { statusCode: 401, message: 'Token inválido' };
        }
        const info: any = await resp.json();

        // info: { email, given_name, family_name, picture, aud, email_verified, ... }
        if (!info?.email) {
            return { statusCode: 401, message: 'Token inválido' };
        }

        // Validar aud contra tu client id si quieres mayor seguridad
        // const expectedAud = process.env.GOOGLE_CLIENT_ID;
        // if (expectedAud && info.aud !== expectedAud) throw new UnauthorizedException('aud inválido');

        // Persistir/obtener usuario y emitir JWT
        const user = await this.authService.validateOAuthUser({
            providerId: info.sub,
            email: info.email,
            firstName: info.given_name,
            lastName: info.family_name,
            avatar: info.picture,
            provider: 'GOOGLE',
        });

        const { access_token, user: userData } = await this.authService.login(user);
        return { access_token, user: userData };
    }
}

