import { writeFileSync } from 'node:fs';
import { PROCEDIMIENTOS_TUPA_2026 } from '../../frontend/src/data/tupaSuiza2026.js';

const p = new Map(PROCEDIMIENTOS_TUPA_2026.map((row) => [row.codigo, row]));
const skip = new Set(['SUZ26-022', 'SUZ26-070', 'SUZ26-071']);
const page = (n: number) => n <= 10 ? 1 : n <= 20 ? 2 : n <= 29 ? 3 : n <= 45 ? 4 : n <= 66 ? 5 : 6;
const rows = PROCEDIMIENTOS_TUPA_2026.filter((r) => !skip.has(r.codigo)).map((row) => {
  const others = row.codigo === 'SUZ26-021' ? ['SUZ26-022'] : row.codigo === 'SUZ26-069' ? ['SUZ26-070', 'SUZ26-071'] : [];
  const grouped = [row, ...others.map((code) => p.get(code)!)];
  const rubro = row.nota?.match(/Rubro:\s*([^\.]+)/i)?.[1]?.trim() ?? 'Rubro según encabezado del TUPA';
  return {
    codigoInterno: row.codigo,
    referenciasInternas: grouped.map((r) => r.codigo),
    nombre: row.codigo === 'SUZ26-021' ? 'Venta de Patos Pichones' : row.codigo === 'SUZ26-069' ? 'Búsqueda y Duplicados de Boletas, Síllabus y Otros Trámites' : row.nombre,
    rubro,
    paginaFuente: page(Number(row.codigo.slice(-3))),
    costoFuente: row.derechoPago ?? 'Importe agrupado o variante; revisar detalle',
    detallesTarifa: grouped.flatMap((r) => r.detalleTarifas ?? []),
  };
});
if (rows.length !== 72) throw new Error(`Se esperaban 72 filas principales, se obtuvieron ${rows.length}.`);
writeFileSync(new URL('../src/domains/tramicore/catalogoTupa2026.ts', import.meta.url),
  `/** Generado desde la transcripción institucional TUPA; los códigos SUZ26 son referencias internas. */\nexport const CATALOGO_TUPA_2026 = ${JSON.stringify(rows, null, 2)} as const;\n`);
