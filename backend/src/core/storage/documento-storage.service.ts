import crypto from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { PDFDocument } from 'pdf-lib';
import { obtenerConfiguracionS3, type ConfiguracionS3 } from '../../config/s3.config.js';
import { ValidationError, NotFoundError } from '../../shared/domain/errors/index.js';
import {
  A4InstitutionalDocBuilder,
  INSTITUCION_SISTEMA,
} from '../../domains/docucore/institucionalPdf.helper.js';

export interface DocumentoPresentadoCargo {
  nombre: string;
  folios?: number;
  tipo?: string;
}

export interface DatosCargoPdf {
  cut: string;
  fechaHora: Date;
  nombreSolicitante: string;
  documentoEnmascarado: string;
  asunto: string;
  folios: number;
  operadorMesa: string;
  canalRecepcion?: string | null;
  estadoInicial?: string | null;
  documentosPresentados?: readonly DocumentoPresentadoCargo[];
  observacionHorario?: string | null;
  hashRecepcion?: string | null;
  codigoTupa?: string | null;
  denominacionTupa?: string | null;
  costoTupa?: number | null;
  urlConsulta?: string | null;
}

export interface DatosResolucionPdf {
  cut: string;
  fechaHora: Date;
  administrado: string;
  resultadoResumen: string;
  observacionInterna?: string | null;
  operador: string;
  area: string;
  numeroResolucion?: string | null;
  tramiteNombre?: string | null;
}

export interface ObjetoS3Verificado {
  s3Bucket: string;
  s3Key: string;
  tamanoBytes: number;
  sha256: string;
  magicBytes: string;
  mimeType: string;
}

export class DocumentoStorageService {
  private readonly config: ConfiguracionS3;
  private readonly s3: S3Client;

