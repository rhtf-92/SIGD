import type { Pool } from 'pg';
import { ValidationError, NotFoundError } from '../../shared/domain/errors/index.js';
import type { RadicacionVirtualInput } from './tramites.schemas.js';
import { TesoreriaService } from '../tesoreria/tesoreria.service.js';
import { TesoreriaRepository } from '../tesoreria/tesoreria.repository.js';
import { CATALOGO_DOCUMENTAL_TUPA_2026, CATALOGO_DOCUMENTAL_POR_CODIGO } from './catalogoDocumentalTupa2026.js';

type Consulta = Pick<Pool, 'query'>;
export type ClasificacionAdjunto = 'EXPEDIENTE' | 'ANEXO';
interface TipoDocumento { id: string; codigo: string; nombre: string; condicion: string | null }
export interface RequisitoDocumental {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  obligatorio: boolean;
  clasificacion: ClasificacionAdjunto;
  formatosAdmitidos?: readonly string[];
  observaciones?: string;
  fuente?: string;
  estadoValidacion?: string;
  versionTupa?: string;
  tipos: TipoDocumento[];
}
export interface DocumentoClasificado {
  tipoDocumentalId: string;
  requisitoId?: string;
  clasificacion?: ClasificacionAdjunto;
}

export async function leerRequisitosDocumentales(c: Consulta, procedimiento: string) {
  const filas = await c.query<{ id: string; codigo: string; nombre: string; obligatorio: boolean; tipos: TipoDocumento[] }>(`
    SELECT r.requisito_id AS id,r.codigo,r.denominacion AS nombre,r.obligatorio,
      COALESCE(json_agg(json_build_object('id',td.tipo_documental_id,'codigo',td.codigo,'nombre',td.nombre,
        'condicion',x.condicion_json_pointer) ORDER BY td.codigo) FILTER(WHERE td.tipo_documental_id IS NOT NULL),'[]') AS tipos
    FROM sigd_doc.requisito r
    LEFT JOIN sigd_doc.tipo_documento_requisito x ON x.requisito_id=r.requisito_id
    LEFT JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id=x.tipo_documental_id AND td.vigente
    WHERE r.tipo_tramite_id=$1::uuid GROUP BY r.requisito_id ORDER BY r.orden,r.codigo`, [procedimiento]);
  const requisitos: RequisitoDocumental[] = filas.rows
    .filter(r => r.codigo !== 'COMPROBANTE_PAGO' && !(r.tipos.length > 0 && r.tipos.every(t => t.codigo === 'COMPROBANTE_PAGO')))
    .map(r => ({ ...r, tipos: r.tipos.filter(t => t.codigo !== 'COMPROBANTE_PAGO'),
      clasificacion: r.codigo === 'ANEXO' || r.codigo.startsWith('ANEXO_') || r.tipos.some(t => t.codigo === 'ANEXO') ? 'ANEXO' : 'EXPEDIENTE' }));
  return requisitos;
}

