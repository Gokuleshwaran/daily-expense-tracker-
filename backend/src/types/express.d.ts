// Adds `req.userId` (set by the requireAuth middleware) to Express's Request type
declare global {
  namespace Express {
    interface Request {
      userId: number;
    }
  }
}

export {};
