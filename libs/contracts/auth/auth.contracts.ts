import { RegisterDto } from './dto/register.dto';

export interface AuthRegisterPayload {
  data: RegisterDto;
}

export interface AuthValidateUserPayload {
  email: string;
  password: string;
}

export interface AuthValidateOAuthPayload {
  profile: any;
}

export interface AuthIssueTokensPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRefreshPayload {
  refreshToken: string;
}

export interface AuthRevokePayload {
  refreshToken: string;
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  user?: any;
}

export interface AuthHealthResponseV1 {
  service: 'auth';
  status: 'ok';
}

export interface AuthResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}
