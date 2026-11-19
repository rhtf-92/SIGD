import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { esperarConJitter, retardoReintento } from '../utils/backoff.util.js';

export interface RegistroMigracion {
  id: number;
  nombre_script: string;
  checksum_sha256: string;
  ejecutado_en: Date;
}

export interface OpcionesMigracion {
  timeoutLockMs?: number;
  soloArchivo?: string;
  baseEsperada?: string;
  permitirBaseCualquieraEnTest?: boolean;
}

/**
 * Identificador del Advisory Lock de sesión para el pipeline DDL.
 */
export const SIGD_MIGRATION_ADVISORY_LOCK_ID = 987654321;

/**
 * Base de datos oficial y exclusiva del prototipo institucional B_JACOBO.
 * Queda terminantemente prohibida la ejecución sobre sigd_prueba u otras bases.
 */
export const BASE_DATOS_OFICIAL_B_JACOBO = 'sigd_jacobo_demo';

/**
 * Bases de datos de prueba expresamente autorizadas para ejecución aislada.
 */
export const BASES_TEST_AUTORIZADAS: readonly string[] = ['sigd_isolated_cert_m2', 'sigd_prueba'];

/**
 * Migraciones históricas válidas cuyos archivos residen en subdirectorios archivados.
 */
export const MIGRACIONES_HISTORICAS_ARCHIVADAS: Readonly<Record<string, string>> = {
  '13_sigd_tes_orden_publica.sql': 'pendientes/13_sigd_tes_orden_publica.sql',
};

/**
 * Normaliza determinísticamente el contenido SQL eliminando BOM UTF-8 y uniformando retornos de carro (CRLF y CR) a LF.
 */
