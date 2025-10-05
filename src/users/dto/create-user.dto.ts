import {
    IsEmail,
    IsString,
    MinLength,
    IsOptional,
    IsEnum,
    IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    USER = 'USER',
}

export enum AuthProvider {
    LOCAL = 'LOCAL',
    GOOGLE = 'GOOGLE',
    GITHUB = 'GITHUB',
}

export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiPropertyOptional({ example: 'Password123!' })
    @IsString()
    @MinLength(6)
    @IsOptional()
    password?: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsString()
    @IsOptional()
    firstName?: string;

    @ApiPropertyOptional({ example: 'Doe' })
    @IsString()
    @IsOptional()
    lastName?: string;

    @ApiPropertyOptional({ example: 'https://avatar.url/image.png' })
    @IsString()
    @IsOptional()
    avatar?: string;

    @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @ApiPropertyOptional({ enum: AuthProvider, default: AuthProvider.LOCAL })
    @IsEnum(AuthProvider)
    @IsOptional()
    provider?: AuthProvider;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    providerId?: string;

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({ default: false })
    @IsBoolean()
    @IsOptional()
    emailVerified?: boolean;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    tenantId?: string;
}
