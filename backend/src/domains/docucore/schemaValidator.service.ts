import { Ajv2020, ValidateFunction, AnySchema } from 'ajv/dist/2020.js';
import * as addFormatsMod from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import type { Pool } from 'pg';
import { AppError, InvalidParam } from '../../shared/domain/errors/app-error.js';

const addFormats = (addFormatsMod as unknown as { default: FormatsPlugin }).default;

// =============================================================================
// DocuCore · Validador dinámico de JSON Schema (Draft 2020-12) — Ajv
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-02
// =============================================================================
// Cada procedimiento TUPA tiene su esquema de validación versionado en base de
// datos (sigd_doc.formulario_version.schema_definicion). Este servicio lo
// carga, lo compila con Ajv (2020-12) y valida los metadatos del documento.
//
// Comportamiento exigido:
//   * Rechaza automáticamente datos inconsistentes (créditos negativos, fechas
//     con formato inválido, ...) sin validaciones manuales cableadas.
//   * Los rechazos se serializan bajo RFC 7807 con code SCHEMA_VALIDATION_FAILED
//     detallando el/los campo(s) exacto(s) defectuosos o faltantes.
//   * Es seguro ante esquemas mal formados o intentos de inyección (sin
//     ejecución de código, sin refs remotas, sin prototipos contaminados).
// =============================================================================

export interface EsquemaTupaCargado {
  codigo_tupa: string;
  version: number;
  schema_definicion: unknown;
}

export interface CargadorEsquemas {
  cargarActivo(codigoTupa: string): Promise<EsquemaTupaCargado | null>;
}

interface ConfigAjvEsquema {
  maxNodos: number;
  maxProfundidad: number;
}

const OPCIONES_AJV = {
  allErrors: true,
  strict: true,
  validateFormats: true,
  coerceTypes: false,
  useDefaults: false,
  removeAdditional: false,
};

type ErrorAjv = {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
};

// --- Errores de dominio (RFC 7807) ------------------------------------------

export class SchemaValidationError extends AppError {
  constructor(invalidParams: InvalidParam[], detail?: string) {
    super({
      status: 422,
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'Los metadatos del documento no cumplen el esquema TUPA.',
      detail: detail ?? 'Los datos no cumplen la estructura requerida por el procedimiento TUPA.',
      invalidParams,
    });
  }
}

export class SchemaInvalidoError extends AppError {
  private readonly detalleTecnico: string;

  constructor(detalleTecnico: string) {
    super({
      status: 500,
      code: 'SCHEMA_INVALID',
      message: 'El esquema de validación del trámite es inválido.',
      detail: 'El esquema de validación registrado para el procedimiento es inválido o inseguro.',
    });
    this.detalleTecnico = detalleTecnico;
  }

  obtenerDetalleTecnico(): string {
    return this.detalleTecnico;
  }
}

// --- Validación de integridad del propio esquema -----------------------------

const PROPIEDADES_PELIGROSAS = ['__proto__', 'constructor', 'prototype'];

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function recorrerYVerificar(
  valor: unknown,
  camino: string,
  config: ConfigAjvEsquema,
  estado: { nodos: number; profundidad: number },
): void {
  estado.nodos += 1;
  if (estado.nodos > config.maxNodos) {
    throw new SchemaInvalidoError(`Esquema demasiado grande (nodos > ${config.maxNodos}).`);
  }
  if (estado.profundidad > config.maxProfundidad) {
    throw new SchemaInvalidoError(`Esquema demasiado profundo (> ${config.maxProfundidad}).`);
  }
  if (Array.isArray(valor)) {
    for (const hijo of valor) {
      recorrerYVerificar(hijo, `${camino}[]`, config, estado);
    }
    return;
  }
  if (!esObjetoPlano(valor)) {
    return;
  }
  for (const clave of Object.keys(valor)) {
    const claveMinus = clave.toLowerCase();
    if (PROPIEDADES_PELIGROSAS.includes(clave)) {
      throw new SchemaInvalidoError(`Propiedad no permitida en esquema: "${clave}" (${camino}).`);
    }
    // Refs remotas: Ajv no las resolvería, pero se bloquean explícitamente.
    if (claveMinus === '$ref' && typeof valor[clave] === 'string') {
      const ref = String(valor[clave]);
      if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('//')) {
        throw new SchemaInvalidoError(`$ref remota no permitida en esquema: "${ref}".`);
      }
      for (const frag of ['__proto__', 'constructor', 'prototype']) {
        if (ref.toLowerCase().includes(frag)) {
          throw new SchemaInvalidoError(`$ref con segmento peligroso: "${ref}".`);
        }
      }
    }
    if (claveMinus === '$id' && typeof valor[clave] === 'string') {
      const id = String(valor[clave]);
      if (/^(https?:)?\/\//i.test(id) || id.startsWith('//')) {
        throw new SchemaInvalidoError(`$id con URI externa no permitida: "${id}".`);
      }
    }
    recorrerYVerificar(valor[clave], `${camino}.${clave}`, config, estado);
  }
}

function verificarIntegridadEsquema(schema: unknown): void {
  if (!esObjetoPlano(schema)) {
    throw new SchemaInvalidoError('El esquema debe ser un objeto JSON.');
  }
  recorrerYVerificar(schema, '$', { maxNodos: 4096, maxProfundidad: 64 }, { nodos: 0, profundidad: 0 });
}

