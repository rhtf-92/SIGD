import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { validarDocumentacionTramite, type DocumentoClasificado } from './documentacionTramite.service.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned, validarMagicBytes } from '../../core/storage/s3-storage.service.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';
import { CutService } from './cut.service.js';
import { calcularHorarioCorte, type ResultadoHorarioCorte } from './horarioCorte.util.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';
import type { RadicacionPublicaInput } from './radicacionPublica.schemas.js';
import { admisibilidadPublica } from './admisibilidadPublica.js';
import { omitirPagoDemo, MARCA_PAGO_DEMO } from './demoPago.js';
import { AppError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import { validarPagoRadicacion,consultarCondicionFinanciera } from '../tesoreria/tesoreria.radicacion.js';
import { contarPaginasPdf } from './pdfFoliacion.js';
import { CATALOGO_DOCUMENTAL_POR_CODIGO } from './catalogoDocumentalTupa2026.js';
import { expedienteRequierePagoTupa, registrarInicioPlazoPago } from './computoPlazo15Dias.service.js';
import { TokenSeguimientoService } from './tokenSeguimiento.service.js';
import { cifrarSecreto } from '../../shared/crypto/cifradoOutbox.js';

/**
 * T-BE-TC-02 y T-BE-TC-03 Â· Logica de negocio de la radicacion virtual
 * (Mesa de Partes Virtual 24x7, endpoint #14).
 *
 * Garantias que ofrece este servicio:
 *   * La asignacion del CUT ocurre DENTRO de la misma transaccion que la
 *     escritura del expediente. Si algo posterior falla, el ROLLBACK libera el
 *     correlativo y no se quema un numero que el ciudadano nunca vio.
 *   * DocuCore conserva fecha_registro y TramiCore fecha_radicacion. Los alias
 *     internos mantienen la respuesta HTTP existente.
 *   * Expedientes, adjunto, foliacion y asiento se escriben con el mismo cliente.
 *     El cargo se obtiene del asiento, como en la ventanilla presencial.
 */

export interface ResultadoRadicacion {
  expedienteId: string;
  cut: string;
  anio: number;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  mensajeLegal: string;
  totalFolios: number;
  cargoDigital: {
    codigo: string;
    hashSha256: string;
    qrContenido: string;
  };
  tokenSeguimiento?: string;
  enlaceSeguro?: string;
}

interface FilaExpediente {
  expediente_id: string;
  cut: string;
  fecha_envio_real: Date;
  fecha_radicacion_legal: Date;
  fuera_de_horario: boolean;
}

interface FilaTramiteTupa {
  id_tipo_tramite_tupa: string;
  activo: boolean;
}

/** Origen del calendario de feriados. Inyectable para poder testear sin BD. */
export type ProveedorFeriados = (clienteTransaccional?: PoolClient) => Promise<string[]>;

export class RadicacionVirtualService {
  private readonly cutService: CutService;
  private readonly obtenerFeriados: ProveedorFeriados;
  private readonly tokenSeguimientoService: TokenSeguimientoService;

  constructor(private readonly pool: Pool, obtenerFeriados?: ProveedorFeriados) {
    this.cutService = new CutService(pool);
    this.obtenerFeriados = obtenerFeriados ?? crearProveedorFeriados(pool);
    this.tokenSeguimientoService = new TokenSeguimientoService(pool);
  }

  async radicar(datos: RadicacionVirtualInput, idUsuarioAutenticado: string, now: Date = new Date()): Promise<ResultadoRadicacion> {
    return this.procesar(datos, idUsuarioAutenticado, now);
  }

  async radicarPublico(datos: RadicacionPublicaInput, sesionHash: string, now = new Date()): Promise<ResultadoRadicacion> {
    return this.procesar(datos, null, now, { datos, sesionHash });
  }

  private async procesar(datos: RadicacionVirtualInput, idUsuarioAutenticado: string | null, now: Date,
    publico?: { datos: RadicacionPublicaInput; sesionHash: string }): Promise<ResultadoRadicacion> {
    const cliente = await this.pool.connect();
    let transaccionAbierta = false;
    let demoSinPago = false;

    try {
      await cliente.query('BEGIN');
      transaccionAbierta = true;
      demoSinPago = await omitirPagoDemo(cliente);

      if (publico) {
        const huella = createHash('sha256').update(JSON.stringify(publico.datos)).digest('hex');
        const declarados = { nombres: publico.datos.nombres, apellidos: publico.datos.apellidos,
          tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento, correo: datos.correo,
          telefono: publico.datos.telefono, declaracionVeracidad: true, aceptaTerminos: true,
          identidad: 'DECLARADA_PENDIENTE_VERIFICACION_INSTITUCIONAL',
          ...(demoSinPago && !datos.ordenPagoId ? { modalidad: MARCA_PAGO_DEMO, estado_economico: 'NO_VERIFICADO' } : {}) };
        await cliente.query(`INSERT INTO sigd_tra.radicacion_publica (sesion_hash, payload_hash, datos_declarados)
          VALUES ($1, $2, $3::jsonb) ON CONFLICT (sesion_hash) DO NOTHING`,
          [publico.sesionHash, huella, JSON.stringify(declarados)]);
        const previa = await cliente.query<{ payload_hash: string; respuesta: ResultadoRadicacion | null }>(
          'SELECT payload_hash, respuesta FROM sigd_tra.radicacion_publica WHERE sesion_hash = $1 FOR UPDATE', [publico.sesionHash]);
        if (previa.rows[0]?.payload_hash !== huella) throw new AppError({ status: 409, code: 'PUBLIC_REQUEST_CHANGED', message: 'Este envío ya fue utilizado con otros datos. Inicie una nueva solicitud.' });
        if (previa.rows[0].respuesta) {
          await cliente.query('COMMIT'); transaccionAbierta = false;
          return previa.rows[0].respuesta;
        }
        const tupa = await cliente.query<{ descripcion: string | null }>(
          'SELECT descripcion FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id=$1::uuid AND vigente=TRUE', [datos.idTipoTramiteTupa]);
        const admisibilidad = admisibilidadPublica(tupa.rows[0]?.descripcion ?? null, demoSinPago,demoSinPago?undefined:await consultarCondicionFinanciera(cliente,datos.idTipoTramiteTupa));
        if (!admisibilidad.habilitado && !(datos.ordenPagoId && await consultarCondicionFinanciera(cliente,datos.idTipoTramiteTupa)==='SUJETO_PAGO')) throw new AppError({ status: 422, code: 'PUBLIC_PAYMENT_UNAVAILABLE', message: admisibilidad.motivo });
      }

      await this.verificarTipoTramite(cliente, datos.idTipoTramiteTupa);
      const idPersona = publico ? await this.resolverPersonaDeclarada(cliente, publico.datos) : await this.resolverPersonaAutenticada(
        cliente,
        idUsuarioAutenticado!,
        datos.tipoDocumento ?? 'DNI',
        datos.numeroDocumento ?? '',
        datos.nombreSolicitante ?? '',
      );
      // File keys identify this submission, not the citizen's right to file again.
      // Serialize identical authenticated retries and recover their committed response
      // from the existing append-only audit, in the same transaction as the CUT.
      const huellaAutenticada = publico ? null : createHash('sha256').update(JSON.stringify(datos)).digest('hex');
      if (!publico) {
        await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`radicacion:${idUsuarioAutenticado}:${huellaAutenticada}`]);
        const anterior = await cliente.query<{ resultado: ResultadoRadicacion }>(`SELECT datos_despues->'resultado' AS resultado
          FROM sigd_audit.bitacora_auditoria WHERE esquema='sigd_tra' AND tabla='radicacion_virtual'
            AND datos_despues->>'usuario_id'=$1 AND datos_despues->>'huella_solicitud'=$2`,
          [idUsuarioAutenticado, huellaAutenticada]);
        if (anterior.rows.length > 1) throw new AppError({ status: 409, code: 'RADICACION_INCONSISTENTE', message: 'Se requiere revisar la trazabilidad del envío antes de repetirlo.' });
        if (anterior.rows[0]) {
          await cliente.query('COMMIT'); transaccionAbierta = false;
          return anterior.rows[0].resultado;
        }
      }
      const ordenAplicada = await validarPagoRadicacion(cliente, datos.idTipoTramiteTupa, idPersona, idUsuarioAutenticado, datos.ordenPagoId, demoSinPago, publico?.sesionHash);
      if (ordenAplicada) demoSinPago = false;
      // No order outside demo means the financial gate validated gratuity.
      const clasificacion = await this.resolverTipoDocumental(cliente, datos, true, false);
      // Analizar secuencialmente evita cargar varios PDF en memoria a la vez.
      const archivos: Array<{ bucket: string; key: string; paginas: number }> = [];
      for (const doc of datos.documentos) {
        archivos.push(await this.verificarArchivo(doc, publico ? undefined : { cliente, usuario: idUsuarioAutenticado! }));
      }
      const totalFolios = archivos.reduce((total, archivo) => total + archivo.paginas, 0);
      if (!Number.isSafeInteger(totalFolios) || totalFolios < 1 || totalFolios > 5000) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'El total de páginas PDF supera el límite de 5000 por expediente.' }] });
      }

      const horario = await this.evaluarHorario(now, cliente);
      const { cut, anio } = await this.cutService.generar(anioDeRecepcion(now), cliente);

      const expediente = await this.insertarExpediente(cliente, datos, idPersona, cut, horario, clasificacion.tipoPrincipalId);
      if (ordenAplicada) await cliente.query('INSERT INTO sigd_tes.aplicacion_pago(orden_id,expediente_id) VALUES($1,$2)', [ordenAplicada, expediente.expediente_id]);
      await this.insertarAdjuntos(cliente, expediente.expediente_id, datos, clasificacion.documentosClasificados, archivos, idUsuarioAutenticado);
      const cargo = await this.emitirCargoDigital(cliente, expediente.expediente_id, { ...datos, totalFolios }, now, cut, idPersona);

      const resultado: ResultadoRadicacion = {
        expedienteId: expediente.expediente_id,
        cut,
        anio,
        fechaEnvioReal: expediente.fecha_envio_real.toISOString(),
        fechaRadicacionLegal: expediente.fecha_radicacion_legal.toISOString(),
        fueraDeHorario: horario.requiereProyeccion,
        mensajeLegal: redactarMensajeLegal(horario) + (demoSinPago ? ` ${MARCA_PAGO_DEMO}.` : '') + ' Estado económico: NO VERIFICADO. La recepción no acredita pago. Tesorería atiende la condición económica después del CUT.',
        totalFolios,
        cargoDigital: cargo,
      };

      // Cómputo institucional de los 15 días hábiles para el pago (LPAG Art. 143)
      const { requierePago } = await expedienteRequierePagoTupa(cliente, expediente.expediente_id);
      if (requierePago || ordenAplicada) {
        await registrarInicioPlazoPago(cliente, expediente.expediente_id, ordenAplicada, expediente.fecha_radicacion_legal, now);
        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'orden_pago_generada',
          payload: {
            expediente_id: expediente.expediente_id,
            cut,
            orden_id: ordenAplicada ?? null,
            asunto: `Orden de Pago generada para expediente CUT: ${cut}`,
            cuerpo: {
              fechaRadicacionLegal: resultado.fechaRadicacionLegal,
              plazoDiasHabiles: 15,
            },
            ...(publico ? {
              correoDeclarado: publico.datos.correo,
              telefonoDeclarado: publico.datos.telefono,
              nombreDeclarado: publico.datos.nombreSolicitante,
            } : {
              usuario_id: idUsuarioAutenticado,
            }),
          },
        });
      }

      if (publico) {
        // Emitir token de seguimiento criptográfico independiente (256 bits)
        const tokenSeguimiento = await this.tokenSeguimientoService.emitirToken(cliente, expediente.expediente_id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5178';
        const enlaceSeguro = `${frontendUrl}/tramites/consulta-publica/${cut}#token=${tokenSeguimiento.token}`;
        resultado.tokenSeguimiento = tokenSeguimiento.token;
        resultado.enlaceSeguro = enlaceSeguro;

        // Cifrar el secreto de seguimiento con AES-256-GCM antes de escribir al Outbox
        let enlaceSeguroCifrado: string | undefined;
        let tokenSeguimientoCifrado: string | undefined;
        try {
          enlaceSeguroCifrado = cifrarSecreto(enlaceSeguro);
          tokenSeguimientoCifrado = cifrarSecreto(tokenSeguimiento.token);
        } catch (e) {
          console.error('[Transactional Outbox] Advertencia: No se pudo cifrar el secreto de seguimiento.', e);
        }

        await registrarMutacion(cliente, { esquema: 'sigd_tra', tabla: 'radicacion_publica', operacion: 'INSERT',
          datos_despues: { expediente_id: expediente.expediente_id, cut, solicitante_id: idPersona,
            identidad: 'DECLARADA_PENDIENTE_VERIFICACION_INSTITUCIONAL', declaracionVeracidad: true, aceptaTerminos: true,
            ...(demoSinPago ? { modalidad: MARCA_PAGO_DEMO, estado_economico: 'NO_VERIFICADO' } : {}) } });
        await cliente.query('UPDATE sigd_tra.radicacion_publica SET expediente_id=$2::uuid, respuesta=$3::jsonb WHERE sesion_hash=$1',
          [publico.sesionHash, expediente.expediente_id, JSON.stringify(resultado)]);

        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'radicacion_exitosa',
          payload: {
            solicitante_id: idPersona,
            expediente_id: expediente.expediente_id,
            cut,
            asunto: `Trámite radicado exitosamente — CUT: ${cut}`,
            tipo_acto: 'RADICACION_PUBLICO',
            cuerpo: {
              totalFolios: resultado.totalFolios,
              fechaRadicacionLegal: resultado.fechaRadicacionLegal,
              diferidoPorCorte: resultado.fueraDeHorario,
              correoDeclarado: publico.datos.correo,
              telefonoDeclarado: publico.datos.telefono,
              nombreDeclarado: publico.datos.nombreSolicitante,
              enlaceConsultaPublica: `/tramites/consulta-publica/${cut}`,
              ...(enlaceSeguroCifrado ? { enlaceSeguroCifrado, tokenSeguimientoCifrado } : {}),
            },
          },
        });
      } else {
        await registrarMutacion(cliente, { esquema: 'sigd_tra', tabla: 'radicacion_virtual', operacion: 'INSERT',
          datos_despues: { expediente_id: expediente.expediente_id, cut, solicitante_id: idPersona,
            usuario_id: idUsuarioAutenticado, huella_solicitud: huellaAutenticada, resultado,
            identidad: 'SESION_AUTENTICADA',
            ...(demoSinPago ? { modalidad: MARCA_PAGO_DEMO, estado_economico: 'NO_VERIFICADO' } : {}) } });
        await cliente.query(`
          INSERT INTO sigd_tra.vinculacion_expediente_cuenta
            (expediente_id, id_usuario, id_persona, estado, motivo_solicitud, fecha_resolucion)
          VALUES ($1::uuid, $2::uuid, $3::uuid, 'APROBADA', 'Radicación autenticada inicial', now())
          ON CONFLICT (expediente_id, id_usuario) DO NOTHING
        `, [expediente.expediente_id, idUsuarioAutenticado, idPersona]);

        await insertarEvento(cliente, {
          agregado: 'Expediente',
          tipo_evento: 'radicacion_exitosa',
          payload: {
            usuario_id: idUsuarioAutenticado,
            expediente_id: expediente.expediente_id,
            cut,
            asunto: `Trámite radicado exitosamente — CUT: ${cut}`,
            tipo_acto: 'RADICACION_VIRTUAL',
            cuerpo: {
              totalFolios: resultado.totalFolios,
              fechaRadicacionLegal: resultado.fechaRadicacionLegal,
              diferidoPorCorte: resultado.fueraDeHorario,
            },
          },
        });
      }
      await cliente.query('COMMIT');
      transaccionAbierta = false;
      return resultado;
    } catch (error) {
      if (transaccionAbierta) await cliente.query('ROLLBACK');
      // La traduccion de SQLSTATE a respuesta HTTP la hace el middleware de
      // errores de la plataforma (23505 -> 409, 23503 -> 400, P0001 -> 422),
      // de modo que aqui solo se garantiza que la transaccion no queda abierta.
      throw error;
    } finally {
      cliente.release();
    }
  }

  async resolverPersonaDeclarada(cliente: PoolClient, datos: Pick<RadicacionPublicaInput,'tipoDocumento'|'numeroDocumento'|'nombres'|'apellidos'|'nombreSolicitante'|'correo'|'telefono'>): Promise<string> {
    // The unique natural-document key serializes concurrent first submissions.
    // Existing personal data and institutional accounts are never overwritten.
    const nueva = await cliente.query<{ id_persona: string }>(`INSERT INTO sigd_auth.persona (tipo, id_documento)
      VALUES ('NATURAL', $1) ON CONFLICT (tipo, id_documento) DO NOTHING RETURNING id_persona`, [normalizarDocumento(datos.numeroDocumento)]);
    if (nueva.rows[0]) {
      await cliente.query(`INSERT INTO sigd_auth.persona_natural (id_persona,nombres,apellidos,nombre_completo,correo,telefono)
        VALUES ($1::uuid,$2,$3,$4,$5,$6)`, [nueva.rows[0].id_persona, datos.nombres, datos.apellidos, datos.nombreSolicitante, datos.correo, datos.telefono]);
      return nueva.rows[0].id_persona;
    }
    const existente = await cliente.query<{ id_persona: string; nombre_completo: string }>(`SELECT p.id_persona,pn.nombre_completo
      FROM sigd_auth.persona p JOIN sigd_auth.persona_natural pn USING (id_persona)
      WHERE p.tipo='NATURAL' AND p.id_documento=$1`, [normalizarDocumento(datos.numeroDocumento)]);
    if (!existente.rows[0] || normalizarIdentidad(existente.rows[0].nombre_completo) !== normalizarIdentidad(datos.nombreSolicitante)) {
      throw new ValidationError({ invalidParams: [{ name: 'identificacion', reason: 'IDENTIDAD_NO_COINCIDENTE: revise sus datos o solicite validación en ventanilla.' }] });
    }
    return existente.rows[0].id_persona;
  }

  private async evaluarHorario(now: Date, cliente: PoolClient): Promise<ResultadoHorarioCorte> {
    const feriados = await this.obtenerFeriados(cliente);
    return calcularHorarioCorte(now, feriados);
  }

  private async verificarTipoTramite(cliente: PoolClient, idTipoTramiteTupa: string): Promise<void> {
    const resultado = await cliente.query<FilaTramiteTupa>(
      `SELECT tipo_tramite_id AS id_tipo_tramite_tupa,
              vigente AS activo
         FROM sigd_doc.tipo_tramite_tupa
        WHERE tipo_tramite_id = $1`,
      [idTipoTramiteTupa],
    );
    const tipo = resultado.rows[0];
    if (!tipo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_DESCONOCIDO: el tramite no existe en el catalogo TUPA.' },
        ],
      });
    }
    if (!tipo.activo) {
      throw new ValidationError({
        invalidParams: [
          { name: 'idTipoTramiteTupa', reason: 'TIPO_TRAMITE_INACTIVO: el tramite ya no admite nuevas radicaciones.' },
        ],
      });
    }
  }

  private async resolverPersonaAutenticada(
    cliente: PoolClient,
    idUsuario: string,
    tipoDocumento: string,
    numeroDocumento: string,
    nombreSolicitante: string,
  ): Promise<string> {
    const resultado = await cliente.query<{
      id_persona: string | null;
      id_documento: string | null;
      tipo_persona: string | null;
      nombre_identidad: string | null;
      activo: boolean;
    }>(
      `SELECT c.id_persona,
              p.id_documento,
              p.tipo AS tipo_persona,
              COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_identidad,
              c.activo
         FROM sigd_auth.cuenta_usuario c
         LEFT JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
         LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
        WHERE c.id_usuario = $1::uuid
        LIMIT 1`,
      [idUsuario],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) {
      throw new UnauthorizedError({
        detail: 'La sesión no corresponde a una cuenta vigente.',
      });
    }
    if (
      !cuenta.activo ||
      !cuenta.id_persona ||
      !cuenta.id_documento ||
      !cuenta.tipo_persona ||
      !cuenta.nombre_identidad
    ) {
      throw new ForbiddenError({
        detail: 'La cuenta no está habilitada o no tiene una identidad registrada para radicar.',
      });
    }
    const tipoPersonaEsperado = tipoDocumento === 'RUC' ? 'JURIDICA' : 'NATURAL';
    if (
      normalizarDocumento(cuenta.id_documento) !== normalizarDocumento(numeroDocumento) ||
      cuenta.tipo_persona !== tipoPersonaEsperado ||
      normalizarIdentidad(cuenta.nombre_identidad) !== normalizarIdentidad(nombreSolicitante)
    ) {
      throw new ForbiddenError({
        detail: 'Los datos declarados no coinciden con la identidad vinculada a la sesión.',
      });
    }
    return cuenta.id_persona;
  }

  /** Resuelve la clasificación unívoca para 1 o varios archivos autorizados por la configuración del TUPA. */
  private async resolverTipoDocumental(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    demoSinPago = false,
    gratuidadVerificada = false,
  ): Promise<{ tipoPrincipalId: string; documentosClasificados: DocumentoClasificado[] }> {
    if (datos.documentos.some(d => d.clasificacion || d.requisitoId)) {
      return validarDocumentacionTramite(cliente, datos);
    }
    const tieneMultiples = datos.documentos.length > 1;
    const todosClasificados = datos.documentos.every(
      (d) => Boolean(d.tipoDocumentalId || d.tipoDocumentalCodigo),
    );
    // Si son múltiples archivos y ninguno/no todos tienen clasificación explícita,
    // aborta inmediatamente sin consultar la BD para no asumir orden ni nombres:
    if (tieneMultiples && !todosClasificados) {
      throw new ValidationError({
        invalidParams: [{ name: 'documentos', reason: 'CLASIFICACION_DOCUMENTAL_AMBIGUA: no existe una regla para clasificar varios archivos.' }],
      });
    }

    const resultado = await cliente.query<{ tipo_documental_id: string; tipo_doc_codigo: string; requiere_condicion: boolean; obligatorio: boolean }>(
      `SELECT td.tipo_documental_id,
              td.codigo AS tipo_doc_codigo,
              bool_or(dr.condicion_json_pointer IS NOT NULL) AS requiere_condicion,
              bool_or(r.obligatorio) AS obligatorio
         FROM sigd_doc.requisito r
         JOIN sigd_doc.tipo_documento_requisito dr ON dr.requisito_id = r.requisito_id
         JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = dr.tipo_documental_id
        WHERE r.tipo_tramite_id = $1::uuid AND td.vigente = TRUE
        GROUP BY td.tipo_documental_id, td.codigo`,
      [datos.idTipoTramiteTupa],
    );

    // A validated free procedure need not supply the optional bank voucher.
    // Preserve all other classifications and mandatory document checks.
    if(gratuidadVerificada&&resultado.rows.length===1&&resultado.rows[0].tipo_doc_codigo==='COMPROBANTE_PAGO'&&resultado.rows[0].obligatorio===false&&datos.documentos.every(d=>d.tipoDocumentalCodigo==='FUT'&&!d.tipoDocumentalId)){
      const fut=await cliente.query<{tipo_documental_id:string}>("SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo='FUT' AND vigente=TRUE");
      if(fut.rows.length!==1)throw new ValidationError({invalidParams:[{name:'documentos',reason:'No existe una clasificación FUT única para la solicitud gratuita.'}]});
      resultado.rows=[{tipo_documental_id:fut.rows[0].tipo_documental_id,tipo_doc_codigo:'FUT',requiere_condicion:false,obligatorio:false}];
    }
    // Economic clearance was established before calling this resolver.
    // Preserve other requirements; no duplicate bank evidence in the application.
    if (demoSinPago) {
      const pagos = resultado.rows.filter(r => r.tipo_doc_codigo === 'COMPROBANTE_PAGO');
      if (datos.documentos.some(d => d.tipoDocumentalCodigo === 'COMPROBANTE_PAGO' || pagos.some(p => p.tipo_documental_id === d.tipoDocumentalId))) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'El comprobante de pago se gestiona en Tesorería; adjunte la solicitud y los requisitos del procedimiento.' }] });
      }
      resultado.rows = resultado.rows.filter(r => r.tipo_doc_codigo !== 'COMPROBANTE_PAGO');
      if (pagos.length && resultado.rows.length === 0) {
        // SUZ26-035 only configures the optional voucher. A DEMO request is a
        // FUT, never a counterfeit voucher. Resolve the existing canonical type.
        const solicitud = await cliente.query<{ tipo_documental_id: string }>(
          "SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo='FUT' AND vigente=TRUE");
        if (solicitud.rows.length !== 1) throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'No existe una clasificación FUT única y vigente para la solicitud demostrativa.' }] });
        resultado.rows.push({ tipo_documental_id: solicitud.rows[0].tipo_documental_id, tipo_doc_codigo: 'FUT', requiere_condicion: false, obligatorio: true });
      }
    }

    if (resultado.rows.length === 0) {
      // Sin ficha específica se conserva la recepción general, sin crear requisitos TUPA.
      const general=await cliente.query<{tipo_documental_id:string}>("SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE codigo='FUT' AND vigente=TRUE");
      if(general.rows.length===1)resultado.rows.push({tipo_documental_id:general.rows[0].tipo_documental_id,tipo_doc_codigo:'FUT',requiere_condicion:false,obligatorio:false});
    }
    if (resultado.rows.length === 0) {
      throw new ValidationError({
        invalidParams: [{
          name: 'documentos',
          reason: 'CLASIFICACION_DOCUMENTAL_NO_CONFIGURADA: el procedimiento no tiene un tipo documental vigente asociado.',
        }],
      });
    }

    if (resultado.rows.some((r) => r.requiere_condicion)) {
      throw new ValidationError({
        invalidParams: [{
          name: 'documentos',
          reason: 'CLASIFICACION_DOCUMENTAL_AMBIGUA: la arquitectura actual no contiene información suficiente para distinguir los tipos documentales.',
        }],
      });
    }

    // No ignorar una clasificación explícita, tampoco en procedimientos con
    // un único tipo. Si llegan ID y código, ambos deben designar el mismo tipo.
    for (const doc of datos.documentos) {
      const porId = doc.tipoDocumentalId
        ? resultado.rows.find(r => r.tipo_documental_id.toLowerCase() === doc.tipoDocumentalId!.toLowerCase())
        : undefined;
      const porCodigo = doc.tipoDocumentalCodigo
        ? resultado.rows.find(r => r.tipo_doc_codigo?.toUpperCase() === doc.tipoDocumentalCodigo!.toUpperCase())
        : undefined;
      if ((doc.tipoDocumentalId && !porId) || (doc.tipoDocumentalCodigo && !porCodigo) ||
          (porId && porCodigo && porId.tipo_documental_id !== porCodigo.tipo_documental_id)) {
        throw new ValidationError({
          invalidParams: [{ name: 'documentos', reason: 'TIPO_DOCUMENTAL_NO_AUTORIZADO: la clasificación declarada no corresponde al procedimiento o es contradictoria.' }],
        });
      }
    }

    // Caso A: Procedimiento configurado con exactamente 1 tipo documental
    if (resultado.rows.length === 1) {
      if (datos.documentos.length !== 1) {
        throw new ValidationError({
          invalidParams: [{ name: 'documentos', reason: 'CLASIFICACION_DOCUMENTAL_AMBIGUA: no existe una regla para clasificar varios archivos.' }],
        });
      }
      const unico = resultado.rows[0];
      return {
        tipoPrincipalId: unico.tipo_documental_id,
        documentosClasificados: [{ tipoDocumentalId: unico.tipo_documental_id }],
      };
    }

    // Caso B: Procedimiento configurado con múltiples tipos documentales (ej. SUZ26-066 con FUT y COMPROBANTE_PAGO)
    if (datos.documentos.length === 1 && !todosClasificados) {
      throw new ValidationError({
        invalidParams: [{
          name: 'documentos',
          reason: 'CLASIFICACION_DOCUMENTAL_AMBIGUA: la arquitectura actual no contiene información suficiente para distinguir los tipos documentales.',
        }],
      });
    }

    const mapaTipos = new Map<string, typeof resultado.rows[0]>();
    for (const row of resultado.rows) {
      mapaTipos.set(row.tipo_documental_id.toLowerCase(), row);
      mapaTipos.set(row.tipo_doc_codigo.toUpperCase(), row);
    }

    const tiposAsignados = new Set<string>();
    const documentosClasificados = datos.documentos.map((doc) => {
      const clave = doc.tipoDocumentalId?.toLowerCase() ?? doc.tipoDocumentalCodigo?.toUpperCase();
      const tipo = clave ? mapaTipos.get(clave) : undefined;
      if (!tipo) {
        throw new ValidationError({
          invalidParams: [{
            name: 'documentos',
            reason: `TIPO_DOCUMENTAL_NO_AUTORIZADO: El tipo documental '${clave}' no es válido para este procedimiento.`,
          }],
        });
      }
      if (tiposAsignados.has(tipo.tipo_documental_id)) {
        throw new ValidationError({
          invalidParams: [{
            name: 'documentos',
            reason: `TIPO_DOCUMENTAL_DUPLICADO: Se proporcionó más de un documento para el tipo '${tipo.tipo_doc_codigo}'.`,
          }],
        });
      }
      tiposAsignados.add(tipo.tipo_documental_id);
      return { tipoDocumentalId: tipo.tipo_documental_id };
    });

    const faltantes = resultado.rows.filter((r) => r.obligatorio && !tiposAsignados.has(r.tipo_documental_id));
    if (faltantes.length > 0) {
      throw new ValidationError({
        invalidParams: [{
          name: 'documentos',
          reason: `DOCUMENTOS_FALTANTES: Faltan los siguientes documentos obligatorios: ${faltantes.map(f => f.tipo_doc_codigo).join(', ')}.`,
        }],
      });
    }

    const tipoFut = resultado.rows.find((r) => r.tipo_doc_codigo === 'FUT' && tiposAsignados.has(r.tipo_documental_id));
    const tipoPrincipalId = tipoFut ? tipoFut.tipo_documental_id : documentosClasificados[0].tipoDocumentalId;

    return {
      tipoPrincipalId,
      documentosClasificados,
    };
  }

  private async insertarExpediente(
    cliente: PoolClient,
    datos: RadicacionVirtualInput,
    idPersona: string,
    cut: string,
    horario: ResultadoHorarioCorte,
    tipoDocumentalId: string,
  ): Promise<FilaExpediente> {
    const resultado = await cliente.query<{ expediente_id: string; fecha_registro: Date }>(
      `INSERT INTO sigd_doc.expediente
         (tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5)
       RETURNING expediente_id, fecha_registro`,
      [datos.idTipoTramiteTupa, cut, datos.asunto, idPersona, horario.envioReal],
    );
    const expediente = resultado.rows[0];
    if (!expediente) {
      throw new Error('La insercion del expediente no devolvio fila.');
    }

    let areaDestinoId: string | null = null;
    if (datos.idTipoTramiteTupa) {
      const procFila = await cliente.query<{ codigo: string }>(
        'SELECT codigo FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id = $1::uuid',
        [datos.idTipoTramiteTupa],
      );
      if (procFila.rows[0]) {
        const configDoc = CATALOGO_DOCUMENTAL_POR_CODIGO.get(procFila.rows[0].codigo);
        let codigoArea = 'MP'; // Flujo seguro por defecto: Mesa de Partes (MP)
        const entraPorMesaPartes = (configDoc?.unidadRecepcion ?? '').toLowerCase().includes('mesa de partes');
        // Solo asignar automáticamente el área responsable si la recepción no exige ingreso previo por Mesa de Partes
        if (!entraPorMesaPartes && configDoc?.unidadResponsableVerificada === true) {
          const unidadResp = (configDoc.unidadResponsable ?? '').toLowerCase();
          if (unidadResp.includes('secretar') || unidadResp.includes('académic')) {
            codigoArea = 'SEC';
          } else if (unidadResp.includes('dirección') || unidadResp.includes('general')) {
            codigoArea = 'DG';
          }
        }
        const areaFila = await cliente.query<{ area_id: string }>(
          'SELECT area_id FROM sigd_org.area WHERE codigo = $1 AND vigente = TRUE LIMIT 1',
          [codigoArea],
        );
        if (areaFila.rows[0]) {
          areaDestinoId = areaFila.rows[0].area_id;
        } else {
          // Si el área específica no existe en sigd_org.area, asegurar recepción en MP
          const mpFila = await cliente.query<{ area_id: string }>(
            "SELECT area_id FROM sigd_org.area WHERE codigo = 'MP' AND vigente = TRUE LIMIT 1",
          );
          if (mpFila.rows[0]) {
            areaDestinoId = mpFila.rows[0].area_id;
          }
        }
      }
    }

    // firma.routes.ts ya consulta ambos dominios con esta identidad compartida.
    await cliente.query(
      `INSERT INTO sigd_tra.expediente
         (expediente_id, codigo_expediente, numero, dni_solicitante,
          tipo_documental_id, solicitante_id, area_destino_id, fecha_radicacion)
       VALUES ($1::uuid, $2, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7)`,
      [expediente.expediente_id, cut, datos.tipoDocumento === 'DNI' ? datos.numeroDocumento : null,
        tipoDocumentalId, idPersona, areaDestinoId, horario.radicacionLegal],
    );
    await cliente.query(
      `INSERT INTO sigd_tra.tramite (expediente_id, asunto)
       VALUES ($1::uuid, $2)`,
      [expediente.expediente_id, datos.asunto],
    );
    return {
      expediente_id: expediente.expediente_id,
      cut,
      fecha_envio_real: expediente.fecha_registro,
      fecha_radicacion_legal: horario.radicacionLegal,
      fuera_de_horario: horario.requiereProyeccion,
    };
  }

  /** Verifica el objeto existente; nunca crea claves ni acepta una URL blob. */
  private async verificarArchivo(documento: RadicacionVirtualInput['documentos'][number], titular?: { cliente: PoolClient; usuario: string }): Promise<{ bucket: string; key: string; paginas: number }> {
    const config = obtenerConfiguracionS3();
    const key = documento.storagePath;
    if (!key || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(key)) {
      throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_ALMACENADO: falta la clave devuelta por storage/presigned-url.' }] });
    }
    if (titular) {
      const emitida = await titular.cliente.query(`SELECT 1 FROM sigd_audit.bitacora_auditoria
        WHERE esquema='sigd_doc' AND tabla='carga_documental'
          AND datos_despues->>'usuario_id'=$1 AND datos_despues->>'s3_key'=$2
          AND datos_despues->>'sha256'=$3 AND datos_despues->>'tamano_bytes'=$4
          AND datos_despues->>'nombre'=$5`,
        [titular.usuario, key, documento.hashSha256.toLowerCase(), String(documento.tamanoBytes), documento.nombreArchivo]);
      if (emitida.rows.length !== 1) throw new ForbiddenError({ detail: 'El archivo no corresponde a una carga de su cuenta. Vuelva a adjuntarlo.' });
    }
    const url = generarUrlPresigned(key, config, { metodo: 'GET', expiraSegundos: 60 });
    // La URL prefirmada GET contiene la autenticación en su query.
    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    if (!respuesta.ok || !respuesta.body) {
      await respuesta.body?.cancel();
      throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_DISPONIBLE: storage no permite verificar el objeto.' }] });
    }
    const lector = respuesta.body.getReader();
    const hash = createHash('sha256');
    let tamano = 0;
    let prefijo = Buffer.alloc(0);
    const fragmentos: Buffer[] = [];
    try {
      while (true) {
        const { done, value } = await lector.read();
        if (done) break;
        tamano += value.byteLength;
        if (tamano > documento.tamanoBytes) {
          throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_COINCIDE: tamaño distinto del objeto almacenado.' }] });
        }
        if (prefijo.length < 5) {
          prefijo = Buffer.concat([prefijo, Buffer.from(value.subarray(0, 5 - prefijo.length))]);
        }
        fragmentos.push(Buffer.from(value));
        hash.update(value);
      }
      if (tamano !== documento.tamanoBytes || hash.digest('hex') !== documento.hashSha256.toLowerCase()
          || respuesta.headers.get('content-type')?.split(';')[0].trim() !== documento.contentType) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_COINCIDE: hash, tamaño o MIME distintos del objeto almacenado.' }] });
      }
      if (documento.contentType === 'application/pdf' && !validarMagicBytes(prefijo, 'PDF')) {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'ARCHIVO_NO_VALIDO: el objeto almacenado no tiene la firma binaria PDF.' }] });
      }
      if (documento.contentType !== 'application/pdf') {
        throw new ValidationError({ invalidParams: [{ name: 'documentos', reason: 'La foliación automática requiere documentos PDF válidos.' }] });
      }
      const paginas = await contarPaginasPdf(Buffer.concat(fragmentos, tamano));
      return { bucket: config.bucket, key, paginas };
    } finally {
      await lector.cancel();
      lector.releaseLock();
    }
  }

  private async insertarAdjuntos(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    documentosClasificados: DocumentoClasificado[],
    archivos: Array<{ bucket: string; key: string; paginas: number }>,
    idUsuario: string | null,
  ): Promise<void> {
    const totalDocs = datos.documentos.length;

    for (let i = 0; i < totalDocs; i++) {
      const documento = datos.documentos[i];
      const tipoDocumentalId = documentosClasificados[i].tipoDocumentalId;
      const archivo = archivos[i] ?? archivos[0];

      const resultado = await cliente.query<{ documento_adjunto_id: string }>(
        `INSERT INTO sigd_doc.documento_adjunto
           (expediente_id, nombre_archivo, mime_type, tamano_bytes, sha256,
            s3_bucket, s3_key, tipo_documental_id, subido_por)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, $9::uuid)
         RETURNING documento_adjunto_id`,
        [
          expedienteId,
          documento.nombreArchivo,
          documento.contentType,
          documento.tamanoBytes,
          documento.hashSha256.toLowerCase(),
          archivo.bucket,
          archivo.key,
          tipoDocumentalId,
          idUsuario,
        ],
      );
      if (!resultado.rows[0]) throw new Error('La insercion del adjunto no devolvio fila.');

      const asociacion = documentosClasificados[i];
      if (asociacion.clasificacion) {
        // Manifiesto completo para varios archivos por requisito; la relación
        // histórica expediente_requisito conserva el primer documento recibido.
        await registrarMutacion(cliente, { esquema: 'sigd_doc', tabla: 'documento_adjunto', operacion: 'INSERT',
          datos_despues: { expediente_id: expedienteId, documento_adjunto_id: resultado.rows[0].documento_adjunto_id,
            tipo_documental_id: tipoDocumentalId, clasificacion: asociacion.clasificacion,
            requisito_id: asociacion.requisitoId ?? null, s3_bucket: archivo.bucket, s3_key: archivo.key,
            sha256: documento.hashSha256.toLowerCase() } });
        if (asociacion.requisitoId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asociacion.requisitoId)) {
          await cliente.query(`INSERT INTO sigd_doc.expediente_requisito
            (expediente_id,requisito_id,documento_adjunto_id,cumplido)
            VALUES ($1::uuid,$2::uuid,$3::uuid,FALSE) ON CONFLICT (expediente_id,requisito_id) DO NOTHING`,
          [expedienteId, asociacion.requisitoId, resultado.rows[0].documento_adjunto_id]);
        }
      }

      await cliente.query<{ expediente_id: string }>(
        `SELECT expediente_id
           FROM sigd_tra.expediente
          WHERE expediente_id = $1::uuid
          FOR UPDATE`,
        [expedienteId],
      );

      const siguienteFolio = await cliente.query<{ folio_inicio: number }>(
        `SELECT COALESCE(MAX(f.folio_fin), 0) + 1 AS folio_inicio
           FROM sigd_tra.expediente_documento_folio AS f
          WHERE f.expediente_id = $1::uuid`,
        [expedienteId],
      );
      const folioInicio = Number(siguienteFolio.rows[0]?.folio_inicio);
      if (!Number.isSafeInteger(folioInicio) || folioInicio < 1) {
        throw new Error('No se pudo determinar el folio inicial del documento.');
      }
      const foliosEsteDoc = archivo.paginas;

      await cliente.query(
        `INSERT INTO sigd_tra.expediente_documento_folio
           (expediente_id, id_documento, folio_inicio, folio_fin, asignado_por)
         VALUES ($1::uuid, $2::uuid, $3::integer, $4::integer, $5::uuid)`,
        [expedienteId, resultado.rows[0].documento_adjunto_id, folioInicio,
          folioInicio + foliosEsteDoc - 1, idUsuario],
      );
    }
  }

  private async emitirCargoDigital(
    cliente: PoolClient,
    expedienteId: string,
    datos: RadicacionVirtualInput,
    now: Date,
    cut: string,
    idPersona: string,
  ): Promise<ResultadoRadicacion['cargoDigital']> {
    const codigo = cut;
    const contenido = JSON.stringify({
      codigo,
      expedienteId,
      totalFolios: datos.totalFolios,
      emitidoEn: now.toISOString(),
    });
    const hashSha256 = createHash('sha256').update(contenido).digest('hex');
    const qrContenido = `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(cut)}`;

    await cliente.query(
      `INSERT INTO sigd_tra.asiento_registro
         (expediente_id, fecha_ingreso, canal_ingreso, asunto, remitente_id)
       VALUES ($1::uuid, $2, 'MESA_VIRTUAL', $3, $4::uuid)`,
      [expedienteId, now, datos.asunto, idPersona],
    );

    return { codigo, hashSha256, qrContenido };
  }
}

