import { ModelTier } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsEnum, Matches } from 'class-validator';

export class CreateModelDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._:-]+$/, {
    message: 'Model name must be URL-safe (alphanumeric, dots, underscores, colons, hyphens only)',
  })
  name: string;

  @IsString()
  displayName: string;

  @IsString()
  provider: string;

  @IsEnum(ModelTier)
  tier: ModelTier;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
