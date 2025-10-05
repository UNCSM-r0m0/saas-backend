import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ['user', 'assistant', 'system'] })
    role: string;

    @ApiProperty()
    content: string;

    @ApiProperty()
    createdAt: Date;

    @ApiPropertyOptional()
    tokensUsed?: number;
}

export class ChatResponseDto {
    @ApiProperty()
    conversationId: string;

    @ApiProperty({ type: MessageDto })
    message: MessageDto;

    @ApiProperty({
        description: 'Mensajes restantes hoy',
    })
    remaining: number;

    @ApiProperty({
        description: 'Límite de mensajes por día',
    })
    limit: number;

    @ApiProperty({
        description: 'Tier del usuario',
        enum: ['FREE', 'REGISTERED', 'PREMIUM'],
    })
    tier: string;
}

