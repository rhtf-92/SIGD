import { z } from 'zod';

const esquema = z.object({
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().min(2).default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('sigd-expedientes'),
  S3_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  S3_SECRET_KEY: z.string().min(1).default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
  S3_PRESIGN_EXPIRATION_SEGUNDOS: z.coerce.number().int().min(60).max(604_800).default(900),
});

export interface ConfiguracionS3 {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  presignExpirationSegundos: number;
}

export function obtenerConfiguracionS3(env: NodeJS.ProcessEnv = process.env): ConfiguracionS3 {
  const parseado = esquema.parse({
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY: env.S3_ACCESS_KEY,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
    S3_FORCE_PATH_STYLE: env.S3_FORCE_PATH_STYLE,
    S3_PRESIGN_EXPIRATION_SEGUNDOS: env.S3_PRESIGN_EXPIRATION_SEGUNDOS,
  });

  return {
    endpoint: parseado.S3_ENDPOINT.replace(/\/+$/, ''),
    region: parseado.S3_REGION,
    bucket: parseado.S3_BUCKET,
    accessKey: parseado.S3_ACCESS_KEY,
    secretKey: parseado.S3_SECRET_KEY,
    forcePathStyle: parseado.S3_FORCE_PATH_STYLE,
    presignExpirationSegundos: parseado.S3_PRESIGN_EXPIRATION_SEGUNDOS,
  };
}