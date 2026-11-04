import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { getRequestContext, setUsuarioId } from '../shared/request-context/request-context.js';
import { registrarAcceso as repoRegistrarAcceso } from '../audit/auditoria.repository.js';

/**
 * Middleware de acceso de auditoría.
 *
 * Registra cada petición HTTP que llega al servidor como un evento de acceso
 * en la bitácora forense `sigd_audit.bitacora_auditoria` (operación INSERT,
 * tabla `acceso`). Esto permite tener trazabilidad real de quién accedió a qué
 * recurso, desde qué IP, con qué user_agent y bajo qué X-Correlation-ID.
 *
 * El registro se hace al FINAL de la petición (después de `next()`) para
 * conocer el estado de resultado (2xx = Exitoso, 403 = Denegado, 4xx/5xx = Error).
 *
 * Se excluyen las rutas de salud y de auditoría misma para evitar bucles
 * infinitos y ruido innecesario.
 */
export function crearAuditoriaAccesoMiddleware(pool: Pool) {
  const RUTAS_EXCLUIDAS = new Set([
    '/health',
    '/ready',
    '/api/v1/auditoria/logs',
    '/api/v1/auditoria/resumen',
    '/api/v1/auditoria/validar-worm',
    '/api/v1/auditoria/acceso',
    '/api/v1/auditoria/accion',
  ]);

  return async function auditoriaAcceso(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const rutaOriginal = req.path;
    const metodo = req.method;
    const inicio = Date.now();

    // Capturar el resultado de la respuesta para clasificar Exitoso / Denegado / Error.
    const enviarOriginal = res.send.bind(res);
    let codigoEstado = 200;

    res.send = ((body?: unknown) => {
      if (typeof body === 'number') {
        codigoEstado = body;
      }
      return enviarOriginal(body as any);
    }) as any;

    // Ejecutar el resto de la cadena de middlewares.
    next();

    // Registrar el acceso tras completar la respuesta (usamos 'finish' para
    // tener el código de estado real). Si la ruta está excluida, no registramos.
    if (RUTAS_EXCLUIDAS.has(rutaOriginal)) {
      return;
    }

    res.on('finish', async () => {
      try {
        const contexto = getRequestContext();

        // Clasificar resultado por código HTTP.
        let resultado: 'Exitoso' | 'Denegado' | 'Error';
        if (codigoEstado >= 200 && codigoEstado < 300) {
          resultado = 'Exitoso';
        } else if (codigoEstado === 401 || codigoEstado === 403) {
          resultado = 'Denegado';
        } else {
          resultado = 'Error';
        }

        const accion = `${metodo} ${rutaOriginal}`;
        const modulo = rutaOriginal.split('/').filter(Boolean)[1] ?? 'Sistema';
        const registro = `${metodo} ${rutaOriginal}`;

        await pool.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (correlation_id, usuario_id, ip_origen, user_agent, esquema, tabla, operacion, datos_antes, datos_despues)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            contexto?.correlation_id ?? null,
            contexto?.usuario_id ?? null,
            contexto?.ip_origen ?? null,
            contexto?.user_agent ?? null,
            'sigd_http',
            'acceso',
            'INSERT',
            null,
            JSON.stringify({
              tipo: 'ACCESO_HTTP',
              metodo,
              ruta: rutaOriginal,
              codigo_estado: codigoEstado,
              resultado,
              duracion_ms: Date.now() - inicio,
              accion,
              modulo,
              registro,
            }),
          ],
        );
      } catch {
        // Nunca dejamos que una falla de auditoría rompa la respuesta al cliente.
      }
    });
  };
}