export function normalizarContenidoSql(contenido: string): string {
  return contenido.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export interface TokenSql {
  texto: string;
  tipo: 'PALABRA' | 'PUNTUACION' | 'ID_ENTRECOMILLADO';
}

/**
 * Tokenizador estructural para SQL de PostgreSQL.
 * Extrae tokens de nivel superior ignorando comentarios (de línea y de bloque anidados),
 * literales de cadena (estándar y secuencias de escape E'...'),
 * bloques entrecomillados con dólar ($$ o $tag$) y preserva identificadores entrecomillados ("...").
 */
export function tokenizarSqlNivelSuperior(sql: string): TokenSql[] {
  const tokens: TokenSql[] = [];
  const len = sql.length;
  let i = 0;

  while (i < len) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    // 1. Espacios en blanco
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // 2. Comentario de línea: -- ...
    if (ch === '-' && next === '-') {
      i += 2;
      while (i < len && sql[i] !== '\n') {
        i++;
      }
      continue;
    }

    // 3. Comentario de bloque anidado: /* ... /* ... */ ... */ (PostgreSQL soporta anidamiento)
    if (ch === '/' && next === '*') {
      i += 2;
      let depth = 1;
      while (i < len && depth > 0) {
        if (sql[i] === '/' && i + 1 < len && sql[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      continue;
    }

    // 4. Bloques entrecomillados con dólar: $$ ... $$ o $tag$ ... $tag$ (ej. funciones PL/pgSQL o bloques DO)
    if (ch === '$') {
      const match = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (match) {
        const tag = match[1];
        i += tag.length;
        const closingIndex = sql.indexOf(tag, i);
        if (closingIndex !== -1) {
          i = closingIndex + tag.length;
        } else {
          i = len;
        }
        continue;
      }
    }

    // 5. Cadenas de escape: E'...' o e'...'
    if ((ch === 'E' || ch === 'e' || ch === 'B' || ch === 'b' || ch === 'X' || ch === 'x') && next === "'") {
      i += 2;
      while (i < len) {
        if (sql[i] === '\\') {
          i += 2; // saltar carácter escapado
        } else if (sql[i] === "'") {
          if (i + 1 < len && sql[i + 1] === "'") {
            i += 2; // '' escapado
          } else {
            i++;
            break;
          }
        } else {
          i++;
        }
      }
      continue;
    }

    // 6. Cadenas normales: '...'
    if (ch === "'") {
      i++;
      while (i < len) {
        if (sql[i] === "'") {
          if (i + 1 < len && sql[i + 1] === "'") {
            i += 2; // '' escapado
          } else {
            i++;
            break;
          }
        } else {
          i++;
        }
      }
      continue;
    }

    // 7. Identificadores entrecomillados: "..." ("BEGIN", "COMMIT" son identificadores, no palabras clave)
    if (ch === '"') {
      i++;
      let ident = '';
      while (i < len) {
        if (sql[i] === '"') {
          if (i + 1 < len && sql[i + 1] === '"') {
            ident += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          ident += sql[i];
          i++;
        }
      }
      tokens.push({ texto: ident, tipo: 'ID_ENTRECOMILLADO' });
      continue;
    }

    // 8. Identificadores y palabras clave: [a-zA-Z_][a-zA-Z0-9_]*
    if (/[a-zA-Z_]/.test(ch)) {
      let palabra = '';
      while (i < len && /[a-zA-Z0-9_]/.test(sql[i])) {
        palabra += sql[i];
        i++;
      }
      tokens.push({ texto: palabra, tipo: 'PALABRA' });
      continue;
    }

    // 9. Otros caracteres (puntuación: ;, (, ), etc.)
    tokens.push({ texto: ch, tipo: 'PUNTUACION' });
    i++;
  }

  return tokens;
}

/**
 * Analiza sintácticamente el contenido SQL mediante un analizador de tokens léxicos
 * para detectar comandos transaccionales explícitos en el nivel superior de ejecución.
 *
 * Detecta:
 * - BEGIN [WORK | TRANSACTION]
 * - COMMIT [WORK | TRANSACTION] [AND [NO] CHAIN]
 * - END [WORK | TRANSACTION] [AND [NO] CHAIN] (excepto cuando pertenece a CASE ... END)
 * - START TRANSACTION
 * - ROLLBACK [WORK | TRANSACTION] [AND [NO] CHAIN] (excepto ROLLBACK TO [SAVEPOINT])
 * - PREPARE TRANSACTION
 * - COMMIT PREPARED
 * - ROLLBACK PREPARED
 *
 * Ignora SAVEPOINT, RELEASE SAVEPOINT, ROLLBACK TO SAVEPOINT y expresiones CASE ... END.
 */
export function detectarComandosTransaccionalesNivelSuperior(sql: string): string[] {
  const tokens = tokenizarSqlNivelSuperior(sql);
  const comandos: string[] = [];
  let caseDepth = 0;
  const numTokens = tokens.length;

  for (let i = 0; i < numTokens; i++) {
    const token = tokens[i];
    if (token.tipo !== 'PALABRA') {
      continue;
    }

    const upper = token.texto.toUpperCase();

    // Rastrear CASE ... END en expresiones DDL/DML para no emitir falso positivo en END
    if (upper === 'CASE') {
      caseDepth++;
      continue;
    }

    if (upper === 'END') {
      if (caseDepth > 0) {
        caseDepth--;
        continue;
      }
      // END a nivel superior actúa como COMMIT en PostgreSQL
      let cmd = 'END';
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      if (sig1 === 'WORK' || sig1 === 'TRANSACTION') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        const sig4 = i + 4 < numTokens ? tokens[i + 4].texto.toUpperCase() : '';
        if (sig2 === 'AND' && sig3 === 'NO' && sig4 === 'CHAIN') {
          cmd = `END ${sig1} AND NO CHAIN`;
          i += 4;
        } else if (sig2 === 'AND' && sig3 === 'CHAIN') {
          cmd = `END ${sig1} AND CHAIN`;
          i += 3;
        } else {
          cmd = `END ${sig1}`;
          i += 1;
        }
      } else if (sig1 === 'AND') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        if (sig2 === 'NO' && sig3 === 'CHAIN') {
          cmd = 'END AND NO CHAIN';
          i += 3;
        } else if (sig2 === 'CHAIN') {
          cmd = 'END AND CHAIN';
          i += 2;
        }
      }
      comandos.push(cmd);
      continue;
    }

    if (upper === 'BEGIN') {
      let cmd = 'BEGIN';
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      if (sig1 === 'WORK') {
        cmd = 'BEGIN WORK';
        i += 1;
      } else if (sig1 === 'TRANSACTION') {
        cmd = 'BEGIN TRANSACTION';
        i += 1;
      }
      comandos.push(cmd);
      continue;
    }

    if (upper === 'START') {
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      if (sig1 === 'TRANSACTION') {
        comandos.push('START TRANSACTION');
        i += 1;
      }
      continue;
    }

    if (upper === 'COMMIT') {
      let cmd = 'COMMIT';
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      if (sig1 === 'PREPARED') {
        cmd = 'COMMIT PREPARED';
        i += 1;
      } else if (sig1 === 'WORK' || sig1 === 'TRANSACTION') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        const sig4 = i + 4 < numTokens ? tokens[i + 4].texto.toUpperCase() : '';
        if (sig2 === 'AND' && sig3 === 'NO' && sig4 === 'CHAIN') {
          cmd = `COMMIT ${sig1} AND NO CHAIN`;
          i += 4;
        } else if (sig2 === 'AND' && sig3 === 'CHAIN') {
          cmd = `COMMIT ${sig1} AND CHAIN`;
          i += 3;
        } else {
          cmd = `COMMIT ${sig1}`;
          i += 1;
        }
      } else if (sig1 === 'AND') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        if (sig2 === 'NO' && sig3 === 'CHAIN') {
          cmd = 'COMMIT AND NO CHAIN';
          i += 3;
        } else if (sig2 === 'CHAIN') {
          cmd = 'COMMIT AND CHAIN';
          i += 2;
        }
      }
      comandos.push(cmd);
      continue;
    }

    if (upper === 'ROLLBACK') {
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      // ROLLBACK TO [SAVEPOINT] ... no es una instrucción de control global de transacción
      if (sig1 === 'TO') {
        continue;
      }
      let cmd = 'ROLLBACK';
      if (sig1 === 'PREPARED') {
        cmd = 'ROLLBACK PREPARED';
        i += 1;
      } else if (sig1 === 'WORK' || sig1 === 'TRANSACTION') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        const sig4 = i + 4 < numTokens ? tokens[i + 4].texto.toUpperCase() : '';
        if (sig2 === 'AND' && sig3 === 'NO' && sig4 === 'CHAIN') {
          cmd = `ROLLBACK ${sig1} AND NO CHAIN`;
          i += 4;
        } else if (sig2 === 'AND' && sig3 === 'CHAIN') {
          cmd = `ROLLBACK ${sig1} AND CHAIN`;
          i += 3;
        } else {
          cmd = `ROLLBACK ${sig1}`;
          i += 1;
        }
      } else if (sig1 === 'AND') {
        const sig2 = i + 2 < numTokens ? tokens[i + 2].texto.toUpperCase() : '';
        const sig3 = i + 3 < numTokens ? tokens[i + 3].texto.toUpperCase() : '';
        if (sig2 === 'NO' && sig3 === 'CHAIN') {
          cmd = 'ROLLBACK AND NO CHAIN';
          i += 3;
        } else if (sig2 === 'CHAIN') {
          cmd = 'ROLLBACK AND CHAIN';
          i += 2;
        }
      }
      comandos.push(cmd);
      continue;
    }

    if (upper === 'PREPARE') {
      const sig1 = i + 1 < numTokens ? tokens[i + 1].texto.toUpperCase() : '';
      if (sig1 === 'TRANSACTION') {
        comandos.push('PREPARE TRANSACTION');
        i += 1;
      }
      continue;
    }
  }

  return comandos;
}

