import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
    @ApiProperty({
        example: 'Nuevo contenido del mensaje',
        description: 'Contenido actualizado del mensaje del usuario',
    })
    @IsString()
    @IsNotEmpty()
    content: string;
}


