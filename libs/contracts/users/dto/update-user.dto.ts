import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Shared DTO for update payloads in gateway and microservice.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
