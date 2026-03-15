import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Payloads for NATS messages. Keep them small and explicit.
export interface UsersCreatePayload {
  data: CreateUserDto;
}

export interface UsersFindOnePayload {
  id: string;
}

export interface UsersUpdatePayload {
  id: string;
  data: UpdateUserDto;
}

export interface UsersRemovePayload {
  id: string;
}

export interface UsersFindByEmailPayload {
  email: string;
}

export interface UsersUpdateLastLoginPayload {
  id: string;
}

export interface UsersHealthResponseV1 {
  service: 'users';
  status: 'ok';
}

export interface UsersResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}
