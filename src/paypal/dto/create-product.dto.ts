import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreatePaypalProductDto {
  @ApiProperty({ description: 'Nombre del producto' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Descripción del producto' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ 
    description: 'Tipo de producto',
    enum: ['PHYSICAL', 'DIGITAL', 'SERVICE'],
    default: 'SERVICE'
  })
  @IsOptional()
  @IsIn(['PHYSICAL', 'DIGITAL', 'SERVICE'])
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @ApiPropertyOptional({ description: 'Categoría del producto' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'URL de imagen del producto' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'URL de la página principal del producto' })
  @IsOptional()
  @IsString()
  homeUrl?: string;
}
