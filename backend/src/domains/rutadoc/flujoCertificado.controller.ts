import { Router, type NextFunction, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import type { ZodType } from 'zod';
import { UnauthorizedError } from '../../shared/domain/errors/index.js';
import type { AuthorizationService } from '../../core/auth/authorization.service.js';
import { crearJwtActorProvider, type ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import { idSchema } from './rutadoc.schemas.js';
import { obtenerDefinicionMaquinaEstadosFlujoCertificado } from './flujoCertificado.fsm.js';
import { FlujoCertificadoService } from './flujoCertificado.service.js';
import {
  ArchivarNoRecojoSchema,
  CalificarEvaluacionSchema,
  CerrarInasistenciaSdaSchema,
  ConfirmarEntregaPresencialSchema,
  DerivarMesaPartesSdaSchema,
  DerivarSdaEspecialistaSchema,
  EmitirMemorandumCentroIdiomasSchema,
  AsignarEspecialistaIdiomaSchema,
  EmitirCertificadoSdaSchema,
  EmitirInformeEspecialistaSchema,
  IniciarFlujoCertificadoSchema,
  ProgramarEvaluacionSchema,
  ValidarRequisitosMpSchema,
  VisarFirmarDireccionSchema,
} from './flujoCertificado.schemas.js';

function resolverContextoOperacion(req: Request, actor: ActorRutaDoc): 'INSTITUCIONAL' | 'PERSONAL' {
  const rawHeader = req.headers['x-contexto-operacion'];
  if (typeof rawHeader === 'string' && rawHeader.trim().toUpperCase() === 'PERSONAL') {
    return 'PERSONAL';
  }
  if ((actor as { contextoOperacion?: string }).contextoOperacion === 'PERSONAL') {
    return 'PERSONAL';
  }
  return 'INSTITUCIONAL';
}

export function crearRouterFlujoCertificado(
  pool: Pool,
  proveedorActor?: ActorProviderRutaDoc,
  _authService?: AuthorizationService,
): Router {
  const router = Router();
  const actorProviderEfectivo = proveedorActor ?? crearJwtActorProvider(pool);
  const service = new FlujoCertificadoService(pool);

  async function resolverActorObligatorio(req: Request): Promise<ActorRutaDoc> {
    const actor = (req as { actor?: ActorRutaDoc }).actor ?? (await actorProviderEfectivo.obtenerActor(req));
    if (!actor) {
      throw new UnauthorizedError({ detail: 'Autenticación requerida para operar el flujo certificado.' });
    }
    return actor;
  }

  function registrarTransicionPost<T>(
    ruta: string,
    schema: ZodType<T>,
    ejecutor: (
      expedienteId: string,
      datos: T,
      actor: ActorRutaDoc,
      contexto: 'INSTITUCIONAL' | 'PERSONAL',
    ) => Promise<unknown>,
    statusCode = 200,
  ): void {
    router.post(ruta, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = await resolverActorObligatorio(req);
        const expedienteId = idSchema.parse(req.params.id);
        const datos = schema.parse(req.body ?? {});
        const contexto = resolverContextoOperacion(req, actor);
        const resultado = await ejecutor(expedienteId, datos, actor, contexto);
        res.status(statusCode).json(resultado);
      } catch (error) {
        next(error);
      }
    });
  }

  // Consulta pública autenticada de la definición formal de la FSM (estados, transiciones, roles)
  router.get('/flujo-certificado/maquina-estados', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resolverActorObligatorio(req);
      res.status(200).json({
        ok: true,
        maquinaEstados: obtenerDefinicionMaquinaEstadosFlujoCertificado(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Consulta de estado actual e historial WORM completo del flujo de negocio
  router.get('/:id/flujo-certificado', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActorObligatorio(req);
      const expedienteId = idSchema.parse(req.params.id);
      const resultado = await service.obtenerEstadoYHistorial(expedienteId, actor);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // Paso 1: Usuario / Solicitante inicia solicitud (Certificado de Inglés u otro trámite extensible)
  registrarTransicionPost(
    '/:id/flujo-certificado/iniciar',
    IniciarFlujoCertificadoSchema,
    (expedienteId, datos, actor) => service.iniciarFlujo(expedienteId, datos, actor),
    201,
  );

  // Paso 2a: Mesa de Partes recepciona y valida requisitos
  registrarTransicionPost(
    '/:id/flujo-certificado/mesa-partes/validar',
    ValidarRequisitosMpSchema,
    (expedienteId, datos, actor, ctx) => service.validarRequisitosMp(expedienteId, datos, actor, ctx),
  );

  // Paso 2b: Mesa de Partes deriva a Subdirección Académica (SDA)
  registrarTransicionPost(
    '/:id/flujo-certificado/mesa-partes/derivar-sda',
    DerivarMesaPartesSdaSchema,
    (expedienteId, datos, actor, ctx) => service.derivarMesaPartesASda(expedienteId, datos, actor, ctx),
  );

  // Paso 3: Subdirección Académica deriva al Especialista del Centro de Idiomas
  registrarTransicionPost(
    '/:id/flujo-certificado/sda/derivar-especialista',
    DerivarSdaEspecialistaSchema,
    (expedienteId, datos, actor, ctx) => service.derivarSdaAEspecialista(expedienteId, datos, actor, ctx),
  );

  // Paso 3A: Subdirección Académica emite Memorándum al Centro de Idiomas
  registrarTransicionPost(
    '/:id/flujo-certificado/sda/memorandum-centro-idiomas',
    EmitirMemorandumCentroIdiomasSchema,
    (expedienteId, datos, actor, ctx) => service.derivarSdaACentroIdiomas(expedienteId, datos, actor, ctx),
  );

  // Paso 3B: Coordinador del Centro de Idiomas encarga al Especialista del Idioma
  registrarTransicionPost(
    '/:id/flujo-certificado/centro-idiomas/asignar-especialista',
    AsignarEspecialistaIdiomaSchema,
    (expedienteId, datos, actor, ctx) => service.asignarEspecialistaIdioma(expedienteId, datos, actor, ctx),
  );

  // Paso 4.1: Especialista programa evaluación
  registrarTransicionPost(
    '/:id/flujo-certificado/especialista/programar-evaluacion',
    ProgramarEvaluacionSchema,
    (expedienteId, datos, actor, ctx) => service.programarEvaluacion(expedienteId, datos, actor, ctx),
  );

  // Paso 4.2: Especialista califica al solicitante o registra inasistencia (NSP)
  registrarTransicionPost(
    '/:id/flujo-certificado/especialista/calificar',
    CalificarEvaluacionSchema,
    (expedienteId, datos, actor, ctx) => service.calificarEvaluacion(expedienteId, datos, actor, ctx),
  );

  // Paso 4.3: Especialista emite informe (Resultados o NSP) y lo devuelve a Sub D. Acad.
  registrarTransicionPost(
    '/:id/flujo-certificado/especialista/emitir-informe',
    EmitirInformeEspecialistaSchema,
    (expedienteId, datos, actor, ctx) => service.emitirInformeEspecialista(expedienteId, datos, actor, ctx),
  );

  // Paso 5a (Camino Feliz): Sub D. Acad. revisa informe, emite certificado y estampa su firma
  registrarTransicionPost(
    '/:id/flujo-certificado/sda/emitir-certificado',
    EmitirCertificadoSdaSchema,
    (expedienteId, datos, actor, ctx) => service.emitirCertificadoSda(expedienteId, datos, actor, ctx),
  );

  // Paso 5b (Excepción Inasistencia NSP): Sub D. Acad. cierra como IMPROCEDENTE / ARCHIVADO_POR_INASISTENCIA
  registrarTransicionPost(
    '/:id/flujo-certificado/sda/cerrar-inasistencia',
    CerrarInasistenciaSdaSchema,
    (expedienteId, datos, actor, ctx) => service.cerrarPorInasistenciaSda(expedienteId, datos, actor, ctx),
  );

  // Paso 6: Dirección General realiza Visto Bueno (V/B), estampa Firma Digital y finaliza emisión
  //   - Canal Digital -> ATENDIDO_NOTIFICADO (habilita descarga PDF)
  //   - Canal Presencial -> LISTO_PARA_ENTREGA (plazo límite de recojo)
  registrarTransicionPost(
    '/:id/flujo-certificado/direccion/visar-y-firmar',
    VisarFirmarDireccionSchema,
    (expedienteId, datos, actor, ctx) => service.visarYFirmarDireccion(expedienteId, datos, actor, ctx),
  );

  // Canal Presencial: Confirmar entrega física
  registrarTransicionPost(
    '/:id/flujo-certificado/entrega-presencial',
    ConfirmarEntregaPresencialSchema,
    (expedienteId, datos, actor, ctx) => service.confirmarEntregaPresencial(expedienteId, datos, actor, ctx),
  );

  // Excepción Canal Presencial: Archivar en custodia por no recojo tras plazo límite (sin invalidar documento)
  registrarTransicionPost(
    '/:id/flujo-certificado/archivar-no-recojo',
    ArchivarNoRecojoSchema,
    (expedienteId, datos, actor, ctx) => service.archivarPorNoRecojo(expedienteId, datos, actor, ctx),
  );

  // Descarga del PDF del certificado emitido (Canal Digital / Post-Entrega)
  router.get('/:id/flujo-certificado/descargar-certificado', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await resolverActorObligatorio(req);
      const expedienteId = idSchema.parse(req.params.id);
      const descarga = await service.obtenerDescargaCertificado(expedienteId, actor);
      res.status(200).json(descarga);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