  constructor(config?: ConfiguracionS3, s3Client?: S3Client) {
    this.config = config ?? obtenerConfiguracionS3();
    this.s3 =
      s3Client ??
      new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKey,
          secretAccessKey: this.config.secretKey,
        },
        forcePathStyle: this.config.forcePathStyle,
      });
  }

  public get canonicalBucket(): string {
    return this.config.bucket;
  }

  /**
   * Valida estrictamente que una clave S3 sea segura y canónica.
   * Rechaza path traversal (..), barras invertidas, esquemas URI y prefijos extraños.
   */
  public validarClaveS3(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new ValidationError({
        message: 'Clave S3 inválida: se requiere un texto no vacío.',
        invalidParams: [{ name: 's3Key', reason: 'Clave S3 no proporcionada o no es string' }],
      });
    }

    if (key.includes('..')) {
      throw new ValidationError({
        message: 'Clave S3 inválida: no se permite path traversal (..).',
        invalidParams: [{ name: 's3Key', reason: 'Path traversal no permitido' }],
      });
    }

    if (key.includes('\\')) {
      throw new ValidationError({
        message: 'Clave S3 inválida: no se permiten barras invertidas (\\).',
        invalidParams: [{ name: 's3Key', reason: 'Barras invertidas no permitidas' }],
      });
    }

    if (key.startsWith('/') || key.startsWith('./')) {
      throw new ValidationError({
        message: 'Clave S3 inválida: no se permite ruta absoluta o relativa inicial.',
        invalidParams: [{ name: 's3Key', reason: 'Ruta absoluta o relativa inicial no permitida' }],
      });
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(key)) {
      throw new ValidationError({
        message: 'Clave S3 inválida: no se permiten esquemas o protocolos URI.',
        invalidParams: [{ name: 's3Key', reason: 'Esquema URI no permitido' }],
      });
    }

    const prefijosPermitidos = ['expedientes/', 'tupa/', 'cargos/', 'resoluciones/', 'acuses/', 'presentados/'];
    const esPrefijoValido = prefijosPermitidos.some((p) => key.startsWith(p));
    if (!esPrefijoValido) {
      throw new ValidationError({
        message: 'Clave S3 inválida: prefijo no permitido.',
        invalidParams: [{ name: 's3Key', reason: `El prefijo debe ser uno de: ${prefijosPermitidos.join(', ')}` }],
      });
    }
  }

  /**
   * Generadores canónicos server-side de rutas de almacenamiento.
   */
  public generarKeyCargo(expedienteId: string): string {
    return `expedientes/${expedienteId}/cargos/${crypto.randomUUID()}.pdf`;
  }

  public generarKeyPresentado(expedienteId: string): string {
    return `expedientes/${expedienteId}/presentados/${crypto.randomUUID()}.pdf`;
  }

  public generarKeyResolucion(expedienteId: string): string {
    return `expedientes/${expedienteId}/resoluciones/${crypto.randomUUID()}.pdf`;
  }

  /**
   * Obtiene la cantidad física de páginas de un documento PDF.
   */
  public async obtenerCantidadPaginasPdf(buffer: Buffer): Promise<number> {
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const paginas = pdfDoc.getPageCount();
      return paginas > 0 ? paginas : 1;
    } catch {
      throw new ValidationError({
        code: 'PDF_INVALIDO',
        message: 'PDF_INVALIDO: No se pudo leer la estructura del documento PDF para derivar su número de páginas.',
        invalidParams: [{ name: 'buffer', reason: 'Estructura PDF corrupta o no legible' }],
      });
    }
  }

  /**
   * Determina de forma determinista si un error de S3 representa un 404 (NoSuchKey/NotFound).
   */
  public esErrorNotFound(err: any): boolean {
    if (!err) return false;
    if (err instanceof NotFoundError) return true;
    if (err.name === 'NoSuchKey' || err.name === 'NotFound') return true;
    if (err.$metadata?.httpStatusCode === 404) return true;
    return false;
  }

  /**
   * Resuelve una etiqueta legible del canal real de ingreso sin asumir ventanilla física.
   */
  private resolverCanalLegible(datos: DatosCargoPdf): string {
    const raw = (datos.canalRecepcion ?? '').trim().toUpperCase();
    if (raw === 'MESA_PARTES_DIGITAL' || raw === 'VIRTUAL') {
      return 'Mesa de Partes Digital (Virtual)';
    }
    if (raw === 'VENTANILLA_PRESENCIAL' || raw === 'PRESENCIAL') {
      return 'Ventanilla Presencial — Mesa de Partes';
    }
    if (raw) {
      return datos.canalRecepcion!.trim();
    }
    if ((datos.operadorMesa ?? '').toLowerCase().includes('digital')) {
      return 'Mesa de Partes Digital (Virtual)';
    }
    return 'Ventanilla Presencial — Mesa de Partes';
  }

  /**
   * Genera el PDF oficial en hoja A4 de Cargo de Recepción Documentaria
   * (Mesa de Partes Digital o Ventanilla Presencial).
   */
  public async generarCargoPdf(datos: DatosCargoPdf): Promise<Buffer> {
    const fechaFormateada = datos.fechaHora.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const canalLegible = this.resolverCanalLegible(datos);
    const builder = await A4InstitutionalDocBuilder.create({
      tituloDocumento: 'CARGO OFICIAL DE RECEPCIÓN DOCUMENTARIA',
      subtituloDocumento: canalLegible,
      unidadEmisora: 'MESA DE PARTES Y TRÁMITE DOCUMENTARIO',
      codigoReferencia: `CUT: ${datos.cut}`,
      fechaEmisionTexto: `Fecha y hora (Lima): ${fechaFormateada}`,
      metadataTitle: `Cargo de Recepción - ${datos.cut}`,
    });

    builder.drawSectionTitle('1. IDENTIFICACIÓN DEL EXPEDIENTE Y RECEPCIÓN');
    const filasExpediente = [
      { label: 'Código Único de Trámite (CUT)', value: datos.cut, mono: true, highlight: true },
      { label: 'Canal de recepción', value: canalLegible },
      { label: 'Fecha y hora de radicación', value: fechaFormateada },
      { label: 'Estado inicial registrado', value: datos.estadoInicial || 'REGISTRADO' },
      { label: 'Operador / canal registrante', value: datos.operadorMesa || canalLegible },
    ];
    builder.drawKeyValueTable(filasExpediente);

    builder.drawSectionTitle('2. DATOS DEL ADMINISTRADO Y PROCEDIMIENTO');
    const filasSolicitante = [
      { label: 'Solicitante / administrado', value: datos.nombreSolicitante },
      { label: 'Documento (enmascarado)', value: datos.documentoEnmascarado, mono: true },
    ];
    if (datos.codigoTupa || datos.denominacionTupa) {
      const costoStr =
        datos.costoTupa !== undefined && datos.costoTupa !== null
          ? ` | Tasa TUPA: S/ ${Number(datos.costoTupa).toFixed(2)}`
          : '';
      const tupaTexto = [datos.codigoTupa, datos.denominacionTupa].filter(Boolean).join(' — ');
      filasSolicitante.push({ label: 'Procedimiento TUPA', value: `${tupaTexto}${costoStr}` });
    }
    filasSolicitante.push(
      { label: 'Asunto del expediente', value: datos.asunto },
      { label: 'Total de folios recibidos', value: `${datos.folios} folio(s)` },
    );
    builder.drawKeyValueTable(filasSolicitante);

    if (datos.documentosPresentados && datos.documentosPresentados.length > 0) {
      builder.drawSectionTitle('3. DOCUMENTACIÓN PRESENTADA');
      const filasDocs = datos.documentosPresentados.map((d, idx) => ({
        label: `Documento ${idx + 1}`,
        value: `${d.nombre}${d.tipo ? ` (${d.tipo})` : ''}${d.folios ? ` · ${d.folios} folio(s)` : ''}`,
      }));
      builder.drawKeyValueTable(filasDocs);
    }

    if (datos.observacionHorario) {
      builder.drawNoticeBox('REGISTRO FUERA DE HORARIO HÁBIL (TUO LEY N° 27444)', [
        datos.observacionHorario,
      ], 'warn');
    }

    const urlTracking =
      datos.urlConsulta || `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(datos.cut)}`;

    await builder.drawVerificationCard({
      qrContent: urlTracking,
      qrCaption: 'SEGUIMIENTO EN LÍNEA',
      titulo: 'SEGUIMIENTO Y AUTENTICIDAD DEL CARGO',
      filas: [
        { label: 'Portal de consulta pública', value: urlTracking, mono: true },
        {
          label: 'Base legal de recepción',
          value: 'Expediente registrado conforme al Art. 136 del TUO de la Ley N° 27444 (LPAG).',
        },
        ...(datos.hashRecepcion
          ? [{ label: 'Huella SHA-256 del documento principal', value: datos.hashRecepcion, mono: true }]
          : []),
      ],
    });

    return builder.finalize(
      `${INSTITUCION_SISTEMA} · Cargo oficial ${datos.cut}`,
    );
  }

  /**
   * Genera el PDF oficial en hoja A4 de Constancia / Resolución de Atención Administrativa.
   */
  public async generarResolucionPdf(datos: DatosResolucionPdf): Promise<Buffer> {
    const fechaFormateada = datos.fechaHora.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const refDoc = datos.numeroResolucion ? datos.numeroResolucion : datos.cut;
    const builder = await A4InstitutionalDocBuilder.create({
      tituloDocumento: 'CONSTANCIA DE ATENCIÓN ADMINISTRATIVA',
      subtituloDocumento: `Órgano emisor: ${datos.area}`,
      unidadEmisora: datos.area.toUpperCase(),
      codigoReferencia: refDoc,
      fechaEmisionTexto: `Fecha de emisión (Lima): ${fechaFormateada}`,
      metadataTitle: `Atención Administrativa - ${datos.cut}`,
    });

    builder.drawSectionTitle('1. REFERENCIA DEL EXPEDIENTE');
    builder.drawKeyValueTable([
      { label: 'Expediente Administrativo (CUT)', value: datos.cut, mono: true, highlight: true },
      ...(datos.numeroResolucion
        ? [{ label: 'N° de documento / resolución', value: datos.numeroResolucion, mono: true }]
        : []),
      ...(datos.tramiteNombre ? [{ label: 'Procedimiento', value: datos.tramiteNombre }] : []),
      { label: 'Administrado / solicitante', value: datos.administrado },
      { label: 'Área responsable', value: datos.area },
      { label: 'Fecha de emisión', value: fechaFormateada },
      { label: 'Responsable de atención', value: datos.operador || 'Especialista Académico' },
    ]);

    builder.drawSectionTitle('2. DESARROLLO Y PRONUNCIAMIENTO');
    builder.drawParagraph(datos.resultadoResumen, { size: 9.6 });

    if (datos.observacionInterna) {
      builder.drawNoticeBox('OBSERVACIONES / SUSTENTO TÉCNICO', [datos.observacionInterna], 'info');
    }

    builder.drawSignatureBlock(
      datos.area.toUpperCase(),
      datos.operador || 'Especialista Responsable',
      'Instituto de Educación Superior Tecnológico Público "Suiza"',
    );

    return builder.finalize(
      `${INSTITUCION_SISTEMA} · TUO Ley N° 27444 · ${datos.cut}`,
    );
  }

  /**
   * Sube un buffer de PDF a MinIO de forma atómica en el bucket canónico.
   * Calcula el SHA-256 y verifica los magic bytes %PDF-.
   */
  public async subirDocumentoPdf(params: {
    s3Key: string;
    buffer: Buffer;
    bucket?: string;
  }): Promise<ObjetoS3Verificado> {
    if (params.bucket && params.bucket !== this.canonicalBucket) {
      throw new ValidationError({
        message: `Bucket S3 no autorizado. Solo se permite el bucket canónico: ${this.canonicalBucket}`,
        invalidParams: [{ name: 'bucket', reason: 'Bucket no autorizado' }],
      });
    }
    this.validarClaveS3(params.s3Key);
    const bucket = this.canonicalBucket;
    const buffer = params.buffer;

    // Validación estricta de Magic Bytes %PDF-
    if (buffer.length < 5 || !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new ValidationError({
        message: 'El archivo a almacenar no es un documento PDF válido (%PDF- requerido).',
        invalidParams: [{ name: 'buffer', reason: 'Magic bytes inválidos: %PDF- requerido' }],
      });
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
    const tamanoBytes = buffer.length;
    const magicBytes = buffer.subarray(0, 4).toString('hex').toUpperCase();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
      }),
    );

    // Validación post-subida con HEAD para garantizar consistencia
    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: params.s3Key,
      }),
    );

    if (!head || head.ContentLength !== tamanoBytes) {
      throw new Error(
        `Error de consistencia en S3: el tamaño subido (${tamanoBytes}) difiere del confirmado (${head?.ContentLength}).`,
      );
    }

    return {
      s3Bucket: bucket,
      s3Key: params.s3Key,
      tamanoBytes,
      sha256,
      magicBytes,
      mimeType: 'application/pdf',
    };
  }

  /**
   * Verifica que un objeto exista físicamente en MinIO, derivando su tamaño y SHA-256 reales.
   */
  public async verificarObjetoS3(s3Key: string, bucket?: string): Promise<ObjetoS3Verificado> {
    if (bucket && bucket !== this.canonicalBucket) {
      throw new ValidationError({
        message: `Bucket S3 no autorizado. Solo se permite el bucket canónico: ${this.canonicalBucket}`,
        invalidParams: [{ name: 'bucket', reason: 'Bucket no autorizado' }],
      });
    }
    this.validarClaveS3(s3Key);
    const bucketReal = this.canonicalBucket;

    let s3Objeto;
    try {
      s3Objeto = await this.s3.send(
        new GetObjectCommand({
          Bucket: bucketReal,
          Key: s3Key,
        }),
      );
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError({
          detail: `El archivo ${s3Key} no existe físicamente en el almacenamiento MinIO (${bucketReal}).`,
        });
      }
      throw err;
    }

    if (!s3Objeto.Body) {
      throw new ValidationError({
        message: 'El objeto en S3 se encuentra vacío o inaccesible.',
        invalidParams: [{ name: 's3Key', reason: 'Objeto S3 vacío o inaccesible' }],
      });
    }

    const stream = s3Objeto.Body as any;
    const hasher = crypto.createHash('sha256');
    let totalBytes = 0;
    let primerChunk: Buffer | null = null;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!primerChunk) {
        primerChunk = buf;
      }
      totalBytes += buf.length;
      hasher.update(buf);
    }

    if (!primerChunk || primerChunk.length < 5 || !primerChunk.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new ValidationError({
        message: 'El archivo almacenado en S3 no es un documento PDF válido (%PDF- requerido).',
        invalidParams: [{ name: 's3Key', reason: 'Magic bytes inválidos: %PDF- requerido' }],
      });
    }

    return {
      s3Bucket: bucketReal,
      s3Key,
      tamanoBytes: totalBytes,
      sha256: hasher.digest('hex').toLowerCase(),
      magicBytes: primerChunk.subarray(0, 4).toString('hex').toUpperCase(),
      mimeType: 'application/pdf',
    };
  }

  /**
   * Descarga los bytes físicos de un objeto S3 desde el bucket canónico.
   */
  public async obtenerObjetoS3(s3Key: string, bucket: string = this.canonicalBucket): Promise<Buffer> {
    if (bucket && bucket !== this.canonicalBucket) {
      throw new ValidationError({
        message: `Bucket S3 no autorizado. Solo se permite el bucket canónico: ${this.canonicalBucket}`,
        invalidParams: [{ name: 'bucket', reason: 'Bucket no autorizado' }],
      });
    }
    this.validarClaveS3(s3Key);
    const command = new GetObjectCommand({
      Bucket: this.canonicalBucket,
      Key: s3Key,
    });
    const resp = await this.s3.send(command);
    if (!resp.Body) {
      throw new NotFoundError({ detail: `El objeto ${s3Key} no tiene contenido en S3.` });
    }
    const chunks: Buffer[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Eliminación segura (best-effort) de un objeto S3 para compensación o rollback.
   */
  public async eliminarObjetoS3(s3Key: string, bucket?: string): Promise<void> {
    try {
      if (bucket && bucket !== this.canonicalBucket) {
        throw new ValidationError({
          message: `Bucket S3 no autorizado. Solo se permite el bucket canónico: ${this.canonicalBucket}`,
          invalidParams: [{ name: 'bucket', reason: 'Bucket no autorizado' }],
        });
      }
      this.validarClaveS3(s3Key);
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.canonicalBucket,
          Key: s3Key,
        }),
      );
    } catch (e: any) {
      if (e instanceof ValidationError) throw e;
      // Best-effort cleanup
    }
  }
}

export const documentoStorageService = new DocumentoStorageService();
