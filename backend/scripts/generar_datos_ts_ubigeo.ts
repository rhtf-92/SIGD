import fs from 'node:fs';
import path from 'node:path';

const csvPath = path.resolve('data/ubigeo/UBIGEOS_2022_1891_distritos.csv');
const raw = fs.readFileSync(csvPath, 'latin1');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

interface Row {
  iddist: string;
  coddep: string;
  nombdep: string;
  codprov: string;
  nombprov: string;
  coddist: string;
  nombdist: string;
}

const rows: Row[] = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  const rawId = parts[0]?.trim() || '';
  if (!rawId || !/^\d{6}$/.test(rawId.padStart(6, '0')) || rawId === '000000' || !parts[1]?.trim()) {
    continue;
  }
  const iddist = rawId.padStart(6, '0');
  const nombdep = parts[1].trim();
  const nombprov = parts[2].trim();
  const nombdist = parts[3].trim();

  rows.push({
    iddist,
    coddep: iddist.slice(0, 2),
    nombdep,
    codprov: iddist.slice(0, 4),
    nombprov,
    coddist: iddist,
    nombdist,
  });
}

const departamentos = new Map<string, string>();
const provincias = new Map<string, { coddep: string; nombprov: string }>();
const distritos: Array<{ codigo: string; provinciaCodigo: string; departamentoCodigo: string; nombre: string }> = [];

for (const r of rows) {
  if (!departamentos.has(r.coddep)) {
    departamentos.set(r.coddep, r.nombdep);
  }
  if (!provincias.has(r.codprov)) {
    provincias.set(r.codprov, { coddep: r.coddep, nombprov: r.nombprov });
  }
  distritos.push({
    codigo: r.coddist,
    provinciaCodigo: r.codprov,
    departamentoCodigo: r.coddep,
    nombre: r.nombdist,
  });
}

// Backend TS
const backendContent = `// Catálogo Oficial del Perú (INEI 2022) - Datos Estáticos Oficiales
export interface DepartamentoItem {
  codigo: string;
  nombre: string;
}

export interface ProvinciaItem {
  codigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export interface DistritoItem {
  codigo: string;
  provinciaCodigo: string;
  departamentoCodigo: string;
  nombre: string;
}

export const DEPARTAMENTOS_PERU: DepartamentoItem[] = ${JSON.stringify(
  Array.from(departamentos.entries())
    .map(([codigo, nombre]) => ({ codigo, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  null,
  2
)};

export const PROVINCIAS_PERU: ProvinciaItem[] = ${JSON.stringify(
  Array.from(provincias.entries())
    .map(([codigo, p]) => ({ codigo, departamentoCodigo: p.coddep, nombre: p.nombprov }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  null,
  2
)};
`;

fs.writeFileSync('src/domains/identicore/catalogoUbigeo.data.ts', backendContent, 'utf8');
console.log('Generado backend/src/domains/identicore/catalogoUbigeo.data.ts');

// Frontend TS
const frontendContent = `// Catálogo Oficial Geográfico del Perú (INEI 2022)
// 25 Departamentos, 196 Provincias, 1891 Distritos

export interface UbigeoItem {
  id: string;
  nombre: string;
  padreId?: string;
}

export interface UbigeoDTO {
  departamento: UbigeoItem | null;
  provincia: UbigeoItem | null;
  distrito: UbigeoItem | null;
  ubigeoCod: string;
}

export const DEPARTAMENTOS_NACIONAL: ReadonlyArray<UbigeoItem> = ${JSON.stringify(
  Array.from(departamentos.entries())
    .map(([id, nombre]) => ({
      id,
      nombre: id === '07' ? 'CALLAO (PROVINCIA CONSTITUCIONAL)' : nombre,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  null,
  2
)};

export const PROVINCIAS_NACIONAL: ReadonlyArray<UbigeoItem> = ${JSON.stringify(
  Array.from(provincias.entries())
    .map(([id, p]) => ({ id, nombre: p.nombprov, padreId: p.coddep }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  null,
  2
)};

export const DISTRITOS_NACIONAL: ReadonlyArray<UbigeoItem> = ${JSON.stringify(
  distritos.map((d) => ({ id: d.codigo, nombre: d.nombre, padreId: d.provinciaCodigo })),
  null,
  2
)};
`;

fs.writeFileSync('../frontend/src/data/catalogoUbigeoNacional.ts', frontendContent, 'utf8');
console.log('Generado frontend/src/data/catalogoUbigeoNacional.ts');