/**
 * Valida la estructura transaccional del archivo de migración.
 * Las migraciones de nueva generación (> 21) tienen estrictamente prohibido incluir comandos transaccionales
 * explícitos de nivel superior (BEGIN, COMMIT, START TRANSACTION), ya que la transacción es
 * gobernada exclusivamente de forma atómica y determinista por el runner institucional.
 *
 * Las migraciones históricas (<= 21) son permitidas para preservar la compatibilidad del repositorio.
 */
export function validarEstructuraTransaccional(sql: string, nombreArchivo: string): void {
  const matchNumero = nombreArchivo.match(/^(\d+)_/);
  const numero = matchNumero ? parseInt(matchNumero[1], 10) : 0;

  if (numero > 21) {
    const comandosDetectados = detectarComandosTransaccionalesNivelSuperior(sql);
    if (comandosDetectados.length > 0) {
      throw new Error(
        `Violación de Arquitectura DDL en ${nombreArchivo}: Las migraciones superiores a 21 no deben contener ` +
        `comandos transaccionales explícitos de nivel superior (${comandosDetectados.join(', ')}). ` +
        `El control transaccional es gobernado exclusivamente de forma atómica por el runner institucional.`
      );
    }
  }
}

/**
 * Calcula el hash SHA-256 canónico y determinista del contenido SQL normalizado.
 */
