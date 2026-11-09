/**
-- =============================================================================
-- Servicio Central de Autorización Contextual (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- =============================================================================
*/

import type { Pool } from 'pg';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';
import { AuthorizationRepository } from './authorization.repository.js';
import type {
  AccionPermiso,
  AsignacionPerfilOperativo,
  ContextoAutorizacion,
  PerfilOperativoCatalogo,
  ResultadoAutorizacion,
  ScopeOperativo,
  SolicitudAutorizacion,
} from './authorization.types.js';

export class AuthorizationService {
  private readonly repository: AuthorizationRepository;

  constructor(private readonly pool: Pool) {
    this.repository = new AuthorizationRepository(pool);
  }

  /**
   * Resuelve el contexto completo e integral de autoridad de un usuario en un momento dado.
   * Valida en tiempo real: Cuenta -> Persona -> Vínculos -> Asignaciones -> Responsabilidades -> Perfiles.
   */
  async resolverContextoAutorizacion(
    usuarioId: string,
    fechaReferencia: Date = new Date(),
  ): Promise<ContextoAutorizacion> {
    const cuenta = await this.repository.obtenerCuentaPorId(usuarioId);
    if (!cuenta) {
      throw new NotFoundError({
        message: 'Cuenta de usuario no encontrada.',
        detail: `No existe cuenta registrada con id ${usuarioId}.`,
      });
    }

    const persona = await this.repository.obtenerPersonaPorCuenta(usuarioId);
    const vinculos = await this.repository.listarVinculosUsuario(usuarioId, fechaReferencia);
    const asignaciones = await this.repository.listarAsignacionesUsuario(usuarioId, fechaReferencia);
    const responsabilidades = await this.repository.listarResponsabilidadesUsuario(
      usuarioId,
      fechaReferencia,
    );
    const perfiles = await this.repository.listarPerfilesAsignadosUsuario(
      usuarioId,
      fechaReferencia,
    );

    // Obtener roles canónicos activos desde sigd_org.usuario_rol
    const { rows: rolesRows } = await this.pool.query<{ codigo: string }>(
      `SELECT r.codigo
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE ur.id_usuario = $1::uuid
          AND ur.vigente_desde <= $2::timestamptz
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > $2::timestamptz)`,
      [usuarioId, fechaReferencia.toISOString()],
    );
    const rolesCanonicos = rolesRows.map((r) => r.codigo.toUpperCase());

    return {
      cuenta,
      persona,
      vinculos,
      asignaciones,
      responsabilidadesTemporales: responsabilidades,
      perfilesOperativos: perfiles,
      rolesCanonicos,
    };
  }

