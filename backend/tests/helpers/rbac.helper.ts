import type { CachePermisos } from '../../src/redis.js';
import type { ClienteSql } from '../../src/domains/organicore/rbac.service.js';

/**
 * `PoolClient` declara decenas de métodos que un doble de prueba no necesita. El
 * adaptador encapsula la conversión para que cada test no repita el cast.
 */
export function comoClienteSql(bd: BdFalsa): ClienteSql {
  return bd as unknown as ClienteSql;
}

export interface RolFalso {
  rol_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  /** Columna canonica de `03_sigd_org.sql` (NO `activo`). */
  vigente: boolean;
}

export interface PermisoFalso {
  permiso_id: string;
  codigo: string;
  /** Columna canonica (NO `descripcion`). */
  nombre: string;
  /** Columna canonica: solo 'AREA' | 'GLOBAL' (NO `alcance_predetermido`). */
  ambito: 'AREA' | 'GLOBAL';
  /** Areas que acotan el permiso; vacio = alcance AREA completo. */
  subareas: string[];
}

export interface EstadoRbac {
  roles: RolFalso[];
  permisos: PermisoFalso[];
  /** rol_id → códigos de permiso concedidos. Ausente = el rol no tiene ninguno. */
  matriz: Map<string, Set<string>>;
  /** `usuario_rol.id_usuario` → roles vigentes. */
  usuarioRoles: Map<string, Array<{ rol_id: string; codigo: string }>>;
  /** código de permiso → areas que lo acotan. Ausente = sin restriccion. */
  restriccionesArea: Map<string, string[]>;
}

export function crearEstadoRbac(): EstadoRbac {
  return {
    roles: [],
    permisos: [],
    matriz: new Map(),
    usuarioRoles: new Map(),
    restriccionesArea: new Map(),
  };
}

