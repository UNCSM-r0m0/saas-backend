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
    async login(@Body() loginDto: LoginDto, @CurrentUser() user: any) {
        return this.authService.login(user);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    getProfile(@CurrentUser() user: any) {
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

        // Redirigir al frontend con el token
        const redirectUrl = `http://localhost:5173/auth/callback?token=${access_token}`;

        console.log('Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
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

        // Redirigir al frontend con el token
        const redirectUrl = `http://localhost:5173/auth/callback?token=${access_token}`;

        console.log('Redirecting to:', redirectUrl);
        return res.redirect(redirectUrl);
    }
}
