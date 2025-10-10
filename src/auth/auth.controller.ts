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

        // Para cross-origin HTTPS: usar Secure + SameSite=None
        // Para same-site: usar SameSite=Lax
        const useCrossSiteCookies = isLocalhostFrontend;

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: true, // true para HTTPS (ngrok)
            sameSite: useCrossSiteCookies ? 'none' : 'lax', // 'none' para cross-site
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            domain: undefined, // No especificar dominio
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
        console.log('🔍 getProfile: Petición recibida');
        console.log('🔍 getProfile: User:', user);
        console.log('🔍 getProfile: Headers:', req.headers);
        console.log('🔍 getProfile: Cookies:', req.cookies);
        console.log('🔍 getProfile: Authorization header:', req.headers.authorization);
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

        // Para cross-site (Vercel → ngrok), usar token en URL en lugar de cookie
        if (isCrossSite) {
            console.log('🔍 AuthController: Cross-site detectado, usando token en URL');
            return res.redirect(`${frontendUrl}/?token=${access_token}&provider=google`);
        } else {
            // Para localhost, usar cookies
            res.cookie('access_token', access_token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'strict',
                path: '/',
                maxAge: 15 * 60 * 1000, // 15 minutos
            });
            console.log('🔍 AuthController: Cookie configurada para localhost');
            return res.redirect(`${frontendUrl}/auth/callback`);
        }
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

        // Para cross-site (Vercel → ngrok), usar token en URL en lugar de cookie
        if (isCrossSite) {
            console.log('🔍 AuthController: Cross-site detectado, usando token en URL');
            return res.redirect(`${frontendUrl}/auth/callback?token=${access_token}&provider=github`);
        } else {
            // Para localhost, usar cookies
            res.cookie('access_token', access_token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'strict',
                path: '/',
                maxAge: 15 * 60 * 1000, // 15 minutos
            });
            console.log('🔍 AuthController: Cookie configurada para localhost');
            return res.redirect(`${frontendUrl}/auth/callback`);
        }
    }

    @Post('logout')
    @ApiOperation({ summary: 'Logout (borra cookie de autenticación)' })
    async logout(@Res() res: Response) {
        res.clearCookie('access_token', { path: '/' });
        return res.json({ success: true });
    }
}
