import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { UserRole, AuthProvider } from '../dto/create-user.dto';

export class User {
    @ApiProperty()
    id: string;

    @ApiProperty()
    email: string;

    @Exclude()
    password?: string | null;

    @ApiPropertyOptional()
    firstName?: string | null;

    @ApiPropertyOptional()
    lastName?: string | null;

    @ApiPropertyOptional()
    avatar?: string | null;

    @ApiProperty({ enum: UserRole })
    role: UserRole;

    @ApiProperty({ enum: AuthProvider })
    provider: AuthProvider;

    @ApiPropertyOptional()
    providerId?: string | null;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    emailVerified: boolean;

    @ApiPropertyOptional()
    tenantId?: string | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiPropertyOptional()
    lastLoginAt?: Date | null;

    constructor(partial: any) {
        Object.assign(this, partial);
    }
}
