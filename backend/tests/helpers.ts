import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import type { QueryResult } from 'pg';
import { requireAuth, signToken } from '../src/middleware/auth';

export const USER_ID = 7;

/** Authorization header for a logged-in test user */
export const authHeader = (userId: number = USER_ID): { Authorization: string } => ({
  Authorization: `Bearer ${signToken(userId)}`,
});

/** A fake pg result. Cast once here so tests stay free of `any`. */
export function result<T>(rows: T[], rowCount: number = rows.length): QueryResult {
  return { rows, rowCount } as unknown as QueryResult;
}

/** Mounts one router the way src/index.ts does (behind requireAuth unless `isPublic`) */
export function appFor(path: string, router: Router, isPublic = false): express.Express {
  const app = express();
  app.use(express.json());
  if (isPublic) app.use(path, router);
  else app.use(path, requireAuth, router);
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  // Same shape as the global handler in src/index.ts
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Something went wrong on the server' });
  });
  return app;
}
