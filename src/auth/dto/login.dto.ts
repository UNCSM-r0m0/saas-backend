import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'admin@saas.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Admin123!' })
    @IsString()
    @MinLength(6)
    password: string;
}

