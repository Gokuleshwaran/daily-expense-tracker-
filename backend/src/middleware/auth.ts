import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { config } from '../config';

export function signToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: '30d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}
