import { createHash } from 'crypto';
import { AppError } from '../../shared/domain/errors/index.js';

/**
 * DC-07 — Servicio de edicion y versionado de proyectos de resolucion.
 *
 * ===================================================================
 * ESTADO: BLOQUEADO. NO IMPLEMENTADO CONTRA UNA BASE DE DATOS REAL.
 * ===================================================================
 *
 * MOTIVO
 * ------
 * El DDL institucional vigente
 * (docs/03_docucore/05_esquema_sigd_doc_jsonb_v6.3_auditoria_corregido.sql)
 * NO define las entidades que este servicio necesita:
 *
 *   - sigd_doc.proyecto_resolucion
 *   - sigd_doc.proyecto_resolucion_version
 *
 * Tampoco existe ningun endpoint que exponga esta operacion.
 *
 * Sin esas tablas NO existe un contrato fisico verificable: no se conoce la
 * clave primaria, ni la FK que identifica al padre, ni como se representa el
 * estado de edicion, ni el nombre de las columnas de autoria o visado.
 * Cualquier SQL escrito aqui seria contra un esquema inventado y fallaria en
 * tiempo de ejecucion con "relation does not exist".
 *
 * DECISION
 * --------
 * Este servicio NO inventa tablas, columnas, estados ni nombres de columnas.
 * Todos los metodos publicos rechazan con 501 y un mensaje accionable.
 * Es preferible un fallo explicito y temprano a una persistencia silenciosa
 * contra un esquema que no existe o que sera distinto al asumido.
 *
 * QUE SE NECESITA PARA HABILITARLO
 * ---------------------------------
 * 1. Migracion aprobada que cree las tablas de proyecto de resolucion y su
 *    historial de versiones.
 * 2. Politica de concurrencia. El DDL vigente ya ofrece un precedente en
 *    sigd_doc.formulario_version, que conviene replicar en lugar de inventar:
 *
 *      CONSTRAINT uq_formulario_version UNIQUE (id_tipo_documento, version)
 *      CONSTRAINT ck_formulario_version_mayor_cero CHECK (version > 0)
 *
 *    Con esa restriccion, el enfoque idiomatico NO es SELECT ... FOR UPDATE
 *    sobre el padre, sino calcular el consecutivo como
 *    COALESCE(MAX(version), 0) + 1 e INSERTAR, aprovechando que la restriccion
 *    UNIQUE serializa a los escritores concurrentes. Si dos transacciones
 *    calcularan el mismo valor, una fallaria con SQLSTATE 23505, que debe
 *    traducirse a un reintento o a un 409, nunca a un sobrescritura silenciosa.
 *
 *    Conviene confirmar si el padre admite bloqueo de fila; si la migracion
 *    usa generacion por secuencia o columna generated, el MAX() manual es
 *    innecesario.
 * 3. Enumeracion de estados que admiten edicion, si el dominio la exige.
 * 4. Definicion de las columnas de autoria y visado.
 *
 * Lo que SI es verificable sin el esquema, y por eso se conserva aqui, es el
 * calculo del digest del contenido: es puro y no depende de la persistencia.
 */

/** Codigo estable para que el llamador pueda distinguir este bloqueo. */
export const ESQUEMA_PROYECTO_RESOLUCION_AUSENTE = 'ESQUEMA_PROYECTO_RESOLUCION_AUSENTE';

/** Nombres de las entidades que deben existir en el esquema para habilitar el servicio. */
export const ENTIDADES_REQUERIDAS = [
  'sigd_doc.proyecto_resolucion',
  'sigd_doc.proyecto_resolucion_version',
] as const;

export interface ContenidoVersionado {
  contenido: string;
}

/** Resultado del calculo del digest. No implica persistencia. */
export interface HashContenidoResult {
  hash_contenido: string;
  bytes_processed: number;
}

function bloqueoPorEsquemaAusente(): never {
  throw new AppError({
    status: 501,
    code: ESQUEMA_PROYECTO_RESOLUCION_AUSENTE,
    message:
      'DC-07 no puede ejecutarse: el esquema no define las tablas de proyecto de resolucion. ' +
      'Se requiere una migracion aprobada antes de habilitar el versionado.',
    detail:
      'Entidades ausentes en el DDL institucional vigente: ' +
      ENTIDADES_REQUERIDAS.join(', ') +
      '. No se ejecuta ningun SQL contra objetos inexistentes.',
  });
}

export class EdicionResolucionesService {
  /**
   * Calcula el SHA-256 del contenido a versionar.
   *
   * Util porque es aritmetica pura: no toca la base de datos y no depende del
   * esquema ausente. Es exactamente el digest que quedara persistido en
   * hash_contenido cuando el servicio se habilite.
   */
  calcularHashContenido(contenido: string): HashContenidoResult {
    return {
      hash_contenido: createHash('sha256').update(contenido, 'utf8').digest('hex'),
      bytes_processed: Buffer.byteLength(contenido, 'utf8'),
    };
  }

  /** Bloqueado: requiere las tablas de versionado. Ver cabecera del modulo. */
  crearVersion(_contenido: ContenidoVersionado): never {
    return bloqueoPorEsquemaAusente();
  }

  /** Bloqueado: requiere las tablas de versionado. Ver cabecera del modulo. */
  obtenerVersiones(): never {
    return bloqueoPorEsquemaAusente();
  }

  /** Bloqueado: requiere las tablas de versionado. Ver cabecera del modulo. */
  obtenerVersion(): never {
    return bloqueoPorEsquemaAusente();
  }

  /** Bloqueado: requiere las tablas de versionado. Ver cabecera del modulo. */
  visarVersion(): never {
    return bloqueoPorEsquemaAusente();
  }
}