export function calcularChecksumSha256(contenido: string | Buffer): string {
  const texto = typeof contenido === 'string' ? contenido : contenido.toString('utf-8');
  const normalizado = normalizarContenidoSql(texto);
  return crypto.createHash('sha256').update(normalizado, 'utf-8').digest('hex');
}

function resolverLockId(): number {
  const crudo = process.env.MIGRATE_ADVISORY_LOCK_ID;
  if (!crudo) return SIGD_MIGRATION_ADVISORY_LOCK_ID;
  const valor = Number(crudo);
  if (!Number.isInteger(valor)) {
    throw new Error(`MIGRATE_ADVISORY_LOCK_ID inválido: "${crudo}" no es un entero.`);
  }
  return valor;
}

export function directorioMigraciones(): string {
  if (process.env.MIGRATIONS_DIR) {
    return path.resolve(process.env.MIGRATIONS_DIR);
  }
  const moduloActual = path.dirname(fileURLToPath(import.meta.url));
  const rutaDev = path.resolve(moduloActual, '../../migraciones');
  if (fs.existsSync(rutaDev)) {
    return rutaDev;
  }
  const rutaDist = path.resolve(moduloActual, '../../../migraciones');
  if (fs.existsSync(rutaDist)) {
    return rutaDist;
  }
  return rutaDev;
}

async function esperarCandado(cliente: PoolClient, lockId: number, timeoutMs: number): Promise<void> {
  const limite = Date.now() + timeoutMs;
  let intentos = 0;

  for (;;) {
    const resultado = await cliente.query<{ adquirido: boolean }>('SELECT pg_try_advisory_lock($1) AS adquirido', [lockId]);
    if (resultado.rows[0]?.adquirido) {
      console.log(`[MIGRATE] Advisory Lock ${lockId} adquirido.`);
      return;
    }
    if (Date.now() > limite) {
      throw new Error(
        `No se pudo adquirir el Advisory Lock ${lockId} en ${timeoutMs} ms. Otra réplica mantiene el pipeline DDL en ejecución.`,
      );
    }
    intentos += 1;
    const espera = retardoReintento({ baseMs: 250, techoMs: 3000, intento: intentos });
    console.log(`[MIGRATE] Advisory Lock ${lockId} ocupado; esperando ${espera} ms (intento ${intentos}).`);
    await esperarConJitter(espera);
  }
}

/**
 * Valida la consistencia de una migración en disco contra el registro en base de datos.
 * Exige coincidencia estricta con el hash canónico determinista SHA-256 (sin fallback ni tolerancia a alteraciones).
 */
function verificarCoincidenciaChecksum(dbChecksum: string, checksumCanónico: string): boolean {
  const dbHash = dbChecksum.trim();
  return dbHash === checksumCanónico;
}

