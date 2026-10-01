import { z } from 'zod';
import type { Pool } from 'pg';

export interface CacheDistribuida {
  get(clave: string): Promise<string | null>;
  set(clave: string, valor: string, ttlSegundos: number): Promise<void>;
}

export interface DistritoUcayali {
  codigo: string;
  nombre: string;
}

export interface ProvinciaUcayali {
  codigo: string;
  nombre: string;
  distritos: DistritoUcayali[];
}

const CACHE_KEY = 'sigd:ubigeo:ucayali:v1';
const CACHE_TTL_SECONDS = 86_400;

const esquemaCatalogo = z.array(z.object({
  codigo: z.string().length(4),
  nombre: z.string(),
  distritos: z.array(z.object({ codigo: z.string().length(6), nombre: z.string() })),
})).superRefine((provincias, contexto) => {
  const cantidadDistritos = provincias.reduce((total, provincia) => total + provincia.distritos.length, 0);
  if (provincias.length !== 4 || cantidadDistritos !== 17) {
    contexto.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El catálogo de Ucayali debe tener 4 provincias y 17 distritos.',
    });
  }
});

export class UbigeoService {
  private cacheLocal: { venceEn: number; datos: ProvinciaUcayali[] } | null = null;

  constructor(
    private readonly pool: Pool,
    private readonly cacheDistribuida?: CacheDistribuida,
  ) {}

  async obtenerDistritosUcayali(provinciaCodigo?: string): Promise<ProvinciaUcayali[]> {
    const provincias = await this.obtenerCatalogo();
    const resultado = provinciaCodigo
      ? provincias.filter((provincia) => provincia.codigo === provinciaCodigo)
      : provincias;
    return structuredClone(resultado);
  }

  async contieneDistrito(codigo: string): Promise<boolean> {
    const provincias = await this.obtenerCatalogo();
    return provincias.some((provincia) =>
      provincia.distritos.some((distrito) => distrito.codigo === codigo),
    );
  }

  private async obtenerCatalogo(): Promise<ProvinciaUcayali[]> {
    if (this.cacheLocal && this.cacheLocal.venceEn > Date.now()) {
      return this.cacheLocal.datos;
    }

    if (this.cacheDistribuida) {
      try {
        const serializado = await this.cacheDistribuida.get(CACHE_KEY);
        if (serializado) {
          const validacion = esquemaCatalogo.safeParse(JSON.parse(serializado) as unknown);
          if (validacion.success) return this.guardarEnCache(validacion.data);
        }
      } catch {
        // Redis is an optimization; the immutable catalog remains available locally.
      }
    }

    const resultado = await this.pool.query<{
      provincia_codigo: string;
      provincia_nombre: string;
      distrito_codigo: string | null;
      distrito_nombre: string | null;
    }>(
      `SELECT p.codigo AS provincia_codigo,
              p.nombre AS provincia_nombre,
              d.codigo AS distrito_codigo,
              d.nombre AS distrito_nombre
         FROM sigd_auth.provincia_ubigeo p
         LEFT JOIN sigd_auth.distrito_ubigeo d ON d.provincia_codigo = p.codigo
        WHERE p.codigo LIKE '25%'
        ORDER BY p.codigo, d.codigo`,
    );
    const provincias = new Map<string, ProvinciaUcayali>();
    for (const fila of resultado.rows) {
      let provincia = provincias.get(fila.provincia_codigo);
      if (!provincia) {
        provincia = {
          codigo: fila.provincia_codigo,
          nombre: fila.provincia_nombre,
          distritos: [],
        };
        provincias.set(fila.provincia_codigo, provincia);
      }
      if (fila.distrito_codigo && fila.distrito_nombre) {
        provincia.distritos.push({ codigo: fila.distrito_codigo, nombre: fila.distrito_nombre });
      }
    }

    const datos = esquemaCatalogo.parse([...provincias.values()]);
    this.guardarEnCache(datos);
    if (this.cacheDistribuida) {
      try {
        await this.cacheDistribuida.set(CACHE_KEY, JSON.stringify(datos), CACHE_TTL_SECONDS);
      } catch {
        // A Redis outage must not make the public geographic catalog unavailable.
      }
    }
    return datos;
  }

  private guardarEnCache(datos: ProvinciaUcayali[]): ProvinciaUcayali[] {
    this.cacheLocal = {
      datos,
      venceEn: Date.now() + CACHE_TTL_SECONDS * 1_000,
    };
    return datos;
  }
}