// --- Traducción de errores Ajv → invalid_params ------------------------------

function aNombreDeCampo(err: ErrorAjv): string {
  const ruta = err.instancePath.replace(/^\//, '').replaceAll('/', '.');
  if (err.keyword === 'required') {
    const faltante = err.params.missingProperty;
    return [ruta, String(faltante)].filter(Boolean).join('.');
  }
  if (err.keyword === 'additionalProperties') {
    const extra = err.params.additionalProperty;
    return [ruta, String(extra)].filter(Boolean).join('.');
  }
  return ruta === '' ? '(raíz)' : ruta;
}

function aMotivo(err: ErrorAjv): string {
  const base = err.message ?? `Violación de la regla "${err.keyword}".`;
  if (err.keyword === 'required') {
    return 'Campo obligatorio faltante.';
  }
  if (err.keyword === 'type') {
    return `Tipo incorrecto: se esperaba ${String(err.params.type)}.`;
  }
  if (err.keyword === 'minimum') {
    return `El valor no debe ser menor que ${String(err.params.limit)} (créditos no negativos).`;
  }
  if (err.keyword === 'maximum') {
    return `El valor no debe ser mayor que ${String(err.params.limit)}.`;
  }
  if (err.keyword === 'format') {
    return `Formato inválido: se esperaba "${String(err.params.format)}".`;
  }
  return base;
}

function maperrarErroresAjv(errores: ErrorAjv[]): InvalidParam[] {
  return errores.map((err) => ({ name: aNombreDeCampo(err), reason: aMotivo(err) }));
}

// --- Cargador desde PostgreSQL (patrón repositorio) ---------------------------

const QUERY_ESQUEMA_ACTIVO = `
  SELECT t.codigo_tupa,
         fv.version,
         fv.schema_definicion
    FROM sigd_doc.tipo_tramite_tupa t
    JOIN sigd_doc.tipo_documento td ON td.id_tipo_tramite_tupa = t.id_tipo_tramite_tupa
    JOIN sigd_doc.formulario_version fv ON fv.id_tipo_documento = td.id_tipo_documento
   WHERE t.codigo_tupa = $1
     AND t.activo = TRUE
     AND td.activo = TRUE
     AND fv.activo = TRUE
   ORDER BY fv.version DESC
   LIMIT 1;
`;

export function crearCargadorDesdePool(pool: Pool): CargadorEsquemas {
  return {
    async cargarActivo(codigoTupa: string): Promise<EsquemaTupaCargado | null> {
      const resultado = await pool.query<{
        codigo_tupa: string;
        version: number;
        schema_definicion: unknown;
      }>(QUERY_ESQUEMA_ACTIVO, [codigoTupa]);
      const fila = resultado.rows[0];
      if (!fila) {
        return null;
      }
      return {
        codigo_tupa: fila.codigo_tupa,
        version: Number(fila.version),
        schema_definicion: fila.schema_definicion,
      };
    },
  };
}

// --- Servicio -----------------------------------------------------------------

export class SchemaValidatorServicio {
  private readonly ajv: Ajv2020;
  private readonly cacheCompilados = new Map<string, ValidateFunction>();

  constructor(private readonly cargador: CargadorEsquemas) {
    this.ajv = new Ajv2020({ ...OPCIONES_AJV });
    addFormats(this.ajv);
  }

  private async obtenerEsquema(codigoTupa: string): Promise<EsquemaTupaCargado> {
    const cargado = await this.cargador.cargarActivo(codigoTupa);
    if (!cargado) {
      throw new AppError({
        status: 404,
        code: 'SCHEMA_NOT_FOUND',
        message: 'No existe un esquema de validación activo para el procedimiento TUPA.',
        detail: `No se encontró un esquema de validación activo para "${codigoTupa}".`,
      });
    }
    return cargado;
  }

  private async compilar(cargado: EsquemaTupaCargado): Promise<ValidateFunction> {
    const claveCache = `${cargado.codigo_tupa}#${cargado.version}`;
    const enCache = this.cacheCompilados.get(claveCache);
    if (enCache) {
      return enCache;
    }

    // Seguridad: el esquema se verifica antes de compilarse.
    verificarIntegridadEsquema(cargado.schema_definicion);

    let validar: ValidateFunction;
    try {
      validar = this.ajv.compile(cargado.schema_definicion as AnySchema);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      throw new SchemaInvalidoError(detalle);
    }

    this.cacheCompilados.set(claveCache, validar);
    return validar;
  }

  async validar(codigoTupa: string, datos: unknown): Promise<unknown> {
    const cargado = await this.obtenerEsquema(codigoTupa);
    const validar = await this.compilar(cargado);

    const correcto = validar(datos);
    if (correcto) {
      return datos;
    }

    const errores = (validar.errors ?? []) as unknown as ErrorAjv[];
    throw new SchemaValidationError(maperrarErroresAjv(errores));
  }

  /** Descarta el caché de esquemas compilados (útil al versionar esquemas). */
  limpiarCache(): void {
    this.cacheCompilados.clear();
  }
}