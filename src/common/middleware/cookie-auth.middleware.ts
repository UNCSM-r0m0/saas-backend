import type { Request, Response, NextFunction } from 'express';

export function cookieAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
    const cookies: any = (req as any).cookies;
    console.log('🔍 cookieAuthMiddleware: Cookies recibidas:', cookies);
    console.log('🔍 cookieAuthMiddleware: Authorization header actual:', req.headers.authorization);

    if (!req.headers.authorization && cookies?.access_token) {
        console.log('🔍 cookieAuthMiddleware: Agregando Authorization header desde cookie');
        req.headers.authorization = `Bearer ${cookies.access_token}`;
        console.log('🔍 cookieAuthMiddleware: Nuevo Authorization header:', req.headers.authorization);
    } else if (req.headers.authorization) {
        console.log('🔍 cookieAuthMiddleware: Ya existe Authorization header');
    } else {
        console.log('🔍 cookieAuthMiddleware: No hay cookie access_token ni Authorization header');
    }
    next();
}


