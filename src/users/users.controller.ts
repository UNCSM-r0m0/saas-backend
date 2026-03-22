import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto, UpdateUserDto } from 'libs/contracts/users';
import { User } from 'libs/users';
import { UsersClient } from './users.client';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  // Gateway HTTP: delegate user operations to the users microservice via NATS.
  constructor(private readonly usersClient: UsersClient) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: User,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersClient
      .create(createUserDto)
      .then((user) => new User(user));
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [User],
  })
  @UseGuards(ClientTypeGuard, JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll(@Req() _req: any): Promise<User[]> {
    return this.usersClient
      .findAll()
      .then((users: any[]) => users.map((user) => new User(user)));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(ClientTypeGuard, JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findOne(@Param('id') id: string, @Req() _req: any): Promise<User> {
    return this.usersClient.findOne(id).then((user) => new User(user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(ClientTypeGuard, JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() _req: any,
  ): Promise<User> {
    return this.usersClient
      .update(id, updateUserDto)
      .then((user) => new User(user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(ClientTypeGuard, JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Req() _req: any): Promise<User> {
    return this.usersClient.remove(id).then((user) => new User(user));
  }

  // ==========================================================================
  // 🔐 E2EE - End-to-End Encryption
  // ==========================================================================

  @Post('public-key')
  @UseGuards(ClientTypeGuard, JwtAuthGuard)
  @ApiOperation({ summary: 'Registrar clave pública para E2EE' })
  @ApiResponse({ status: 200, description: 'Clave pública registrada' })
  async registerPublicKey(
    @Req() req: any,
    @Body('publicKey') publicKey: string,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id;
    await this.usersClient.update(userId, { publicKey } as any);
    return { success: true };
  }

  @Get(':id/public-key')
  @UseGuards(ClientTypeGuard, JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener clave pública de un usuario' })
  @ApiResponse({ status: 200, description: 'Clave pública obtenida' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async getPublicKey(@Param('id') id: string): Promise<{ publicKey: string | null }> {
    const user = await this.usersClient.findOne(id);
    return { publicKey: (user as any)?.publicKey || null };
  }
}
