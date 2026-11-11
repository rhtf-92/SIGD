import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../shared/domain/errors/index.js';
import { verificarFacultadFirma } from '../../core/auth/auth.guard.js';
import {
  obtenerDniePreparationStore,
  type DniePreparationStore,
  TTL_PREPARACION_DNIE_SEGUNDOS,
} from './dniePreparation.store.js';

export interface SolicitudPrepararFirmaDnie {
  expedienteId: string;
  documentoId?: string;
  tipoActo?: string;
}

export interface ContextoPreparacionFirma {
  preparacionId: string;
  nonce: string;
  documentoId: string;
  documentVersion: number;
  hashSha256: string;
  expedienteId: string;
  cut: string;
  documentoNombre: string;
  personaId: string;
  personaNumeroDocumento: string;
  personaNombreCompleto: string;
  usuarioId: string;
  challenge: string;
  algoritmoRecomendado: string;
  fechaCreacion: string;
  fechaExpiracion: string;
  consumido: boolean;
}

export interface SolicitudRegistrarFirmaDnie {
  preparacionId: string;
  expedienteId: string;
  documentoId: string;
  hashSha256: string;
  firmaB64: string;
  certificadoPem: string;
  algoritmo?: string;
  proveedor?: string;
}

export interface RespuestaRegistrarFirmaDnie {
  ok: boolean;
  documentoId: string;
  cvd: string;
  estado: 'FIRMADO_DIGITALMENTE';
  idempotente?: boolean;
  verificacion: {
    firmaValida: boolean;
    certificadoVigente: boolean;
    cadenaConfiable: boolean;
    revocacion: 'REVOCACION_NO_VERIFICABLE' | 'VERIFICADA';
    titular: {
      dni: string;
      nombre: string;
    };
    identidad: ExtractedCertificateIdentity;
  };
}

export interface ExtractedCertificateIdentity {
  numeroDocumento: string;
  nombreCompleto: string;
  fuente: 'TEST_FIXTURE_PROFILE' | 'RENIEC_DNIE_PROFILE' | 'UNCONFIGURED';
  campoUtilizado: string;
  nivelConfianza: 'TEST_ONLY' | 'CERTIFICADO_OFICIAL_RENIEC' | 'NO_CONFIABLE';
}

export interface DatosCertificadoExtraido {
  subject: string;
  issuer: string;
  serialNumber: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
  dni: string;
  nombreCompleto: string;
  algoritmoClave: string;
  esVigente: boolean;
  identidad: ExtractedCertificateIdentity;
  certObject: crypto.X509Certificate;
}

/**
 * =============================================================================
 * 1. EXTRACTOR DE IDENTIDAD DEL CERTIFICADO (CertificateIdentityExtractor)
 * =============================================================================
 * Separa explícitamente:
 * - Extractor de Fixtures (TEST_ONLY): extrae DNI de serialNumber/CN para tests.
 * - Extractor Real RENIEC DNIe: mientras no se inspeccione un DNIe físico real,
 *   en producción falla cerrado con IDENTIDAD_CERTIFICADO_NO_CONFIGURADA.
 */
