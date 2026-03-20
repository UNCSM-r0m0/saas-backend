import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FrequencyDto {
  @ApiProperty({ description: 'Unidad de intervalo', enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] })
  intervalUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

  @ApiProperty({ description: 'Cantidad de intervalos', example: 1 })
  intervalCount: number;
}

class FixedPriceDto {
  @ApiProperty({ description: 'Código de moneda', example: 'USD' })
  currencyCode: string;

  @ApiProperty({ description: 'Monto', example: '10.00' })
  value: string;
}

class PricingSchemeDto {
  @ApiProperty({ description: 'Precio fijo' })
  @ValidateNested()
  @Type(() => FixedPriceDto)
  fixedPrice: FixedPriceDto;
}

class BillingCycleDto {
  @ApiProperty({ description: 'Frecuencia de facturación' })
  @ValidateNested()
  @Type(() => FrequencyDto)
  frequency: FrequencyDto;

  @ApiProperty({ description: 'Tipo de tenencia', enum: ['REGULAR', 'TRIAL'] })
  tenureType: 'REGULAR' | 'TRIAL';

  @ApiProperty({ description: 'Secuencia del ciclo', example: 1 })
  sequence: number;

  @ApiPropertyOptional({ description: 'Total de ciclos (0 = infinito)' })
  @IsOptional()
  totalCycles?: number;

  @ApiProperty({ description: 'Esquema de precios' })
  @ValidateNested()
  @Type(() => PricingSchemeDto)
  pricingScheme: PricingSchemeDto;
}

export class CreatePaypalPlanDto {
  @ApiProperty({ description: 'ID del producto de PayPal' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Nombre del plan' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descripción del plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Ciclos de facturación', type: [BillingCycleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillingCycleDto)
  billingCycles: BillingCycleDto[];

  @ApiPropertyOptional({ description: 'Soporte para cantidad' })
  @IsOptional()
  @IsBoolean()
  quantitySupported?: boolean;
}