  /**
   * Motor de decisión central: Evalúa si un actor está facultado para ejecutar una acción
   * sobre un recurso específico bajo su contexto y reglas de segregación vigentes.
   * FAIL-CLOSED: Si no se puede demostrar la autorización, deniega deterministamente.
   */
  async autorizar(solicitud: SolicitudAutorizacion): Promise<ResultadoAutorizacion> {
    const fecha = solicitud.fechaReferencia ?? new Date();

    // 1. Resolver contexto integral del usuario
    let contexto: ContextoAutorizacion;
    try {
      contexto = await this.resolverContextoAutorizacion(solicitud.usuarioId, fecha);
    } catch {
      return {
        autorizado: false,
        codigoDenegacion: 'CUENTA_NO_ENCONTRADA',
        motivoInterno: 'La cuenta de usuario no existe o no pudo ser resuelta.',
      };
    }

    // 2. Control de cuenta habilitada: Cuentas deshabilitadas NO autorizan nuevas acciones
    if (!contexto.cuenta.activo) {
      return {
        autorizado: false,
        codigoDenegacion: 'CUENTA_DESHABILITADA',
        motivoInterno: 'La cuenta de usuario se encuentra deshabilitada.',
      };
    }

    const { recurso, accion } = solicitud;

    // 3. REGLAS DE SEGREGACIÓN DE FUNCIONES (Segregación y Autoaprobación)

    // 3.1 Prohibición de Autoaprobación (SOLICITANTE ≠ AUTORIZADOR)
    const prohibirAutoaprobacion =
      solicitud.reglasSegregacion?.prohibirAutoaprobacion === true ||
      accion === 'DEVOLUCION_AUTORIZAR' ||
      accion === 'EXPEDIENTE_RESOLVER';

    if (prohibirAutoaprobacion && recurso) {
      const solicitanteId = recurso.solicitanteUsuarioId;
      const solicitantePersonaId = recurso.solicitantePersonaId;
      if (
        (solicitanteId && solicitanteId === solicitud.usuarioId) ||
        (solicitantePersonaId &&
          contexto.persona &&
          solicitantePersonaId === contexto.persona.idPersona)
      ) {
        return {
          autorizado: false,
          codigoDenegacion: 'AUTOAPROBACION_PROHIBIDA',
          motivoInterno:
            'Principio de Segregación: El solicitante no puede ser el autorizador de su propio trámite o devolución.',
        };
      }
    }

    // 3.2 Segregación en Devoluciones (AUTORIZADOR ≠ EJECUTOR)
    if (accion === 'DEVOLUCION_EJECUTAR' && recurso) {
      if (recurso.autorizadorUsuarioId && recurso.autorizadorUsuarioId === solicitud.usuarioId) {
        return {
          autorizado: false,
          codigoDenegacion: 'SEGREGACION_FUNCIONES_VIOLADA',
          motivoInterno:
            'Principio de Segregación: Quien autorizó documentalmente la devolución no puede ejecutar materialmente el desembolso.',
        };
      }
    }

    // 4. REGLA: PODER TÉCNICO ≠ AUTORIDAD SUSTANTIVA DE NEGOCIO
    // ADMINISTRADOR_SIGD no puede por defecto resolver expedientes ni autorizar devoluciones
    const esSoloAdminTecnico =
      contexto.rolesCanonicos.includes('ADMINISTRADOR') &&
      !contexto.rolesCanonicos.some((r) => ['DIRECTOR', 'MESA_PARTES', 'TESORERIA'].includes(r)) &&
      !contexto.perfilesOperativos.some((p) =>
        ['APROBADOR_DIRECCION', 'GESTOR_RECEPCION_DOCUMENTAL', 'GESTOR_TESORERIA', 'AUTORIZADOR_DEVOLUCION'].includes(
          p.perfilCodigo,
        ),
      );

    const accionesExclusivasNegocio: AccionPermiso[] = [
      'EXPEDIENTE_RESOLVER',
      'DEVOLUCION_AUTORIZAR',
      'DEVOLUCION_EJECUTAR',
      'TUPA_ACTIVAR',
    ];

    if (esSoloAdminTecnico && accionesExclusivasNegocio.includes(accion)) {
      return {
        autorizado: false,
        codigoDenegacion: 'PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO',
        motivoInterno:
          'El perfil ADMINISTRADOR_SIGD posee control técnico y no confiere facultades de resolución sustantiva ni aprobación de negocio.',
      };
    }

    // 5. EVALUACIÓN DE RESPONSABILIDADES TEMPORALES Y DELEGACIONES (Fase 5C)
    // Evaluar si alguna delegación o encargatura activa confiere la facultad
    for (const resp of contexto.responsabilidadesTemporales) {
      if (resp.tipo === 'DELEGACION') {
        const alcance = resp.alcance as { tipoActuacion?: string; materia?: string } | null;
        if (alcance?.tipoActuacion) {
          const act = alcance.tipoActuacion.toUpperCase();
          if (
            (act === 'FIRMA' && accion === 'FIRMA_FIRMAR') ||
            (act === 'DERIVACION' && accion === 'EXPEDIENTE_DERIVAR') ||
            (act === 'RECEPCION' && accion === 'EXPEDIENTE_RECIBIR') ||
            (act === 'ATENCION' && accion === 'EXPEDIENTE_ATENDER')
          ) {
            // Delegación cubre la acción concreta
            return {
              autorizado: true,
              perfilAplicado: `DELEGACION:${resp.tipo}`,
              scopeAplicado: 'AREA',
            };
          }
        }
      }
    }

    // 6. EVALUACIÓN DE PERFILES OPERATIVOS ASIGNADOS
    const perfilesConPermiso = contexto.perfilesOperativos.filter((p) =>
      p.permisos.includes(accion),
    );

    for (const perfil of perfilesConPermiso) {
      const scopeCheck = await this.evaluarScope(perfil.scope, perfil.areaId, recurso, contexto);
      if (scopeCheck.autorizado) {
        return {
          autorizado: true,
          perfilAplicado: perfil.perfilCodigo,
          scopeAplicado: perfil.scope,
        };
      }
    }

    // 7. PUENTE DE COMPATIBILIDAD RBAC (Transición suave con roles declarados / canónicos)
    const rolesDisponibles = Array.from(
      new Set([...contexto.rolesCanonicos, ...(solicitud.rolesDeclarados ?? [])]),
    );

    const rbacBridgeResult = await this.evaluarPuenteRbac(rolesDisponibles, accion, recurso, contexto);
    if (rbacBridgeResult.autorizado) {
      return rbacBridgeResult;
    }

    // 8. FAIL-CLOSED DEFAULT: Denegar deterministamente
    return {
      autorizado: false,
      codigoDenegacion: 'ACCESO_DENEGADO',
      motivoInterno: `No se demostró autoridad suficiente para la acción ${accion}.`,
    };
  }

