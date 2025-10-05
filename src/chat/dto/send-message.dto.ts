import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
    @ApiProperty({
        example: '¿Cómo puedo crear un backend con NestJS?',
        description: 'Mensaje del usuario',
    })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional({
        example: 'uuid-de-conversacion',
        description: 'ID de conversación existente (opcional, se crea una nueva si no se provee)',
    })
    @IsUUID()
    @IsOptional()
    conversationId?: string;

    @ApiPropertyOptional({
        example: 'fingerprint-o-ip-anonimo',
        description: 'ID único para usuarios anónimos (fingerprint del navegador)',
    })
    @IsString()
    @IsOptional()
    anonymousId?: string;
}

