/**
 * Caché en memoria con TTL — infraestructura transversal del SIGD.
 *
 * El proyecto no incorporaba ninguna implementación de caché (ni en memoria ni
 * con Redis) pese a que `docker-compose.yml` levanta `sigd_redis`. Este módulo
 * cubre el requisito de "caché en memoria con TTL de 24 horas" para las tablas
 * maestras consolidadas (T-BE-OC-15) y el alivio de cómputo de días hábiles del
 * calendario laboral (T-BE-OC-13/14), sin incorporar dependencias nuevas.
 *
 * Es un `Map` con expiración opresiva bajo demanda: no hay temporizadores ni
 * tareas de fondo, por lo que una entrada expirada sólo se descarta cuando se
 * consulta. Es suficiente para catálogos de baja cardinalidad y permitiría
 * sustituir la implementación por Redis sin cambiar los servicios consumidores.
 */

export interface EntradaCache<T> {
  valor: T;
  expira_en: number;
}

export interface CacheMemoriaOpciones {
  /** Reloj inyectable para pruebas deterministas. */
  ahora?: () => number;
}

export class CacheMemoria<T> {
  private readonly entradas = new Map<string, EntradaCache<T>>();
  private readonly ahora: () => number;
  private readonly ttlMs: number;

  constructor(ttlMs: number, opciones: CacheMemoriaOpciones = {}) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError('El TTL de la caché en memoria debe ser un número positivo.');
    }
    this.ttlMs = ttlMs;
    this.ahora = opciones.ahora ?? Date.now;
  }

  /** Devuelve el valor cacheado o `undefined` si no existe o ya expiró. */
  public obtener(clave: string): T | undefined {
    const entrada = this.entradas.get(clave);
    if (!entrada) {
      return undefined;
    }
    if (entrada.expira_en <= this.ahora()) {
      this.entradas.delete(clave);
      return undefined;
    }
    return entrada.valor;
  }

  public guardar(clave: string, valor: T): void {
    this.entradas.set(clave, { valor, expira_en: this.ahora() + this.ttlMs });
  }

  /**
   * Devuelve el valor cacheado; si no existe o expiró, invoca `cargador` y
   * memoriza su resultado. El cargador se ejecuta una sola vez por TTL.
   */
  public async obtenerOCargar(clave: string, cargador: () => Promise<T>): Promise<T> {
    const valor = this.obtener(clave);
    if (valor !== undefined) {
      return valor;
    }
    const cargado = await cargador();
    this.guardar(clave, cargado);
    return cargado;
  }

  /** Invalida una clave concreta o, si se omite, todo el contenido (señal de refresco). */
  public invalidar(clave?: string): void {
    if (clave === undefined) {
      this.entradas.clear();
      return;
    }
    this.entradas.delete(clave);
  }

  public get tamano(): number {
    return this.entradas.size;
  }
}
