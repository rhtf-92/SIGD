import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';

export interface AlmacenResolucionTupa {
  guardar(versionId: string, contenido: Buffer): Promise<string>;
  leer(referencia: string): Promise<Buffer>;
  eliminar(referencia: string): Promise<void>;
}

class AlmacenResolucionLocal implements AlmacenResolucionTupa {
  private readonly directorio: string;

  constructor(directorio = process.env.TUPA_PDF_DIR ?? path.resolve(process.cwd(), 'storage', 'tupa')) {
    this.directorio = path.resolve(directorio);
  }

  async guardar(versionId: string, contenido: Buffer): Promise<string> {
    const archivoId = crypto.randomUUID();
    const carpeta = path.join(this.directorio, versionId);
    await fs.mkdir(carpeta, { recursive: true });
    await fs.writeFile(path.join(carpeta, `${archivoId}.pdf`), contenido, { flag: 'wx' });
    return `local:${versionId}/${archivoId}.pdf`;
  }

  async leer(referencia: string): Promise<Buffer> {
    const ruta = this.rutaLocal(referencia);
    return fs.readFile(ruta);
  }

  async eliminar(referencia: string): Promise<void> {
    await fs.rm(this.rutaLocal(referencia), { force: true });
  }

  private rutaLocal(referencia: string): string {
    const coincidencia = referencia.match(/^local:([0-9a-f-]{36})\/([0-9a-f-]{36}\.pdf)$/i);
    if (!coincidencia) throw new Error('La referencia de almacenamiento local del PDF TUPA no es válida.');
    return path.join(this.directorio, coincidencia[1], coincidencia[2]);
  }
}

class AlmacenResolucionS3 implements AlmacenResolucionTupa {
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor() {
    const configuracion = obtenerConfiguracionS3();
    this.bucket = configuracion.bucket;
    this.cliente = new S3Client({
      endpoint: configuracion.endpoint,
      region: configuracion.region,
      forcePathStyle: configuracion.forcePathStyle,
      credentials: { accessKeyId: configuracion.accessKey, secretAccessKey: configuracion.secretKey },
    });
  }

  async guardar(versionId: string, contenido: Buffer): Promise<string> {
    const clave = `tupa-resoluciones/${versionId}/${crypto.randomUUID()}.pdf`;
    await this.cliente.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: clave, Body: contenido, ContentType: 'application/pdf' }),
    );
    return `s3://${this.bucket}/${clave}`;
  }

  async leer(referencia: string): Promise<Buffer> {
    const { bucket, clave } = this.referenciaS3(referencia);
    const resultado = await this.cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
    if (!resultado.Body) throw new Error('El objeto PDF no devolvió contenido.');
    const fragmentos: Buffer[] = [];
    for await (const fragmento of resultado.Body as AsyncIterable<Uint8Array>) {
      fragmentos.push(Buffer.from(fragmento));
    }
    return Buffer.concat(fragmentos);
  }

  async eliminar(referencia: string): Promise<void> {
    const { bucket, clave } = this.referenciaS3(referencia);
    await this.cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
  }

  private referenciaS3(referencia: string): { bucket: string; clave: string } {
    const coincidencia = referencia.match(/^s3:\/\/([^/]+)\/(tupa-resoluciones\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf)$/i);
    if (!coincidencia) throw new Error('La referencia S3 del PDF TUPA no es válida.');
    return { bucket: coincidencia[1], clave: coincidencia[2] };
  }
}

export function crearAlmacenResolucionTupa(): AlmacenResolucionTupa {
  return process.env.TUPA_PDF_STORAGE === 's3'
    ? new AlmacenResolucionS3()
    : new AlmacenResolucionLocal();
}
