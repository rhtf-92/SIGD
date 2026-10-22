import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export function createAuthRoutes(): Router {
  const router = Router();

  router.post('/login', login);
  router.get('/me', authMiddleware, (req, res) => {
    res.json((req as AuthenticatedRequest).authenticatedUser);
  });

  return router;
}
