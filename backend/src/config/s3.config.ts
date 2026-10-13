import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(2).default('us-east-1'),
  S3_BUCKET: z.string().min(3).default('sigd-expedientes'),
  S3_ACCESS_KEY: z.string().trim().min(3),
  S3_SECRET_KEY: z.string().trim().min(8),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
  S3_PRESIGN_EXPIRATION_SEGUNDOS: z.coerce.number().int().min(60).max(604_800).default(900),
}).superRefine((config, contexto) => {
  if (config.NODE_ENV !== 'production') return;
  const valoresInseguros = new Set(['minioadmin', 'minioadminpassword', 'changeme', 'password']);
  const accessKey = config.S3_ACCESS_KEY.toLowerCase();
  const secretKey = config.S3_SECRET_KEY.toLowerCase();
  if (valoresInseguros.has(accessKey) || accessKey.startsWith('cambiar_')) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credenciales S3 inseguras: producción exige secretos externos no predeterminados.',
      path: ['S3_ACCESS_KEY'],
    });
  }
  if (valoresInseguros.has(secretKey) || secretKey.startsWith('cambiar_')) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credenciales S3 inseguras: producción exige secretos externos no predeterminados.',
      path: ['S3_SECRET_KEY'],
    });
  }
});

export interface ConfiguracionS3 {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  presignExpirationSegundos: number;
}

export function obtenerConfiguracionS3(env: NodeJS.ProcessEnv = process.env): ConfiguracionS3 {
  const parseado = esquema.parse({
    NODE_ENV: env.NODE_ENV,
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_PUBLIC_ENDPOINT: env.S3_PUBLIC_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY: env.S3_ACCESS_KEY,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
    S3_FORCE_PATH_STYLE: env.S3_FORCE_PATH_STYLE,
    S3_PRESIGN_EXPIRATION_SEGUNDOS: env.S3_PRESIGN_EXPIRATION_SEGUNDOS,
  });

  return {
    endpoint: parseado.S3_ENDPOINT.replace(/\/+$/, ''),
    publicEndpoint: (parseado.S3_PUBLIC_ENDPOINT ?? parseado.S3_ENDPOINT).replace(/\/+$/, ''),
    region: parseado.S3_REGION,
    bucket: parseado.S3_BUCKET,
    accessKey: parseado.S3_ACCESS_KEY,
    secretKey: parseado.S3_SECRET_KEY,
    forcePathStyle: parseado.S3_FORCE_PATH_STYLE,
    presignExpirationSegundos: parseado.S3_PRESIGN_EXPIRATION_SEGUNDOS,
  };
}
