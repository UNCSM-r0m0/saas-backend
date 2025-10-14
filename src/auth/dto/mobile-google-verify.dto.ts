import { IsOptional, IsString } from 'class-validator';

export class MobileGoogleVerifyDto {
    @IsString()
    idToken!: string;

    @IsOptional()
    @IsString()
    accessToken?: string;
}


