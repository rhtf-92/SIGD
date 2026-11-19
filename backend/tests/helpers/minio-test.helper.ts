import crypto, { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { obtenerConfiguracionS3 } from '../../src/config/s3.config.js';

export interface TestPdfArtifact {
  key: string;
  bucket: string;
  buffer: Buffer;
  tamanoBytes: number;
  sha256Hash: string;
  mimeType: string;
}

export class MinioTestHelper {
  private s3Client: S3Client;
  private bucket: string;
  private createdKeys: Set<string> = new Set();

  constructor() {
    const config = obtenerConfiguracionS3({
      ...process.env,
      S3_BUCKET: 'sigd-sandbox-e2e',
    });

    this.bucket = 'sigd-sandbox-e2e';
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
  }

  public getBucket(): string {
    return this.bucket;
  }

  public async contarObjetosEnBucket(): Promise<number> {
    let total = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const res: ListObjectsV2CommandOutput = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        }),
      );

      total += res.Contents?.length || 0;
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return total;
  }

  public async crearPdfPrueba(): Promise<TestPdfArtifact> {
    const uuid = randomUUID();
    const key = `expedientes/2026/${uuid}.pdf`;

    // PDF sintético estructuralmente válido con cabecera %PDF- y marca EOF
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`;
    const buffer = Buffer.from(pdfContent, 'utf-8');
    const tamanoBytes = buffer.byteLength;
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const mimeType = 'application/pdf';

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    this.createdKeys.add(key);

    return {
      key,
      bucket: this.bucket,
      buffer,
      tamanoBytes,
      sha256Hash,
      mimeType,
    };
  }

  public estaRegistrada(key: string): boolean {
    return this.createdKeys.has(key);
  }

  public async verificarExisteObjeto(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
        return false;
      }
      throw err;
    }
  }

  public async limpiarClavesDePrueba(): Promise<number> {
    let eliminadas = 0;
    for (const key of this.createdKeys) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
        eliminadas++;
      } catch (err) {
        console.warn(`[MinioTestHelper] Advertencia al eliminar clave de prueba ${key}:`, err);
      }
    }
    this.createdKeys.clear();
    return eliminadas;
  }
}