/**
 * El ejercicio fiscal del CUT sigue al ano de la recepcion tecnica, no al ano
 * de la fecha legal proyectada: un documento recibido el 31 de diciembre a las
 * 18:00 conserva el correlativo de diciembre aunque su computo de plazos
 * arranque en enero.
 */
function anioDeRecepcion(now: Date): number {
  return CutService.anioFiscalCorriente(now);
}

function redactarMensajeLegal(horario: ResultadoHorarioCorte): string {
  if (!horario.requiereProyeccion) {
    return 'Radicacion dentro del horario de atencion. El computo de plazos comienza de inmediato.';
  }
  if (horario.diaNoHabil) {
    return `Recibido en dia no habil. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
  }
  return `Recibido despues del corte de las 16:30. Por Art. 138 de la LPAG el computo de plazos comienza el ${horario.fechaLegal} a las 08:00.`;
}

function normalizarDocumento(documento: string): string {
  return documento.trim().toLocaleUpperCase('es-PE');
}

function normalizarIdentidad(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-PE')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Proveedor por defecto: lee los feriados del calendario laboral existente.
 * Los errores de lectura se propagan para impedir generar un CUT sin haber
 * comprobado el calendario. Un resultado vacío válido sigue siendo admisible.
 */
export function crearProveedorFeriados(pool: Pool): ProveedorFeriados {
  return async function obtenerFeriados(clienteTransaccional?: PoolClient): Promise<string[]> {
    const cliente = clienteTransaccional ?? await pool.connect();
    try {
      const resultado = await cliente.query<{ fecha: string }>(
        `SELECT DISTINCT to_char(n.fecha, 'YYYY-MM-DD') AS fecha
           FROM sigd_org.calendario_laboral AS n
          WHERE n.activo = TRUE
            AND n.es_laborable = FALSE
            AND n.fecha >= CURRENT_DATE - INTERVAL '1 year'
            AND n.fecha <= CURRENT_DATE + INTERVAL '5 years'
            AND NOT EXISTS (
              SELECT 1 FROM sigd_org.calendario_laboral AS h
               WHERE h.fecha = n.fecha
                 AND h.activo = TRUE
                 AND h.es_laborable = TRUE
            )
          ORDER BY fecha`,
      );
      return resultado.rows.map((fila) => fila.fecha);
    } finally {
      if (!clienteTransaccional) cliente.release();
    }
  };
}


