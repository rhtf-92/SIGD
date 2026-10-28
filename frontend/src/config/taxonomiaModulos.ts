// Taxonomía de los módulos del SIGD.
// Agrupa los módulos por familia de archivo: el rail lateral y el catálogo
// de la portada consumen esta misma fuente, de modo que la navegación se lee
// siempre como un archivador.

/** Familia de archivo: agrupa los módulos como un expediente físico. */
export type FamiliaModulo =
  | "ingreso"
  | "gestion"
  | "validez"
  | "gobierno";

export interface DefinicionFamilia {
  id: FamiliaModulo;
  nombre: string;
  orden: number;
}

export const FAMILIAS: DefinicionFamilia[] = [
  { id: "ingreso", nombre: "Ingreso y Registro", orden: 10 },
  { id: "gestion", nombre: "Gestión Documental", orden: 20 },
  { id: "validez", nombre: "Validez Legal", orden: 30 },
  { id: "gobierno", nombre: "Gobierno Institucional", orden: 40 },
];

const FAMILIA_POR_ID = new Map(FAMILIAS.map((f) => [f.id, f]));

/** Rótulo legible de una familia (con respaldo si el id es desconocido). */
export function nombreFamilia(familia: FamiliaModulo | undefined): string {
  if (!familia) return "Otros";
  return FAMILIA_POR_ID.get(familia)?.nombre ?? "Otros";
}

/** Forma mínima que un módulo necesita para ser agrupado por familia. */
export interface ModuloAgrupable {
  id: string;
  familia?: FamiliaModulo;
}

export interface GrupoFamilia<T> {
  familia: FamiliaModulo;
  nombre: string;
  modulos: T[];
}

/**
 * Agrupa módulos por familia respetando el orden institucional y la posición
 * original de cada módulo dentro de su familia.
 */
export function agruparPorFamilia<T extends ModuloAgrupable>(
  modulos: T[],
): GrupoFamilia<T>[] {
  const grupos = new Map<FamiliaModulo, T[]>();

  for (const modulo of modulos) {
    const familia = modulo.familia ?? "gestion";
    const actual = grupos.get(familia);
    if (actual) actual.push(modulo);
    else grupos.set(familia, [modulo]);
  }

  return [...grupos.entries()]
    .sort(
      (a, b) =>
        (FAMILIA_POR_ID.get(a[0])?.orden ?? 999) -
        (FAMILIA_POR_ID.get(b[0])?.orden ?? 999),
    )
    .map(([familia, items]) => ({
      familia,
      nombre: nombreFamilia(familia),
      modulos: items,
    }));
}