export class CertificateIdentityExtractor {
  static extraer(cert: crypto.X509Certificate, entorno = process.env.NODE_ENV): ExtractedCertificateIdentity {
    const isProduction = entorno === 'production' || process.env.APP_ENV === 'production';
    const subject = cert.subject;

    // En producción: salvaguarda fail-closed si no hay perfil de hardware DNIe certificado
    if (isProduction) {
      throw new AppError({
        status: 422,
        code: 'IDENTIDAD_CERTIFICADO_NO_CONFIGURADA',
        message: 'El perfil oficial de extracción de identidad DNIe RENIEC no está configurado (hardware físico pendiente de certificación).',
      });
    }

    // Entorno de prueba / desarrollo (TEST_ONLY)
    let dni = '';
    let nombreCompleto = '';
    let campoUtilizado = '';

    // Extraer CN
    const matchCn = subject.match(/(?:^|\n|\/)CN=([^/\n,]+)/i);
    if (matchCn) {
      nombreCompleto = matchCn[1].trim();
    }

    // Extraer serialNumber (OID 2.5.4.5)
    const matchSerial = subject.match(/(?:^|\n|\/)(?:serialNumber|OID\.2\.5\.4\.5)=([^/\n,]+)/i);
    if (matchSerial) {
      const clean = matchSerial[1].replace(/^DNI:?/i, '').trim();
      if (/^\d{8}$/.test(clean)) {
        dni = clean;
        campoUtilizado = 'serialNumber (OID 2.5.4.5)';
      }
    }

    // Búsqueda auxiliar en CN
    if (!dni && nombreCompleto) {
      const matchDniInCn = nombreCompleto.match(/\b(\d{8})\b/);
      if (matchDniInCn) {
        dni = matchDniInCn[1];
        campoUtilizado = 'CN (Common Name regex)';
      }
    }

    if (!dni) {
      throw new AppError({
        status: 422,
        code: 'DNI_NO_ENCONTRADO_EN_CERTIFICADO',
        message: 'No se pudo extraer un DNI válido del certificado digital proporcionado.',
      });
    }

    return {
      numeroDocumento: dni,
      nombreCompleto,
      fuente: 'TEST_FIXTURE_PROFILE',
      campoUtilizado,
      nivelConfianza: 'TEST_ONLY',
    };
  }
}

/**
 * =============================================================================
 * 2. ALMACÉN Y VALIDACIÓN DE CONFIANZA X.509 (DnieTrustStore)
 * =============================================================================
 * Impide que un certificado autofirmado o desconocido sea aceptado como válido.
 * Requiere que la cadena provenga de una entidad de certificación de confianza.
 */
export class DnieTrustStore {
  private static roots: crypto.X509Certificate[] = [];

  static registrarRootCA(caPem: string): void {
    try {
      const ca = new crypto.X509Certificate(caPem);
      this.roots.push(ca);
    } catch (err: any) {
      throw new Error(`Error al registrar Root CA en Trust Store: ${err.message}`);
    }
  }

  static limpiarRoots(): void {
    this.roots = [];
  }

  static validarCadena(cert: crypto.X509Certificate, entorno = process.env.NODE_ENV): { esConfiable: boolean; motivo?: string } {
    // 1. Detectar certificados autofirmados (subject === issuer)
    if (cert.subject === cert.issuer) {
      return {
        esConfiable: false,
        motivo: 'CERTIFICADO_AUTOFIRMADO_NO_CONFIABLE: El certificado es autofirmado y no pertenece a la infraestructura de confianza institucional.',
      };
    }

    // 2. Si no hay CAs de confianza registradas (por ejemplo producción sin IOFE instalada)
    if (this.roots.length === 0) {
      return {
        esConfiable: false,
        motivo: 'CADENA_NO_VERIFICABLE: No existen raíces de confianza registradas para validar la cadena del firmante.',
      };
    }

    // 3. Validar si alguna Root CA emitió y firmó el certificado
    for (const ca of this.roots) {
      try {
        if (cert.checkIssued(ca) && cert.verify(ca.publicKey)) {
          return { esConfiable: true };
        }
      } catch {
        // Continuar evaluando raíces
      }
    }

    return {
      esConfiable: false,
      motivo: 'CERTIFICADO_NO_CONFIABLE: El certificado no fue emitido por ninguna entidad de certificación de confianza.',
    };
  }
}

/**
 * =============================================================================
 * 3. POLÍTICA DE ALGORITMOS CRIPTOGRÁFICOS
 * =============================================================================
 * Prohíbe explícitamente algoritmos vulnerables (MD5, SHA-1).
 * Valida compatibilidad entre tipo de clave y algoritmo declarado.
 */
