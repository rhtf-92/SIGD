import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import crypto from 'node:crypto';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import { CorreosService } from './correos.service.js';

export function crearRouterCorreos(pool: Pool): Router {
  const router = Router();
  const service = new CorreosService(pool);

  router.post('/correos/webhooks', async (req: Request, res: Response) => {
    const svixSignature = req.get('svix-signature');
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    if (!svixSignature || !secret) {
        return res.status(401).send('Signature or secret missing');
    }

    // svix-signature: t=timestamp,v1=signature
    const parts = svixSignature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='))?.substring(2);
    const signaturePart = parts.find(p => p.startsWith('v1='))?.substring(3);

    if (!timestampPart || !signaturePart || !secret.startsWith('whsec_')) {
        return res.status(401).send('Invalid signature format or secret');
    }

    const payload = JSON.stringify(req.body);
    const signedContent = `${timestampPart}.${payload}`;
    
    // El secreto de svix tiene el formato whsec_...
    const hmacSecret = secret.substring(6);
    const hmac = crypto.createHmac('sha256', Buffer.from(hmacSecret, 'base64'));
    const expectedSignature = hmac.update(signedContent).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signaturePart, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return res.status(401).send('Invalid signature');
    }

    // Validación de tiempo (ej. 5 minutos de tolerancia)
    const timestamp = parseInt(timestampPart, 10);
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
        return res.status(401).send('Signature expired');
    }

    console.log('[WEBHOOK] Evento verificado:', req.body.type, req.body.data.emailId);
    // TODO: Actualizar estado en DB basado en evento (delivered/bounced)
    res.status(200).send('OK');
  });

  router.use('/correos', (req, res, next) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Token requerido.' });
    const claims = verificarTokenAcceso(token);
    (req as any).user = claims;
    next();
  });

  router.get('/correos', async (req, res) => {
    const correos = await service.listarCorreos((req as any).user.sub);
    res.json(correos);
  });

  router.post('/correos', async (req, res) => {
    const { correo } = z.object({ correo: z.string().email() }).parse(req.body);
    const resultado = await service.agregarCorreo((req as any).user.sub, correo);
    res.status(201).json(resultado);
  });

  router.post('/correos/:id/preferido', async (req, res) => {
    await service.establecerPreferido((req as any).user.sub, req.params.id);
    res.status(200).json({ ok: true });
  });

  router.post('/correos/:id/iniciar-verificacion', async (req, res) => {
    await service.iniciarVerificacion((req as any).user.sub, req.params.id);
    res.status(202).json({ mensaje: 'Verificación enviada.' });
  });

  router.post('/correos/:id/confirmar', async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    await service.confirmarVerificacion((req as any).user.sub, req.params.id, token);
    res.status(200).json({ ok: true });
  });

  router.delete('/correos/:id', async (req, res) => {
    await service.eliminarCorreo((req as any).user.sub, req.params.id);
    res.status(204).send();
  });

  return router;
}
