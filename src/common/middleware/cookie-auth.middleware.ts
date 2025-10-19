import type { Request, Response, NextFunction } from "express";

export function cookieAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const cookies: any = (req as any).cookies;
  // Propaga Authorization desde la cookie access_token si no viene ya
  if (!req.headers.authorization && cookies?.access_token) {
    req.headers.authorization = `Bearer ${cookies.access_token}`;
  }
  next();
}
