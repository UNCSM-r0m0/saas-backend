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
import { LoginDto, RegisterDto, RefreshDto } from 'libs/contracts/auth';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Response } from 'express';
import { MobileGoogleVerifyDto } from 'libs/contracts/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshCookie(res: Response, refreshToken: string) {
    const refreshTtl = process.env.JWT_REFRESH_EXPIRES || '30d';
    const maxAge = this.parseDurationToMs(refreshTtl, 30 * 24 * 60 * 60 * 1000);
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge,
      domain: '.r0lm0.dev',
    });
  }

  private setAccessCookie(res: Response, accessToken: string) {
    const accessTtl = process.env.JWT_ACCESS_EXPIRES || '15m';
    const maxAge = this.parseDurationToMs(accessTtl, 15 * 60 * 1000);
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge,
      domain: '.r0lm0.dev',
    });
  }

  private parseDurationToMs(value: string, fallbackMs: number) {
    const match = value.trim().match(/^(\d+)([smhd])$/i);
    if (!match) return fallbackMs;
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return fallbackMs;
    }
  }

  @Post('register')
  @UseGuards(ClientTypeGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
    const { access_token, refresh_token, user } =
      await this.authService.register(registerDto);

    this.setAccessCookie(res, access_token);
    this.setRefreshCookie(res, refresh_token);

    if ((res.req as any)?.clientType === 'mobile') {
      return res.json({ access_token, refresh_token, user });
    }
    return res.json({ access_token, user });
  }

  @UseGuards(ClientTypeGuard, LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const {
      access_token,
      refresh_token,
      user: userData,
    } = await this.authService.login(user);

    // Configuración de cookies para cross-origin con HTTPS (ngrok)
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const isLocalhostFrontend = frontendUrl.includes('localhost');

    this.setAccessCookie(res, access_token);
    this.setRefreshCookie(res, refresh_token);
    // Devolver también el token en el body para apps móviles
    if ((res.req as any)?.clientType === 'mobile') {
      return res.json({ access_token, refresh_token, user: userData });
    }
    return res.json({ access_token, user: userData });
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
    const { access_token, refresh_token } =
      await this.authService.validateOAuthUser(req.user);

    // Configuración de cookies dinámica según entorno (como el proyecto que funciona)
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const isCrossSite = !frontendUrl.includes('localhost');

    // Limpiar cookie antigua si existe
    res.clearCookie('auth_token', { path: '/' });

    // Configurar cookie para dominio compartido
    this.setAccessCookie(res, access_token);
    this.setRefreshCookie(res, refresh_token);
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
    const { access_token, refresh_token } =
      await this.authService.validateOAuthUser(req.user);

    // Configuración de cookies dinámica según entorno (como el proyecto que funciona)
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const isCrossSite = !frontendUrl.includes('localhost');

    // Limpiar cookie antigua si existe
    res.clearCookie('auth_token', { path: '/' });

    // Configurar cookie para dominio compartido
    this.setAccessCookie(res, access_token);
    this.setRefreshCookie(res, refresh_token);
    return res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout (borra cookie de autenticación)' })
  async logout(@Res() res: Response) {
    const refreshToken = (res.req as any)?.cookies?.refresh_token;
    if (refreshToken) {
      await this.authService.revoke(refreshToken);
    }
    res.clearCookie('access_token', {
      path: '/',
      domain: '.r0lm0.dev',
    });
    res.clearCookie('refresh_token', {
      path: '/api/auth/refresh',
      domain: '.r0lm0.dev',
    });
    return res.json({ success: true });
  }

  @Public()
  @UseGuards(ClientTypeGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const refreshToken =
      req.clientType === 'mobile'
        ? body?.refreshToken
        : req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ message: 'refresh_token requerido' });
    }

    const { access_token, refresh_token, user } =
      await this.authService.refresh(refreshToken);

    this.setAccessCookie(res, access_token);
    this.setRefreshCookie(res, refresh_token);

    if (req.clientType === 'mobile') {
      return res.json({ access_token, refresh_token, user });
    }
    return res.json({ access_token, user });
  }

  // === MÓVIL: Verificación directa de Google ID Token ===
  @Public()
  @Post('mobile/google-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar idToken de Google desde app móvil y devolver JWT',
  })
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
    const { access_token, refresh_token, user } =
      await this.authService.validateOAuthUser({
        providerId: info.sub,
        email: info.email,
        firstName: info.given_name,
        lastName: info.family_name,
        avatar: info.picture,
        provider: 'GOOGLE',
      });
    return { access_token, refresh_token, user };
  }
}