export function validarAlgoritmoYVerificarFirma(
  hashSha256Hex: string,
  firmaB64: string,
  cert: crypto.X509Certificate,
  algoritmoDeclarado = 'SHA256withRSA',
): boolean {
  const norm = algoritmoDeclarado.toUpperCase().replace(/[-_]/g, '');

  // Prohibición estricta de algoritmos débiles
  if (norm.includes('MD5') || norm.includes('SHA1')) {
    throw new AppError({
      status: 422,
      code: 'ALGORITMO_FIRMA_DEBIL_PROHIBIDO',
      message: `El algoritmo ${algoritmoDeclarado} está estrictamente prohibido por vulnerabilidades de seguridad criptográfica.`,
    });
  }

  let nodeVerifyAlgo = 'RSA-SHA256';
  const keyType = cert.publicKey.asymmetricKeyType;

  if (keyType === 'rsa') {
    if (norm === 'SHA256WITHRSA' || norm === 'RSASHA256') nodeVerifyAlgo = 'RSA-SHA256';
    else if (norm === 'SHA384WITHRSA' || norm === 'RSASHA384') nodeVerifyAlgo = 'RSA-SHA384';
    else if (norm === 'SHA512WITHRSA' || norm === 'RSASHA512') nodeVerifyAlgo = 'RSA-SHA512';
    else {
      throw new AppError({
        status: 422,
        code: 'ALGORITMO_FIRMA_NO_PERMITIDO',
        message: `El algoritmo ${algoritmoDeclarado} no está permitido para claves RSA.`,
      });
    }
  } else if (keyType === 'ec') {
    if (norm === 'ECDSAWITHSHA256' || norm === 'ECDSASHA256') nodeVerifyAlgo = 'SHA256';
    else {
      throw new AppError({
        status: 422,
        code: 'ALGORITMO_FIRMA_NO_PERMITIDO',
        message: `El algoritmo ${algoritmoDeclarado} no está permitido para claves EC.`,
      });
    }
  } else {
    throw new AppError({
      status: 422,
      code: 'TIPO_CLAVE_NO_SOPORTADO',
      message: `El tipo de clave pública ${keyType ?? 'desconocida'} no es compatible con la política de firma.`,
    });
  }

  try {
    const verify = crypto.createVerify(nodeVerifyAlgo);
    verify.update(Buffer.from(hashSha256Hex, 'hex'));
    return verify.verify(cert.publicKey, Buffer.from(firmaB64, 'base64'));
  } catch {
    return false;
  }
}

/**
 * Función pública de verificación matemática (conservada para tests unitarios).
 */
export function verificarFirmaMatematica(
  hashSha256Hex: string,
  firmaB64: string,
  certificadoPem: string,
  algoritmo = 'SHA256withRSA',
): boolean {
  try {
    const cert = new crypto.X509Certificate(certificadoPem);
    return validarAlgoritmoYVerificarFirma(hashSha256Hex, firmaB64, cert, algoritmo);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return false;
  }
}

/**
 * Parsea y extrae datos del certificado X.509 en formato PEM.
 */
export function extraerDatosCertificadoX509(pem: string): DatosCertificadoExtraido {
  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(pem);
  } catch (error) {
    throw new AppError({
      status: 422,
      code: 'CERTIFICADO_INVALIDO',
      message: 'El certificado proporcionado no es un certificado X.509 válido en formato PEM.',
      detail: (error as Error).message,
    });
  }

  const subject = cert.subject;
  const issuer = cert.issuer;
  const serialNumber = cert.serialNumber;
  const validFrom = cert.validFrom;
  const validTo = cert.validTo;

  const fechaDesde = new Date(validFrom);
  const fechaHasta = new Date(validTo);
  const ahora = new Date();
  const esVigente = ahora >= fechaDesde && ahora <= fechaHasta;

  const thumbprint = cert.fingerprint256.replace(/:/g, '').toLowerCase();

  const identidad = CertificateIdentityExtractor.extraer(cert);
  const algoritmoClave = cert.publicKey.asymmetricKeyType ?? 'unknown';

  return {
    subject,
    issuer,
    serialNumber,
    thumbprint,
    validFrom,
    validTo,
    dni: identidad.numeroDocumento,
    nombreCompleto: identidad.nombreCompleto,
    algoritmoClave,
    esVigente,
    identidad,
    certObject: cert,
  };
}

/**
 * Prepara el contexto y hash canónico de un documento a ser firmado con DNIe.
 * Persiste en almacén compartido (Redis / InMemory) con TTL de 5 minutos.
 */
