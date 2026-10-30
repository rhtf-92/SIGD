import { Router } from 'express';
import { createAuthRoutes } from './auth.routes.js';

export function createApiRoutes(): Router {
  const router = Router();

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    router.use('/auth', createAuthRoutes());
  }

  return router;
}