/** Añade detalle documental al catálogo institucional; los importes siguen viniendo de M10. */
export async function obtenerDocumentacionTramite(pool: Pool, id: string) {
  const procRes = await pool.query<{ tipo_tramite_id: string; codigo: string; denominacion: string }>(
    'SELECT tipo_tramite_id, codigo, denominacion FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id = $1::uuid AND vigente = TRUE',
    [id],
  );
  const procDb = procRes.rows[0];
  if (!procDb) throw new NotFoundError({ detail: 'El procedimiento no está vigente.' });

  const [catalogoTesoreria, requisitosDb, tiposGeneralesRes] = await Promise.all([
    new TesoreriaService(new TesoreriaRepository(pool)).catalogo().catch(() => []),
    leerRequisitosDocumentales(pool, id),
    pool.query<{ tipo_documental_id: string; codigo: string; nombre: string }>(
      "SELECT tipo_documental_id, codigo, nombre FROM sigd_doc.tipo_documento WHERE vigente = TRUE",
    ),
  ]);

  const tramite = catalogoTesoreria.find((t) => t.id === id);
  const configDoc = CATALOGO_DOCUMENTAL_TUPA_2026.find((c) => c.codigoInterno === procDb.codigo)
    ?? CATALOGO_DOCUMENTAL_POR_CODIGO.get(procDb.codigo);

  const tipoFut = tiposGeneralesRes.rows.find((t) => t.codigo === 'FUT' || t.codigo === 'FUT-MPV' || t.codigo.startsWith('FUT'));
  const tipoAnexo = tiposGeneralesRes.rows.find((t) => t.codigo === 'ANEXO' || t.codigo.startsWith('ANEXO')) ?? tipoFut;

  let requisitosFinales: RequisitoDocumental[] = requisitosDb;
  if (requisitosFinales.length === 0 && configDoc) {
    const todos = [...configDoc.requisitos, ...configDoc.anexos];
    requisitosFinales = todos.map((req) => {
      const tipoDoc = req.clasificacion === 'EXPEDIENTE' ? tipoFut : tipoAnexo;
      return {
        id: req.id,
        codigo: req.codigo,
        nombre: req.nombre,
        descripcion: req.descripcion,
        obligatorio: req.obligatorio,
        clasificacion: req.clasificacion,
        formatosAdmitidos: req.formatosAdmitidos,
        observaciones: req.observaciones,
        fuente: req.fuente,
        estadoValidacion: req.estadoValidacion,
        versionTupa: req.versionTupa,
        tipos: tipoDoc
          ? [{ id: tipoDoc.tipo_documental_id, codigo: tipoDoc.codigo, nombre: tipoDoc.nombre, condicion: null }]
          : [],
      };
    });
  }

  const requisitosExp = requisitosFinales.filter((r) => r.clasificacion === 'EXPEDIENTE');
  const anexosExp = requisitosFinales.filter((r) => r.clasificacion === 'ANEXO');

  return {
    id: procDb.tipo_tramite_id,
    codigo: procDb.codigo,
    codigoVisible: configDoc?.codigoVisible ?? procDb.codigo,
    numeroVisible: configDoc?.numeroVisible ?? '001',
    denominacion: procDb.denominacion,
    condicionFinanciera: tramite?.condicionFinanciera ?? 'PENDIENTE_VALIDACION',
    tarifa: tramite?.tarifas.length === 1 ? tramite.tarifas[0] : null,
    estadoValidacion: configDoc?.estadoValidacion ?? 'VALIDADO',
    sinAnexosEspecificos: configDoc?.sinAnexosEspecificos ?? (anexosExp.length === 0),
    observacionInstitucional: configDoc?.observacionInstitucional ?? '',
    unidadRecepcion: configDoc?.unidadRecepcion ?? 'Mesa de Partes (MP)',
    unidadResponsable: configDoc?.unidadResponsable ?? 'Secretaría Académica (SEC)',
    autoridadResolutiva: configDoc?.autoridadResolutiva ?? 'Pendiente de validación institucional',
    plazoDias: configDoc?.plazoDias ?? null,
    silencioAdministrativo: configDoc?.silencioAdministrativo ?? null,
    versionTupa: configDoc?.versionTupa ?? 'TUPA-2026-V1',
    requisitos: requisitosExp,
    anexos: anexosExp,
    nota: configDoc?.observacionInstitucional || 'Solo se muestran documentos configurados en el catálogo. El PDF principal es una exigencia técnica de recepción, no un requisito TUPA adicional. Los pagos se gestionan en Tesorería.',
  };
}