export async function prepararFirmaDnie(
  pool: Pool,
  solicitud: SolicitudPrepararFirmaDnie,
  usuarioId: string,
  contextoActor?: string,
  rolesActor: string[] = [],
  store: DniePreparationStore = obtenerDniePreparationStore(),
): Promise<ContextoPreparacionFirma> {
  // 1. Validar contexto institucional
  if (contextoActor !== 'INSTITUCIONAL') {
    throw new AppError({
      status: 403,
      code: 'CONTEXTO_NO_INSTITUCIONAL',
      message: 'La firma institucional de resoluciones requiere operar bajo contexto INSTITUCIONAL.',
      detail: 'Cambie su contexto de trabajo a INSTITUCIONAL antes de acceder a la firma digital.',
    });
  }

  // 2. Resolver persona asociada a la cuenta del usuario
  const resPersona = await pool.query<{
    id_persona: string;
    numero_documento: string;
    nombre_completo: string;
  }>(
    `SELECT p.id_persona, p.numero_documento,
            COALESCE(p.nombre_completo, p.nombres || ' ' || p.primer_apellido) AS nombre_completo
       FROM sigd_auth.cuenta_usuario cu
       JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
      WHERE cu.id_usuario = $1`,
    [usuarioId],
  );

  if (resPersona.rowCount === 0) {
    throw new AppError({
      status: 404,
      code: 'PERSONA_NO_ENCONTRADA',
      message: 'No se encontró la identidad de la persona asociada a la cuenta de usuario.',
    });
  }

  const persona = resPersona.rows[0];

  // 3. Verificar autoridad de firma institucional (Regla 5E.5, PM-5H-23 y FASE 5I Sec 31)
  // El rol técnico ADMINISTRADOR nunca confiere autoridad de firma por sí mismo.
  const rolesEfectivos = rolesActor.filter((r) => r !== 'ADMINISTRADOR');
  const facultad = await verificarFacultadFirma(pool, usuarioId, rolesEfectivos);
  if (!facultad.puedeFirmar) {
    throw new AppError({
      status: 403,
      code: 'SIN_AUTORIDAD_FIRMA',
      message: 'El usuario no posee facultades institucionales de firma o resolución.',
      detail: facultad.motivo ?? 'Se requiere perfil directivo (DIRECTOR o APROBADOR_DIRECCION con facultaFirma=true). El rol ADMINISTRADOR no confiere firma.',
    });
  }

  // 4. Validar estado y titularidad del expediente en sigd_tra.expediente
  const resExp = await pool.query<{
    expediente_id: string;
    codigo_expediente: string;
    estado: string;
    solicitante_id: string;
  }>(
    `SELECT expediente_id, codigo_expediente, estado, solicitante_id
       FROM sigd_tra.expediente
      WHERE expediente_id = $1::uuid`,
    [solicitud.expedienteId],
  );

  if (resExp.rowCount === 0) {
    throw new AppError({
      status: 404,
      code: 'EXPEDIENTE_NO_ENCONTRADO',
      message: `No se encontró el expediente con ID ${solicitud.expedienteId}.`,
    });
  }

  const exp = resExp.rows[0];

  // 5. Blindaje de conflicto de interés y autoatención
  if (exp.solicitante_id === persona.id_persona) {
    throw new AppError({
      status: 403,
      code: 'CONFLICTO_INTERES',
      message: 'Conflicto de interés detectado: Un funcionario no puede auto-firmar ni auto-resolver su propio expediente personal.',
    });
  }

  // 6. Verificar que el expediente se encuentre estrictamente en EN_FIRMA
  if (exp.estado !== 'EN_FIRMA') {
    throw new AppError({
      status: 422,
      code: 'EXPEDIENTE_NO_EN_FIRMA',
      message: `El expediente en estado ${exp.estado} no está listo para firma. Se requiere estado EN_FIRMA.`,
    });
  }

  // 7. Localizar documento adjunto o resolución a firmar
  let documentoId = solicitud.documentoId;
  let documentoNombre = 'Resolucion_Directoral.pdf';
  let hashSha256 = '';

  if (documentoId) {
    const resDoc = await pool.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      sha256: string;
    }>(
      `SELECT documento_adjunto_id, nombre_archivo, sha256
         FROM sigd_doc.documento_adjunto
        WHERE documento_adjunto_id = $1::uuid
          AND (expediente_tra_id = $2::uuid OR expediente_id = $2::uuid)`,
      [documentoId, solicitud.expedienteId],
    );
    if (resDoc.rowCount && resDoc.rowCount > 0) {
      documentoNombre = resDoc.rows[0].nombre_archivo;
      hashSha256 = resDoc.rows[0].sha256;
    }
  }

  if (!hashSha256) {
    const resUltimo = await pool.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      sha256: string;
    }>(
      `SELECT documento_adjunto_id, nombre_archivo, sha256
         FROM sigd_doc.documento_adjunto
        WHERE (expediente_tra_id = $1::uuid OR expediente_id = $1::uuid)
        ORDER BY creado_en DESC
        LIMIT 1`,
      [solicitud.expedienteId],
    );

    if (resUltimo.rowCount && resUltimo.rowCount > 0) {
      documentoId = resUltimo.rows[0].documento_adjunto_id;
      documentoNombre = resUltimo.rows[0].nombre_archivo;
      hashSha256 = resUltimo.rows[0].sha256;
    } else {
      documentoId = crypto.randomUUID();
      const canonicalContent = `SIGD-ACTO-RESOLUTIVO|EXP:${exp.codigo_expediente}|FECHA:${new Date().toISOString().slice(0, 10)}`;
      hashSha256 = crypto.createHash('sha256').update(canonicalContent).digest('hex');

      await pool.query(
        `INSERT INTO sigd_doc.documento_adjunto
          (documento_adjunto_id, expediente_tra_id, tipo_documental_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por)
         VALUES
          ($1::uuid, $2::uuid, '00000000-0000-0000-0000-000000000001'::uuid, $3, 'sigd-expedientes', 'resoluciones/' || $1 || '.pdf', $4, 1024, 'application/pdf', $5::uuid)
         ON CONFLICT (documento_adjunto_id) DO NOTHING`,
        [documentoId, exp.expediente_id, documentoNombre, hashSha256, usuarioId],
      );
    }
  }

  const preparacionId = crypto.randomUUID();
  const nonce = crypto.randomBytes(32).toString('hex');
  const fechaCreacion = new Date().toISOString();
  const fechaExpiracion = new Date(Date.now() + TTL_PREPARACION_DNIE_SEGUNDOS * 1000).toISOString();

  const contexto: ContextoPreparacionFirma = {
    preparacionId,
    nonce,
    documentoId: documentoId!,
    documentVersion: 1,
    hashSha256,
    expedienteId: exp.expediente_id,
    cut: exp.codigo_expediente,
    documentoNombre,
    personaId: persona.id_persona,
    personaNumeroDocumento: persona.numero_documento,
    personaNombreCompleto: persona.nombre_completo,
    usuarioId,
    challenge: nonce,
    algoritmoRecomendado: 'SHA256withRSA',
    fechaCreacion,
    fechaExpiracion,
    consumido: false,
  };

  await store.guardar(contexto, TTL_PREPARACION_DNIE_SEGUNDOS);
  return contexto;
}

