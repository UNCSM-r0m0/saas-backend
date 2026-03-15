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
}