export interface BdFalsa {
  query: (texto: string, valores?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
  connect: () => Promise<BdFalsa>;
  release: () => void;
  /** Texto SQL ejecutado, para afirmar si hubo consulta a PostgreSQL o no. */
  consultas: string[];
  count(fragmento: string): number;
}

export function crearBdFalsa(estado: EstadoRbac): BdFalsa {
  const consultas: string[] = [];

  const bd: BdFalsa = {
    consultas,
    count: (fragmento: string) => consultas.filter((t) => t.includes(fragmento)).length,
    release: () => {},
    connect: async () => bd,
    query: async (texto: string, valores: unknown[] = []) => {
      consultas.push(texto);
      return responder(estado, texto, valores);
    },
  };

  return bd;
}

async function responder(
  estado: EstadoRbac,
  texto: string,
  valores: unknown[],
): Promise<{ rows: unknown[]; rowCount: number }> {
  if (texto.includes('sigd_audit.bitacora_auditoria')) {
    return { rows: [{ id_auditoria: 'aud-1' }], rowCount: 1 };
  }

  // OC-11: evento del outbox transaccional. `insertarEvento` lee `rows[0].id_evento`.
  if (texto.includes('sigd_audit.evento_outbox')) {
    return { rows: [{ id_evento: 'evt-rbac-1' }], rowCount: 1 };
  }

  if (texto === 'BEGIN' || texto === 'COMMIT' || texto === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  // Las escrituras se resuelven antes que las lecturas: "DELETE FROM sigd_org.rol_permiso"
  // contiene la subcadena "FROM sigd_org.rol_permiso" y sin este orden se confundía con
  // la consulta de la matriz.
  if (texto.startsWith('DELETE FROM sigd_org.rol_permiso')) {
    // El rol conserva la fila pero se queda sin permisos, igual que en PostgreSQL.
    estado.matriz.set(valores[0] as string, new Set());
    return { rows: [], rowCount: 0 };
  }

  if (texto.startsWith('INSERT INTO sigd_org.rol_permiso')) {
    const rol_id = valores[0] as string;
    const codigos = valores[1] as string[];
    const actuales = estado.matriz.get(rol_id) ?? new Set<string>();
    for (const codigo of codigos) {
      actuales.add(codigo);
    }
    estado.matriz.set(rol_id, actuales);
    return { rows: [], rowCount: codigos.length };
  }

  // --- Roles vigentes de una cuenta (lo resuelve la autenticación) ---
  // Clave: `usuario_rol.id_usuario` (columna canónica de 03_sigd_org.sql).
  if (texto.includes('sigd_org.usuario_rol')) {
    const id_usuario = valores[0] as string;
    const rows = (estado.usuarioRoles.get(id_usuario) ?? [])
      // El SQL real filtra `r.vigente = true`; el doble replica ese filtro.
      .filter((asignacion) => estado.roles.find((r) => r.rol_id === asignacion.rol_id)?.vigente === true)
      .map((r) => ({ ...r }));
    return { rows, rowCount: rows.length };
  }

  // --- Bloqueo del rol dentro de la transacción de actualización ---
  if (texto.includes('FOR UPDATE')) {
    const rol_id = valores[0] as string;
    const rol = estado.roles.find((r) => r.rol_id === rol_id);
    return { rows: rol ? [{ ...rol }] : [], rowCount: rol ? 1 : 0 };
  }

  // --- Validación de existencia de permisos (dentro de la transacción) ---
  if (texto.includes('WHERE codigo = ANY($1::text[])')) {
    const codigos = valores[0] as string[];
    const rows = estado.permisos.filter((p) => codigos.includes(p.codigo)).map((p) => ({ codigo: p.codigo }));
    return { rows, rowCount: rows.length };
  }

  // --- Areas que acotan un permiso (OC-09: modelo de subáreas) ---
  if (texto.includes('sigd_org.permiso_restriccion_area') && texto.includes('p.codigo = $1')) {
    const areas = estado.restriccionesArea.get(valores[0] as string) ?? [];
    const rows = areas.map((codigo) => ({ codigo }));
    return { rows, rowCount: rows.length };
  }

  // --- Permisos de un rol por `rp.rol_id = $1` ---
  // Sirve a dos consultas equivalentes en el SQL canonico (los permisos previos
  // dentro de la transaccion y el camino con cache-miss): ambas proyectan
  // `p.codigo` para un unico `rol_id` y ordenan por codigo.
  if (texto.startsWith('SELECT') && texto.includes('rp.rol_id = $1')) {
    const rol_id = valores[0] as string;
    const codigos = [...(estado.matriz.get(rol_id) ?? [])].sort();
    const rows = codigos.map((codigo) => ({ codigo }));
    return { rows, rowCount: rows.length };
  }

  // --- Matriz completa rol-permiso (consulta del controlador) ---
  if (texto.startsWith('SELECT r.rol_id') && texto.includes('p.permiso_id')) {
    const rows: Array<{ rol_id: string } & PermisoFalso> = [];
    for (const rol of estado.roles) {
      for (const codigo of estado.matriz.get(rol.rol_id) ?? []) {
        const permiso = estado.permisos.find((p) => p.codigo === codigo);
        if (permiso) {
          rows.push({
            rol_id: rol.rol_id,
            ...permiso,
            subareas: estado.restriccionesArea.get(codigo) ?? [],
          });
        }
      }
    }
    rows.sort(
      (a, b) =>
        (estado.roles.find((r) => r.rol_id === a.rol_id)?.codigo ?? '').localeCompare(
          estado.roles.find((r) => r.rol_id === b.rol_id)?.codigo ?? '',
        ) || a.codigo.localeCompare(b.codigo),
    );
    return { rows, rowCount: rows.length };
  }

  // --- Catálogo de roles ---
  if (texto.startsWith('SELECT') && texto.includes('FROM sigd_org.rol_sistema')) {
    const soloVigentes = texto.includes('vigente = true');
    const rows = estado.roles
      .filter((r) => !soloVigentes || r.vigente)
      .map((r) => ({ ...r }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
    return { rows, rowCount: rows.length };
  }

  // --- Catálogo de permisos (sin columna de vigencia en el esquema canónico) ---
  if (texto.startsWith('SELECT') && texto.includes('FROM sigd_org.permiso_sistema')) {
    const rows = estado.permisos
      .map((p) => ({ ...p, subareas: estado.restriccionesArea.get(p.codigo) ?? [] }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
    return { rows, rowCount: rows.length };
  }

  return { rows: [], rowCount: 0 };
}

export interface CacheFalsa extends CachePermisos {
  lecturas: string[];
  escrituras: Array<{ rol_id: string; permisos: string[] }>;
  invalidaciones: string[];
  invalidacionesMasivas: number;
  /** Permite simular un Redis caido: lanza en `invalidar`. */
  fallarInvalidacion?: () => never;
}

export function crearCacheFalsa(): CacheFalsa {
  const almacen = new Map<string, string[]>();
  const cache: CacheFalsa = {
    lecturas: [],
    escrituras: [],
    invalidaciones: [],
    invalidacionesMasivas: 0,

    async obtener(rol_id: string) {
      cache.lecturas.push(rol_id);
      return almacen.get(rol_id) ?? null;
    },

    async guardar(rol_id: string, permisos: string[]) {
      cache.escrituras.push({ rol_id, permisos: [...permisos] });
      almacen.set(rol_id, [...permisos]);
    },

    async invalidar(rol_id: string) {
      cache.fallarInvalidacion?.();
      cache.invalidaciones.push(rol_id);
      almacen.delete(rol_id);
    },

    async invalidarTodos() {
      cache.invalidacionesMasivas += 1;
      almacen.clear();
    },

    async cerrar() {
      return;
    },
  };

  return cache;
}

export const CUENTA_ADMIN = '11111111-1111-4111-8111-111111111111';
export const CUENTA_ESTUDIANTE = '22222222-2222-4222-8222-222222222222';
export const CUENTA_SIN_ROL = '33333333-3333-4333-8333-333333333333';