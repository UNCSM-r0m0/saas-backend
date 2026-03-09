import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  user?: { sub?: string } | null;
}

@Injectable()
export class ChatGatewayAuthService {
  constructor(private readonly jwtService: JwtService) {}

  authenticate(client: AuthenticatedSocket): { userId?: string } {
    const token = this.extractToken(client);
    if (!token) {
      client.user = null;
      return {};
    }

    try {
      const payload = this.jwtService.verify(token);
      client.user = payload;
      return { userId: payload?.sub };
    } catch {
      client.user = null;
      return {};
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake?.auth;
    const query = client.handshake?.query;
    const headers = client.handshake?.headers;

    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }

    if (query?.token && typeof query.token === 'string') {
      return query.token;
    }
    if (Array.isArray(query?.token) && query.token.length > 0) {
      return query.token[0];
    }

    const authHeader = headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (Array.isArray(authHeader) && authHeader.length > 0) {
      const value = authHeader[0];
      if (typeof value === 'string' && value.startsWith('Bearer ')) {
        return value.substring(7);
      }
    }

    const cookieHeader = headers?.cookie;
    if (typeof cookieHeader === 'string') {
      const cookies = this.parseCookies(cookieHeader);
      return cookies['access_token'] || cookies['token'];
    }

    return undefined;
  }

  private parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieString.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }
}
