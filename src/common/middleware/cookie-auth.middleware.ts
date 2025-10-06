import type { Request, Response, NextFunction } from 'express';

export function cookieAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
    const cookies: any = (req as any).cookies;
    if (!req.headers.authorization && cookies?.auth_token) {
        req.headers.authorization = `Bearer ${cookies.auth_token}`;
    }
    next();
}