  /**
   * Ejecuta la evaluación de autorización y arroja ForbiddenError con fail-closed si es denegado.
   */
  async exigirAutorizacion(solicitud: SolicitudAutorizacion): Promise<ResultadoAutorizacion> {
    const resultado = await this.autorizar(solicitud);
    if (!resultado.autorizado) {
      throw new ForbiddenError({
        message: 'No autorizado para realizar esta acción.',
        detail: resultado.motivoInterno ?? 'Acceso denegado por política de autorización contextual.',
      });
    }
    return resultado;
  }

  /**
   * Evalúa el confinamiento de alcance (Scope) para un perfil operativo.
   */
  private async evaluarScope(
    scope: ScopeOperativo,
    perfilAreaId: string | null,
    recurso: SolicitudAutorizacion['recurso'],
    contexto: ContextoAutorizacion,
  ): Promise<{ autorizado: boolean; motivo?: string }> {
    switch (scope) {
      case 'GLOBAL_TECNICO':
      case 'INSTITUCIONAL':
        return { autorizado: true };

      case 'PROPIO': {
        if (!recurso) return { autorizado: false, motivo: 'Recurso no provisto para scope PROPIO' };
        const esPropietarioPersona =
          Boolean(recurso.propietarioPersonaId) &&
          recurso.propietarioPersonaId === contexto.persona?.idPersona;
        const esPropietarioUsuario =
          Boolean(recurso.propietarioUsuarioId) &&
          recurso.propietarioUsuarioId === contexto.cuenta.idUsuario;
        if (esPropietarioPersona || esPropietarioUsuario) {
          return { autorizado: true };
        }
        return { autorizado: false, motivo: 'BOLA: El recurso no pertenece al usuario autenticado.' };
      }

      case 'EXPEDIENTE_ASIGNADO': {
        if (!recurso) return { autorizado: false, motivo: 'Recurso no provisto' };
        if (recurso.expedienteAsignadoAUsuarioId === contexto.cuenta.idUsuario) {
          return { autorizado: true };
        }
        return { autorizado: false, motivo: 'El expediente no está asignado nominativamente al usuario.' };
      }

      case 'AREA': {
        if (!recurso?.areaId) {
          // Si el recurso no exige un área específica, verificar que el usuario tenga un área activa
          return { autorizado: Boolean(perfilAreaId || contexto.asignaciones.length > 0) };
        }
        // Verificar si el perfil coincide con el área del recurso
        if (perfilAreaId && perfilAreaId === recurso.areaId) {
          return { autorizado: true };
        }
        // Verificar si el usuario tiene asignación o responsabilidad en el área del recurso
        const tieneAsignacionArea = contexto.asignaciones.some((a) => a.areaId === recurso.areaId);
        const tieneRespArea = contexto.responsabilidadesTemporales.some(
          (r) => r.areaId === recurso.areaId,
        );
        if (tieneAsignacionArea || tieneRespArea) {
          return { autorizado: true };
        }
        return { autorizado: false, motivo: 'No cuenta con asignación en la unidad orgánica requerida.' };
      }

      case 'SUBARBOL': {
        if (!recurso?.areaId || !perfilAreaId) return { autorizado: false };
        const esHijo = await this.repository.verificarJerarquiaSubarbol(perfilAreaId, recurso.areaId);
        return { autorizado: esHijo, motivo: esHijo ? undefined : 'Área fuera del subárbol de competencia' };
      }

      default:
        return { autorizado: false, motivo: 'Scope no reconocido' };
    }
  }