/** Valida pertenencia y obligatoriedad contra PostgreSQL antes de generar el CUT. */
export async function validarDocumentacionTramite(c: Consulta, datos: RadicacionVirtualInput) {
  let requisitos = await leerRequisitosDocumentales(c, datos.idTipoTramiteTupa);
  const tiposGenerales = (await c.query<{ id: string; codigo: string; nombre: string }>(
    "SELECT tipo_documental_id AS id, codigo, nombre FROM sigd_doc.tipo_documento WHERE (codigo IN ('FUT','ANEXO','FUT-MPV') OR codigo LIKE 'FUT%') AND vigente=TRUE"
  )).rows;

  if (requisitos.length === 0) {
    const proc = (await c.query<{ codigo: string }>(
      'SELECT codigo FROM sigd_doc.tipo_tramite_tupa WHERE tipo_tramite_id=$1::uuid',
      [datos.idTipoTramiteTupa]
    )).rows[0];
    const configDoc = proc
      ? (CATALOGO_DOCUMENTAL_TUPA_2026.find((c) => c.codigoInterno === proc.codigo) ?? CATALOGO_DOCUMENTAL_POR_CODIGO.get(proc.codigo))
      : undefined;
    if (configDoc) {
      const tipoFut = tiposGenerales.find(t => t.codigo === 'FUT' || t.codigo === 'FUT-MPV' || t.codigo.startsWith('FUT'));
      const tipoAnx = tiposGenerales.find(t => t.codigo === 'ANEXO' || t.codigo.startsWith('ANEXO')) ?? tipoFut;
      requisitos = [...configDoc.requisitos, ...configDoc.anexos].map(req => {
        const td = req.clasificacion === 'EXPEDIENTE' ? tipoFut : tipoAnx;
        return {
          id: req.id,
          codigo: req.codigo,
          nombre: req.nombre,
          obligatorio: req.obligatorio,
          clasificacion: req.clasificacion,
          tipos: td ? [{ id: td.id, codigo: td.codigo, nombre: td.nombre, condicion: null }] : [],
        };
      });
    }
  }

  const fallar = (reason: string): never => { throw new ValidationError({ invalidParams: [{ name: 'documentos', reason }] }); };
  if (!datos.documentos.some(d => d.clasificacion === 'EXPEDIENTE')) fallar('Adjunte al menos un PDF clasificado como EXPEDIENTE.');
  
  const asignados = new Set<string>();
  const documentosClasificados: DocumentoClasificado[] = datos.documentos.map(doc => {
    if (!doc.clasificacion) return fallar('Clasifique todos los archivos como EXPEDIENTE o ANEXO.');
    let requisito = doc.requisitoId ? requisitos.find(r => r.id === doc.requisitoId) : undefined;
    if (doc.requisitoId && !requisito) {
      if (doc.requisitoId.includes('FUT')) {
        requisito = requisitos.find(r => (r.codigo === 'FUT' || r.clasificacion === 'EXPEDIENTE') && !asignados.has(r.id));
      } else {
        const codigoBuscado = doc.requisitoId.replace(/^(REQ|ANX)-[^-]+-/, '');
        requisito = requisitos.find(r => r.codigo === codigoBuscado && !asignados.has(r.id));
      }
      if (!requisito) return fallar('El requisito indicado no pertenece al procedimiento o corresponde a Tesorería.');
    }
    if (requisito) {
      asignados.add(requisito.id);
    }
    if (requisito && requisito.clasificacion !== doc.clasificacion) return fallar(`Revise la clasificación de ${requisito.nombre}.`);
    if (requisito?.tipos.some(t => t.condicion !== null)) return fallar(`La condición documental de ${requisito.nombre} requiere validación institucional.`);
    const permitidos = requisito && requisito.tipos.length > 0
      ? requisito.tipos
      : tiposGenerales.filter(t => (doc.clasificacion === 'EXPEDIENTE' ? (t.codigo === 'FUT' || t.codigo === 'FUT-MPV' || t.codigo.startsWith('FUT')) : (t.codigo === 'ANEXO' || t.codigo.startsWith('ANEXO')))).map(t => ({ id: t.id, codigo: t.codigo, nombre: t.nombre, condicion: null }));
    const tipo = doc.tipoDocumentalId || doc.tipoDocumentalCodigo
      ? permitidos.find(t => (!doc.tipoDocumentalId || t.id === doc.tipoDocumentalId) && (!doc.tipoDocumentalCodigo || t.codigo === doc.tipoDocumentalCodigo))
      : permitidos.length === 1 ? permitidos[0] : undefined;
    if (!tipo) return fallar(`El tipo documental no está configurado de forma unívoca para ${requisito?.nombre ?? doc.clasificacion}.`);
    return { tipoDocumentalId: tipo.id, clasificacion: doc.clasificacion, ...(requisito ? { requisitoId: requisito.id } : {}) };
  });

  const faltantes = requisitos.filter(r => r.obligatorio && !documentosClasificados.some(d => d.requisitoId === r.id));
  if (faltantes.length) fallar(`Faltan documentos obligatorios: ${faltantes.map(r => r.nombre).join('; ')}.`);
  
  return { tipoPrincipalId: documentosClasificados.find(d => d.clasificacion === 'EXPEDIENTE')!.tipoDocumentalId, documentosClasificados };
}
