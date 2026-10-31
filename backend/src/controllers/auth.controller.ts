import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../services/auth.service.js';

const loginSchema = z.object({
  identificador: z.string().trim().min(1).max(150),
  password: z.string().min(1).max(128),
});

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Ingrese un usuario y una contraseña válidos.' });
    return;
  }

  const result = await authenticateUser(parsed.data.identificador, parsed.data.password);
  if (!result) {
    res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
    return;
  }

  res.status(200).json(result);
}