/**
 * Verifica criptográficamente la firma digital del DNIe y registra la evidencia WORM en sigd_doc.firma_digital_documento.
 */
export async function verificarYRegistrarFirmaDnie(
  pool: Pool,
  solicitud: SolicitudRegistrarFirmaDnie,
  usuarioId: string,
  contextoActor?: string,
  store: DniePreparationStore = obtenerDniePreparationStore(),
): Promise<RespuestaRegistrarFirmaDnie> {
  // 1. Prohibición estricta del proveedor MOCK en entorno de producción (PM-5I-16)
  const esProduccion = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  if (solicitud.proveedor === 'MOCK_TEST' && esProduccion) {
    throw new AppError({
      status: 403,
      code: 'PROVEEDOR_MOCK_PROHIBIDO_EN_PRODUCCION',
      message: 'El proveedor MockDniProvider está estrictamente prohibido en entornos de producción.',
    });
  }

  // 2. Obtener contexto de preparación desde almacén compartido (TOCTOU guard)
  const prep = await store.obtener(solicitud.preparacionId);
  if (!prep) {
    throw new AppError({
      status: 422,
      code: 'CONTEXTO_PREPARACION_EXPIRADO',
      message: 'El contexto de preparación de firma ha expirado o no existe. Vuelva a preparar la firma.',
    });
  }

  // 3. TOCTOU: Verificar que los datos del documento no hayan cambiado entre preparación y firma
  if (
    solicitud.documentoId !== prep.documentoId ||
    solicitud.expedienteId !== prep.expedienteId ||
    solicitud.hashSha256.toLowerCase() !== prep.hashSha256.toLowerCase()
  ) {
    throw new AppError({
      status: 422,
      code: 'DOCUMENTO_CAMBIO_DURANTE_FIRMA',
      message: 'El documento o su hash cambió después de la preparación de firma. Operación abortada.',
    });
  }

  // 4. Extraer y validar el certificado X.509 y su identidad
  const datosCert = extraerDatosCertificadoX509(solicitud.certificadoPem);

  // 5. Validar vigencia temporal del certificado (PM-5I-04)
  if (!datosCert.esVigente) {
    throw new AppError({
      status: 422,
      code: 'CERTIFICADO_EXPIRADO',
      message: 'El certificado digital ha expirado o aún no se encuentra vigente.',
      detail: `Válido desde: ${datosCert.validFrom}, hasta: ${datosCert.validTo}`,
    });
  }

  // 6. Validar coincidencia de identidad: DNI en certificado == DNI de la persona en sesión (PM-5I-06)
  if (datosCert.dni !== prep.personaNumeroDocumento) {
    throw new AppError({
      status: 403,
      code: 'IDENTIDAD_NO_COINCIDE',
      message: 'La identidad del certificado digital no coincide con la del usuario autenticado en la sesión.',
      detail: `Certificado DNI: ${datosCert.dni || 'DESCONOCIDO'} vs Sesión DNI: ${prep.personaNumeroDocumento}`,
    });
  }

  // 7. Validar cadena de confianza en DnieTrustStore (PM-5I-24 / PM-5I-25)
  const validacionCadena = DnieTrustStore.validarCadena(datosCert.certObject);
  if (!validacionCadena.esConfiable) {
    throw new AppError({
      status: 422,
      code: 'CERTIFICADO_NO_CONFIABLE',
      message: validacionCadena.motivo ?? 'El certificado digital no pertenece a la infraestructura de confianza autorizada.',
    });
  }

  // 8. Validar política de algoritmo y verificar firma matemática (PM-5I-11 / PM-5I-26)
  const esFirmaValida = validarAlgoritmoYVerificarFirma(
    solicitud.hashSha256,
    solicitud.firmaB64,
    datosCert.certObject,
    solicitud.algoritmo ?? 'SHA256withRSA',
  );

  if (!esFirmaValida) {
    throw new AppError({
      status: 422,
      code: 'FIRMA_CRIPTOGRAFICA_INVALIDA',
      message: 'La firma digital no es matemáticamente válida para el hash y certificado proporcionados.',
    });
  }

  // 9. Persistencia transaccional segura con advisory lock e idempotencia WORM
  const cliente: PoolClient = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // Advisory lock transaccional por expediente
    await cliente.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`firma_expediente_${prep.expedienteId}`],
    );

    // Verificar que el expediente siga en EN_FIRMA
    const resExp = await cliente.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE`,
      [prep.expedienteId],
    );
    if (resExp.rowCount === 0 || resExp.rows[0].estado !== 'EN_FIRMA') {
      throw new AppError({
        status: 422,
        code: 'EXPEDIENTE_NO_EN_FIRMA',
        message: `El expediente no se encuentra en estado EN_FIRMA (estado actual: ${resExp.rows[0]?.estado ?? 'NO_EXISTE'}).`,
      });
    }

    // 10. Idempotencia: Verificar si ya existe firma registrada para este documento (PM-5I-13, PM-5I-28, PM-5I-29)
    const resExistente = await cliente.query<{
      cvd: string;
      sha256_firmado: string;
      firma_b64: string | null;
    }>(
      `SELECT cvd, sha256_firmado, firma_b64
         FROM sigd_doc.firma_digital_documento
        WHERE documento_id = $1::uuid`,
      [prep.documentoId],
    );

    if (resExistente.rowCount && resExistente.rowCount > 0) {
      const reg = resExistente.rows[0];
      if (
        reg.sha256_firmado.toLowerCase() === solicitud.hashSha256.toLowerCase() &&
        reg.firma_b64 === solicitud.firmaB64
      ) {
        // Misma firma y misma operación: devolver registro existente sin mutar (WORM)
        await cliente.query('COMMIT');
        await store.consumir(solicitud.preparacionId);
        return {
          ok: true,
          documentoId: prep.documentoId,
          cvd: reg.cvd,
          estado: 'FIRMADO_DIGITALMENTE',
          idempotente: true,
          verificacion: {
            firmaValida: true,
            certificadoVigente: true,
            cadenaConfiable: true,
            revocacion: 'REVOCACION_NO_VERIFICABLE',
            titular: {
              dni: datosCert.dni,
              nombre: datosCert.nombreCompleto,
            },
            identidad: datosCert.identidad,
          },
        };
      }

      // Intento de mutar o sobreescribir firma existente con payload diferente -> Conflicto WORM
      throw new AppError({
        status: 409,
        code: 'EVIDENCIA_FIRMA_CONFLICTO',
        message: 'El documento ya cuenta con una firma digital registrada con evidencia diferente. Modificación prohibida (WORM).',
      });
    }

    // Si la preparación ya fue consumida previamente por otra operación
    if (prep.consumido) {
      throw new AppError({
        status: 409,
        code: 'PREPARACION_YA_CONSUMIDA',
        message: 'El contexto de preparación ya fue utilizado para una firma anterior.',
      });
    }

    // 11. Generar CVD formal
    const cvd = `CVD-${new Date().getFullYear()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    // 12. Insertar evidencia canónica WORM en sigd_doc.firma_digital_documento
    await cliente.query(
      `INSERT INTO sigd_doc.firma_digital_documento
        (
          documento_id,
          cvd,
          sha256_firmado,
          firmante,
          fecha_sello_tsa,
          s3_bucket,
          s3_key,
          estado,
          certificado_emisor,
          certificado_serial,
          certificado_thumbprint,
          certificado_valido_desde,
          certificado_valido_hasta,
          algoritmo_firma,
          persona_id,
          cuenta_usuario_id,
          proveedor_firma,
          firma_b64,
          certificado_publico_pem,
          documento_version
        )
       VALUES
        (
          $1::uuid,
          $2,
          $3,
          $4,
          now(),
          'sigd-expedientes',
          'firmados/' || $1 || '.pdf',
          'FIRMADO_DIGITALMENTE',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11::uuid,
          $12::uuid,
          $13,
          $14,
          $15,
          $16
        )`,
      [
        prep.documentoId,
        cvd,
        solicitud.hashSha256.toLowerCase(),
        datosCert.nombreCompleto,
        datosCert.issuer,
        datosCert.serialNumber,
        datosCert.thumbprint,
        datosCert.validFrom,
        datosCert.validTo,
        solicitud.algoritmo ?? 'SHA256withRSA',
        prep.personaId,
        usuarioId,
        solicitud.proveedor ?? 'DNIE_BIT4ID',
        solicitud.firmaB64,
        solicitud.certificadoPem,
        prep.documentVersion,
      ],
    );

    // 13. Actualizar resolución en sigd_doc.resolucion
    await cliente.query(
      `UPDATE sigd_doc.resolucion
          SET estado = 'FIRMADA',
              firmado_por = $1::uuid,
              firmado_en = now(),
              hash_pades = $2
        WHERE (expediente_tra_id = $3::uuid OR expediente_id = $3::uuid)
          AND estado = 'EN_FIRMA'`,
      [usuarioId, solicitud.hashSha256, prep.expedienteId],
    );

    await cliente.query('COMMIT');
    await store.consumir(solicitud.preparacionId);

    return {
      ok: true,
      documentoId: prep.documentoId,
      cvd,
      estado: 'FIRMADO_DIGITALMENTE',
      verificacion: {
        firmaValida: true,
        certificadoVigente: true,
        cadenaConfiable: true,
        revocacion: 'REVOCACION_NO_VERIFICABLE',
        titular: {
          dni: datosCert.dni,
          nombre: datosCert.nombreCompleto,
        },
        identidad: datosCert.identidad,
      },
    };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