  /**
   * Evalúa el puente de compatibilidad con roles RBAC canónicos durante la fase transitoria.
   */
  private async evaluarPuenteRbac(
    roles: string[],
    accion: AccionPermiso,
    recurso: SolicitudAutorizacion['recurso'],
    contexto: ContextoAutorizacion,
  ): Promise<ResultadoAutorizacion> {
    // ADMINISTRADOR: gestión técnica y administrativa (ORGANIZACION_GESTIONAR requiere perfil ADMINISTRADOR_SIGD)
    if (roles.includes('ADMINISTRADOR')) {
      const accionesAdminPermitidas: AccionPermiso[] = [
        'CUENTA_GESTIONAR',
        'ADMIN_USUARIOS',
        'EXPEDIENTE_VER',
        'REPORTE_LEER',
        'PAGO_VER',
      ];
      if (accionesAdminPermitidas.includes(accion)) {
        return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:ADMINISTRADOR', scopeAplicado: 'GLOBAL_TECNICO' };
      }
    }

    // DIRECTOR: dirección general, aprobación institucional y firma
    if (roles.includes('DIRECTOR')) {
      const accionesDirector: AccionPermiso[] = [
        'EXPEDIENTE_VER',
        'EXPEDIENTE_DERIVAR',
        'EXPEDIENTE_RESOLVER',
        'FIRMA_FIRMAR',
        'REPORTE_LEER',
      ];
      if (accionesDirector.includes(accion)) {
        return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:DIRECTOR', scopeAplicado: 'INSTITUCIONAL' };
      }
    }

    // MESA_PARTES: recepción, radicación, derivación documental (DEVOLUCION_AUTORIZAR requiere AUTORIZADOR_DEVOLUCION)
    if (roles.includes('MESA_PARTES')) {
      const accionesMesa: AccionPermiso[] = [
        'EXPEDIENTE_VER',
        'EXPEDIENTE_RECIBIR',
        'EXPEDIENTE_DERIVAR',
        'EXPEDIENTE_OBSERVAR',
        'PAGO_REGISTRAR',
        'DEVOLUCION_REVISAR',
      ];
      if (accionesMesa.includes(accion)) {
        return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:MESA_PARTES', scopeAplicado: 'INSTITUCIONAL' };
      }
    }

    // TESORERIA: gestión financiera (DEVOLUCION_EJECUTAR requiere perfil operativo GESTOR_TESORERIA)
    if (roles.includes('TESORERIA')) {
      const accionesTesoreria: AccionPermiso[] = [
        'PAGO_VER',
        'PAGO_REGISTRAR',
        'DEVOLUCION_REVISAR',
        'REPORTE_LEER',
      ];
      if (accionesTesoreria.includes(accion)) {
        return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:TESORERIA', scopeAplicado: 'INSTITUCIONAL' };
      }
    }

    // ESPECIALISTA / SECRETARIO: gestión de expedientes de su área
    if (roles.includes('ESPECIALISTA') || roles.includes('SECRETARIO')) {
      const accionesEspecialista: AccionPermiso[] = [
        'EXPEDIENTE_VER',
        'EXPEDIENTE_RECIBIR',
        'EXPEDIENTE_DERIVAR',
        'EXPEDIENTE_OBSERVAR',
        'EXPEDIENTE_ATENDER',
      ];
      if (accionesEspecialista.includes(accion)) {
        // Validar área si el recurso tiene área especificada
        if (recurso?.areaId) {
          const tieneArea =
            contexto.asignaciones.some((a) => a.areaId === recurso.areaId) ||
            contexto.responsabilidadesTemporales.some((r) => r.areaId === recurso.areaId);
          if (!tieneArea) {
            return {
              autorizado: false,
              codigoDenegacion: 'AREA_NO_COINCIDENTE',
              motivoInterno: 'El operador no pertenece a la unidad del expediente.',
            };
          }
        }
        return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:ESPECIALISTA', scopeAplicado: 'AREA' };
      }
    }

    // CIUDADANO: trámites propios bajo BOLA
    if (roles.includes('CIUDADANO')) {
      const accionesCiudadano: AccionPermiso[] = ['EXPEDIENTE_VER', 'PAGO_VER'];
      if (accionesCiudadano.includes(accion)) {
        if (!recurso) return { autorizado: false };
        const esPropioPersona =
          Boolean(recurso.propietarioPersonaId) &&
          recurso.propietarioPersonaId === contexto.persona?.idPersona;
        const esPropioUsuario =
          Boolean(recurso.propietarioUsuarioId) &&
          recurso.propietarioUsuarioId === contexto.cuenta.idUsuario;
        if (esPropioPersona || esPropioUsuario) {
          return { autorizado: true, perfilAplicado: 'RBAC_BRIDGE:CIUDADANO', scopeAplicado: 'PROPIO' };
        }
        return {
          autorizado: false,
          codigoDenegacion: 'BOLA_VIOLATION_RECURSO_AJENO',
          motivoInterno: 'El administrado solo puede consultar recursos propios.',
        };
      }
    }

    return { autorizado: false };
  }