export async function ejecutarMigraciones(
  pool: Pool,
  opciones: OpcionesMigracion = {},
): Promise<string[]> {
  const lockId = resolverLockId();
  const timeoutLockMs = opciones.timeoutLockMs ?? 60_000;
  const cliente = await pool.connect();
  const aplicadas: string[] = [];

  try {
    await esperarCandado(cliente, lockId, timeoutLockMs);

    if (opciones.soloArchivo) {
      if (path.basename(opciones.soloArchivo) !== opciones.soloArchivo || !opciones.soloArchivo.endsWith('.sql')) {
        throw new Error('La selección de migración debe ser un nombre de archivo .sql sin rutas.');
      }
      if (!opciones.baseEsperada) {
        throw new Error('La ejecución de una migración individual requiere una base de datos esperada explícita.');
      }
    }

    const actual = (await cliente.query<{ db: string }>('SELECT current_database() db')).rows[0]?.db;

    if (!opciones.permitirBaseCualquieraEnTest) {
      if (actual !== BASE_DATOS_OFICIAL_B_JACOBO) {
        throw new Error(
          `Acceso no autorizado: La base de datos actual es "${actual}". ` +
          `El runner institucional B_JACOBO restringe estrictamente cualquier ejecución a "${BASE_DATOS_OFICIAL_B_JACOBO}". ` +
          `Operación DDL cancelada inmediatamente antes de iniciar transacciones.`
        );
      }

      if (opciones.baseEsperada && opciones.baseEsperada !== BASE_DATOS_OFICIAL_B_JACOBO) {
        throw new Error(
          `Base de datos de destino incorrecta: se especificó "${opciones.baseEsperada}", pero B_JACOBO opera exclusivamente sobre "${BASE_DATOS_OFICIAL_B_JACOBO}". No se ejecutó ninguna migración.`
        );
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Violación de Seguridad DDL: El modo de prueba DDL está prohibido terminantemente en entorno de producción (NODE_ENV=production).'
        );
      }

      if (actual === BASE_DATOS_OFICIAL_B_JACOBO) {
        throw new Error(
          `Violación de Integridad DDL: El modo de prueba no puede ejecutarse contra la base oficial "${BASE_DATOS_OFICIAL_B_JACOBO}". Para operar sobre la base oficial debe utilizarse el modo de ejecución institucional estándar.`
        );
      }

      if (!BASES_TEST_AUTORIZADAS.includes(actual)) {
        throw new Error(
          `Base de datos de prueba no autorizada: "${actual}". El modo de prueba únicamente admite bases aisladas explícitamente autorizadas: ${BASES_TEST_AUTORIZADAS.join(', ')}.`
        );
      }

      if (opciones.baseEsperada && actual !== opciones.baseEsperada) {
        throw new Error(
          `Base de datos de destino incorrecta: se especificó "${opciones.baseEsperada}", pero la base actual es "${actual}". No se ejecutó ninguna migración.`
        );
      }
    }

    await cliente.query(`
      CREATE TABLE IF NOT EXISTS public.sigd_migraciones (
        id SERIAL PRIMARY KEY,
        nombre_script VARCHAR(255) NOT NULL UNIQUE,
        checksum_sha256 CHAR(64) NOT NULL,
        ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const directorio = directorioMigraciones();
    if (!fs.existsSync(directorio)) {
      throw new Error(`No existe el directorio de migraciones: ${directorio}`);
    }

    const disponibles = fs
      .readdirSync(directorio)
      .filter((archivo) => archivo.endsWith('.sql'))
      .sort();

    // Detección de duplicados en secuencia numérica
    const secuencias = new Map<string, string>();
    for (const archivo of disponibles) {
      const match = archivo.match(/^(\d+)_/);
      if (match) {
        const prefijo = match[1];
        if (secuencias.has(prefijo)) {
          throw new Error(
            `Conflicto de secuencia en migraciones: ${archivo} comparte el número ${prefijo} con ${secuencias.get(prefijo)}.`,
          );
        }
        secuencias.set(prefijo, archivo);
      }
    }

    if (opciones.soloArchivo && !disponibles.includes(opciones.soloArchivo)) {
      throw new Error(`No existe la migración seleccionada: ${opciones.soloArchivo}`);
    }

    // Auditoría de archivos registrados previamente en la base de datos
    const todasRegistradas = (
      await cliente.query<RegistroMigracion>(
        'SELECT id, nombre_script, checksum_sha256, ejecutado_en FROM public.sigd_migraciones ORDER BY id',
      )
    ).rows;

    for (const reg of todasRegistradas) {
      const existeEnRaiz = fs.existsSync(path.join(directorio, reg.nombre_script));
      const rutaArchivada = MIGRACIONES_HISTORICAS_ARCHIVADAS[reg.nombre_script];
      const existeArchivada = rutaArchivada && fs.existsSync(path.join(directorio, rutaArchivada));

      if (!existeEnRaiz && !existeArchivada) {
        throw new Error(
          `Error de Integridad DDL: La migración "${reg.nombre_script}" está registrada en la base de datos pero no existe en disco.`,
        );
      }
    }

    const archivos = opciones.soloArchivo ? [opciones.soloArchivo] : disponibles;

    for (const archivo of archivos) {
      const rutaArchivo = path.join(directorio, archivo);
      const contenidoRaw = fs.readFileSync(rutaArchivo);
      const contenidoTexto = contenidoRaw.toString('utf-8');
      const checksumCanónico = calcularChecksumSha256(contenidoRaw);

      const existentes = await cliente.query<RegistroMigracion>(
        'SELECT checksum_sha256 FROM public.sigd_migraciones WHERE nombre_script = $1',
        [archivo],
      );

      if (existentes.rowCount && existentes.rowCount > 0) {
        const registrado = existentes.rows[0].checksum_sha256;
        if (!verificarCoincidenciaChecksum(registrado, checksumCanónico)) {
          throw new Error(
            `Error de Integridad DDL: ${archivo} fue alterado tras su ejecución. ` +
              `Checksum registrado: ${registrado.trim()}, actual: ${checksumCanónico}`,
          );
        }
        continue;
      }

      // Regla innegociable de arquitectura: Las nuevas migraciones no deben intentar insertarse a sí mismas
      const numeroMigracion = parseInt(archivo.split('_')[0], 10);
      if (numeroMigracion > 21 && /INSERT\s+INTO\s+public\.sigd_migraciones/i.test(contenidoTexto)) {
        throw new Error(
          `Violación de Arquitectura DDL en ${archivo}: El registro de migraciones es responsabilidad exclusiva del runner institucional. No incluya INSERT manual en public.sigd_migraciones.`,
        );
      }

      // Validación estructural transaccional: rechazar BEGIN/COMMIT de nivel superior en migraciones > 21
      validarEstructuraTransaccional(contenidoTexto, archivo);

      // Ejecución atómica y transaccional por migración
      await cliente.query('BEGIN');
      try {
        console.log(`[MIGRATE] Aplicando migración: ${archivo}`);
        const sqlEjecucion = normalizarContenidoSql(contenidoTexto);
        await cliente.query(sqlEjecucion);
        await cliente.query(
          `INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256, ejecutado_en)
           VALUES ($1, $2, now())
           ON CONFLICT (nombre_script) DO UPDATE SET
             checksum_sha256 = EXCLUDED.checksum_sha256,
             ejecutado_en = now()`,
          [archivo, checksumCanónico],
        );
        await cliente.query('COMMIT');
        aplicadas.push(archivo);
      } catch (errorMigracion) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        console.error(`[MIGRATE] Falla al aplicar la migración ${archivo}:`, errorMigracion);
        throw errorMigracion;
      }
    }

    console.log(`[MIGRATE] Pipeline DDL completado. Migraciones aplicadas en esta ejecución: ${aplicadas.length}`);
    return aplicadas;
  } catch (error) {
    console.error('[MIGRATE] Falla crítica durante la ejecución de migraciones DDL:', error);
    throw error;
  } finally {
    await cliente
      .query('SELECT pg_advisory_unlock($1)', [lockId])
      .then(() => console.log(`[MIGRATE] Advisory Lock ${lockId} liberado.`))
      .catch((error) => console.error(`[MIGRATE] No se pudo liberar el Advisory Lock ${lockId}:`, error));
    cliente.release();
  }
}

export async function listarMigracionesAplicadas(pool: Pool): Promise<RegistroMigracion[]> {
  const resultado = await pool.query<RegistroMigracion>(
    'SELECT id, nombre_script, checksum_sha256, ejecutado_en FROM public.sigd_migraciones ORDER BY nombre_script',
  );
  return resultado.rows;
}
