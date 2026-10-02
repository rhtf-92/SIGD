import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      endpoint: process.env.MINIO_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "",
        secretAccessKey: process.env.MINIO_SECRET_KEY || ""
      }
    });
    this.bucketName = process.env.MINIO_BUCKET_NAME || "sigd-documentos";
  }

  public async generarPresignedUrlSubida(nombreArchivo: string): Promise<string> {
    if (!nombreArchivo.toLowerCase().endsWith('.pdf')) {
      throw new Error("Formato invalido. Solo se permite application/pdf");
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: nombreArchivo,
      ContentType: "application/pdf"
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    
    return presignedUrl;
  }
}