  // ===========================================================================
  // MÓDULO DE GESTIÓN DE ASIGNACIONES DE PERFILES OPERATIVOS
  // ===========================================================================

  async listarCatalogoPerfiles(soloVigentes = true): Promise<PerfilOperativoCatalogo[]> {
    return this.repository.listarCatalogoPerfiles(soloVigentes);
  }

  async asignarPerfilOperativo(
    datos: {
      idUsuario: string;
      perfilCodigo: string;
      areaId?: string | null;
      scope?: ScopeOperativo;
      idResponsabilidad?: string | null;
      vigenteDesde?: string;
      vigenteHasta?: string | null;
      tipoDocumentoSustento?: string | null;
      numeroDocumentoSustento?: string | null;
      fechaDocumentoSustento?: string | null;
      alcance?: Record<string, unknown> | null;
    },
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const cuenta = await this.repository.obtenerCuentaPorId(datos.idUsuario);
    if (!cuenta) {
      throw new NotFoundError({
        message: 'Cuenta no encontrada.',
        detail: `No existe la cuenta de usuario ${datos.idUsuario}.`,
      });
    }
    if (!cuenta.activo) {
      throw new ConflictError({
        message: 'Cuenta deshabilitada.',
        detail: 'No se pueden asignar perfiles operativos a una cuenta inactiva.',
      });
    }

    const perfil = await this.repository.obtenerPerfilPorCodigo(datos.perfilCodigo);
    if (!perfil) {
      throw new NotFoundError({
        message: 'Perfil operativo no encontrado.',
        detail: `No existe el perfil operativo con código ${datos.perfilCodigo}.`,
      });
    }
    if (!perfil.vigente) {
      throw new ConflictError({
        message: 'Perfil operativo no vigente.',
        detail: `El perfil operativo ${datos.perfilCodigo} está deshabilitado en el catálogo.`,
      });
    }

    const ahora = new Date();
    const vigenteDesde = datos.vigenteDesde ? new Date(datos.vigenteDesde) : ahora;
    const vigenteHasta = datos.vigenteHasta ? new Date(datos.vigenteHasta) : null;

    if (vigenteHasta && vigenteHasta <= vigenteDesde) {
      throw new ValidationError({
        message: 'La fecha de fin (vigenteHasta) debe ser posterior a la fecha de inicio (vigenteDesde).',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const asignacion = await this.repository.crearAsignacionPerfil(
        cliente,
        {
          idUsuario: datos.idUsuario,
          perfilId: perfil.perfilId,
          areaId: datos.areaId ?? null,
          scope: datos.scope ?? 'AREA',
          idResponsabilidad: datos.idResponsabilidad ?? null,
          vigenteDesde,
          vigenteHasta,
          tipoDocumentoSustento: datos.tipoDocumentoSustento,
          numeroDocumentoSustento: datos.numeroDocumentoSustento,
          fechaDocumentoSustento: datos.fechaDocumentoSustento,
          alcance: datos.alcance,
        },
        autorId,
      );
      await cliente.query('COMMIT');
      return asignacion;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async finalizarAsignacionPerfil(
    id: string,
    fechaFinalizacion: string | undefined,
    motivo: string | undefined,
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const existente = await this.repository.obtenerAsignacionPerfilPorId(id);
    if (!existente) {
      throw new NotFoundError({
        message: 'Asignación de perfil no encontrada.',
        detail: `No existe la asignación con id ${id}.`,
      });
    }
    if (existente.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: 'Estado no válido para finalización.',
        detail: `La asignación ya se encuentra en estado ${existente.estado}.`,
      });
    }

    const fechaFin = fechaFinalizacion ? new Date(fechaFinalizacion) : new Date();
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await this.repository.finalizarAsignacionPerfil(
        cliente,
        id,
        fechaFin,
        motivo ?? null,
        autorId,
      );
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async revocarAsignacionPerfil(
    id: string,
    fechaRevocacion: string | undefined,
    motivo: string,
    autorId: string,
  ): Promise<AsignacionPerfilOperativo> {
    const existente = await this.repository.obtenerAsignacionPerfilPorId(id);
    if (!existente) {
      throw new NotFoundError({
        message: 'Asignación de perfil no encontrada.',
        detail: `No existe la asignación con id ${id}.`,
      });
    }
    if (existente.estado !== 'ACTIVO') {
      throw new ConflictError({
        message: 'Estado no válido para revocación.',
        detail: `La asignación ya se encuentra en estado ${existente.estado}.`,
      });
    }

    const fechaRev = fechaRevocacion ? new Date(fechaRevocacion) : new Date();
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await this.repository.revocarAsignacionPerfil(
        cliente,
        id,
        fechaRev,
        motivo,
        autorId,
      );
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async anularAsignacionPerfil(
    id: string,
    anuladoPor: string,
    motivo: string,
  ): Promise<AsignacionPerfilOperativo> {
    const existente = await this.repository.obtenerAsignacionPerfilPorId(id);
    if (!existente) {
      throw new NotFoundError({
        message: 'Asignación de perfil no encontrada.',
        detail: `No existe la asignación con id ${id}.`,
      });
    }
    if (existente.estado === 'ANULADO') {
      throw new ConflictError({
        message: 'Asignación ya anulada.',
        detail: 'Esta asignación de perfil ya ha sido anulada previamente.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await this.repository.anularAsignacionPerfil(
        cliente,
        id,
        anuladoPor,
        motivo,
      );
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerAsignacionPerfilPorId(id: string): Promise<AsignacionPerfilOperativo | null> {
    return this.repository.obtenerAsignacionPerfilPorId(id);
  }
}
