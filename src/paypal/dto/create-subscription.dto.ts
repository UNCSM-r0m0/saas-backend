import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ShippingAmountDto {
  @ApiProperty({ description: 'Código de moneda', example: 'USD' })
  currencyCode: string;

  @ApiProperty({ description: 'Monto', example: '0.00' })
  value: string;
}

class PaymentMethodDto {
  @ApiPropertyOptional({ description: 'Método seleccionado por el pagador' })
  payerSelected?: string;

  @ApiPropertyOptional({ description: 'Preferencia del beneficiario' })
  payeePreferred?: string;
}

class ApplicationContextDto {
  @ApiPropertyOptional({ description: 'Nombre de marca' })
  brandName?: string;

  @ApiPropertyOptional({ description: 'Locale', example: 'es-ES' })
  locale?: string;

  @ApiPropertyOptional({ 
    description: 'Preferencia de envío',
    enum: ['GET_FROM_FILE', 'NO_SHIPPING', 'SET_PROVIDED_ADDRESS']
  })
  shippingPreference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';

  @ApiPropertyOptional({ 
    description: 'Acción del usuario',
    enum: ['CONTINUE', 'SUBSCRIBE_NOW']
  })
  userAction?: 'CONTINUE' | 'SUBSCRIBE_NOW';

  @ApiPropertyOptional({ description: 'Método de pago' })
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @ApiPropertyOptional({ description: 'URL de retorno después del pago exitoso' })
  returnUrl?: string;

  @ApiPropertyOptional({ description: 'URL de cancelación' })
  cancelUrl?: string;
}

export class CreatePaypalSubscriptionDto {
  @ApiProperty({ description: 'ID del plan de PayPal' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ description: 'Fecha de inicio (ISO 8601)' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Cantidad de suscripciones', default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Monto de envío' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAmountDto)
  shippingAmount?: ShippingAmountDto;

  @ApiPropertyOptional({ description: 'Contexto de la aplicación' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationContextDto)
  applicationContext?: ApplicationContextDto;
}
