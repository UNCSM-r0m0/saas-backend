import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

export type ClientType = 'mobile' | 'web' | 'unknown';

function detectClientType(userAgent: string | undefined, explicitHeader?: string | undefined): ClientType {
  const explicit = (explicitHeader || '').toLowerCase();
  if (explicit === 'mobile') return 'mobile';
  if (explicit === 'web') return 'web';

  const ua = (userAgent || '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|iemobile|blackberry|opera mini/.test(ua);
  if (isMobile) return 'mobile';
  if (ua) return 'web';
  return 'unknown';
}

@Injectable()
export class ClientTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userAgent: string | undefined = req.headers['user-agent'];
    const headerClient: string | undefined = (req.headers['x-client-type'] as string) || undefined;
    const type = detectClientType(userAgent, headerClient);
    // adjuntar para uso en handlers (req.clientType)
    req.clientType = type;
    return true;
  }
}


