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

        // Configuración de cookies para desarrollo local cross-origin
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isLocalhostFrontend = frontendUrl.includes('localhost');

        // Para desarrollo local cross-origin: usar SameSite=None
        // Para producción: usar secure cookies
        const useSecureCookies = isProduction && !isLocalhostFrontend;

        res.cookie('auth_token', access_token, {
            httpOnly: true,
            secure: false, // false para desarrollo local HTTP
            sameSite: 'none', // 'none' para cross-origin (localhost:5173 → localhost:3000)
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
    @Get('google')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Initiate Google OAuth login' })
    async googleAuth() {
        // Redirige a Google
    }

    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    @ApiOperation({ summary: 'Google OAuth callback' })
    async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
        const user = await this.authService.validateOAuthUser(req.user);
        const { access_token, user: userData } = await this.authService.login(user);

        // Configuración de cookies para desarrollo local cross-origin
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isLocalhostFrontend = frontendUrl.includes('localhost');

        // Para desarrollo local cross-origin: usar SameSite=None
        // Para producción: usar secure cookies
        const useSecureCookies = isProduction && !isLocalhostFrontend;

        res.cookie('auth_token', access_token, {
            httpOnly: true,
            secure: false, // false para desarrollo local HTTP
            sameSite: 'none', // 'none' para cross-origin (localhost:5173 → localhost:3000)
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            domain: undefined, // No especificar dominio
        });

        return res.redirect(`${frontendUrl}/auth/callback`);
    }

    // GitHub OAuth
    @Get('github')
    @UseGuards(GithubAuthGuard)
    @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
    async githubAuth() {
        // Redirige a GitHub
    }

    @Get('github/callback')
    @UseGuards(GithubAuthGuard)
    @ApiOperation({ summary: 'GitHub OAuth callback' })
    async githubAuthRedirect(@Req() req: any, @Res() res: Response) {
        const user = await this.authService.validateOAuthUser(req.user);
        const { access_token, user: userData } = await this.authService.login(user);

        // Configuración de cookies para desarrollo local cross-origin
        const isProduction = process.env.NODE_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const isLocalhostFrontend = frontendUrl.includes('localhost');

        // Para desarrollo local cross-origin: usar SameSite=None
        // Para producción: usar secure cookies
        const useSecureCookies = isProduction && !isLocalhostFrontend;

        res.cookie('auth_token', access_token, {
            httpOnly: true,
            secure: false, // false para desarrollo local HTTP
            sameSite: 'none', // 'none' para cross-origin (localhost:5173 → localhost:3000)
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            domain: undefined, // No especificar dominio
        });

        return res.redirect(`${frontendUrl}/auth/callback`);
    }

    @Post('logout')
    @ApiOperation({ summary: 'Logout (borra cookie de autenticación)' })
    async logout(@Res() res: Response) {
        res.clearCookie('auth_token', { path: '/' });
        return res.json({ success: true });
    }
}
