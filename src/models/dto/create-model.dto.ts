import { ModelTier } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsInt, IsArray, IsEnum } from 'class-validator';

export class CreateModelDto {
  @IsString()
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
