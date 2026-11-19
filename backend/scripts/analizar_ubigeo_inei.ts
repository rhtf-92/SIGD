import fs from 'node:fs';
import path from 'node:path';

const csvPath = path.resolve('data/ubigeo/UBIGEOS_2022_1891_distritos.csv');
const raw = fs.readFileSync(csvPath, 'latin1'); // or utf8, let's detect
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
const header = lines[0].split(';');
console.log('Header:', header);

interface Row {
  iddist: string;
  coddep: string;
  nombdep: string;
  codprov: string;
  nombprov: string;
  coddist: string;
  nombdist: string;
  capital: string;
  region: string;
}

const rows: Row[] = [];
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(';');
  const rawId = parts[0]?.trim() || '';
  if (!rawId || !/^\d{6}$/.test(rawId.padStart(6, '0')) || rawId === '000000' || !parts[1]?.trim()) {
    console.log(`Fila ignorada (vacía o no válida) en índice ${i}:`, lines[i]);
    continue;
  }
  const iddist = rawId.padStart(6, '0');
  const nombdep = parts[1].trim();
  const nombprov = parts[2].trim();
  const nombdist = parts[3].trim();
  const capital = parts[4]?.trim() || '';
  const region = parts[6]?.trim() || '';

  rows.push({
    iddist,
    coddep: iddist.slice(0, 2),
    nombdep,
    codprov: iddist.slice(0, 4),
    nombprov,
    coddist: iddist,
    nombdist,
    capital,
    region,
  });
}

console.log('Total filas de datos:', rows.length);

const departamentos = new Map<string, string>();
const provincias = new Map<string, { coddep: string; nombdep: string; nombprov: string }>();
const distritos = new Map<string, Row>();

for (const r of rows) {
  if (!departamentos.has(r.coddep)) {
    departamentos.set(r.coddep, r.nombdep);
  }
  if (!provincias.has(r.codprov)) {
    provincias.set(r.codprov, { coddep: r.coddep, nombdep: r.nombdep, nombprov: r.nombprov });
  }
  if (distritos.has(r.iddist)) {
    console.warn('Duplicado detectado:', r.iddist, r.nombdist, 'vs', distritos.get(r.iddist)?.nombdist);
  }
  distritos.set(r.iddist, r);
}

console.log('\n======================================================');
console.log('RESUMEN DE CONTEO OFICIAL INEI 2022:');
console.log('======================================================');
console.log('Total Departamentos / Unidades de 1er nivel:', departamentos.size);
console.log('Total Provincias:', provincias.size);
console.log('Total Distritos:', distritos.size);
console.log('======================================================\n');

console.log('Listado de Departamentos / Regiones (25):');
for (const [cod, nomb] of Array.from(departamentos.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
  const provsCount = Array.from(provincias.values()).filter(p => p.coddep === cod).length;
  const distsCount = Array.from(distritos.values()).filter(d => d.coddep === cod).length;
  console.log(`  ${cod} -> ${nomb.padEnd(20)} | Provincias: ${String(provsCount).padStart(2)} | Distritos: ${String(distsCount).padStart(3)}`);
}

console.log('\nVerificación de Callao (Código 07):');
console.log(Array.from(provincias.entries()).filter(([c, p]) => p.coddep === '07'));
console.log('Distritos de Callao:');
console.log(Array.from(distritos.values()).filter(d => d.coddep === '07').map(d => `${d.coddist} ${d.nombdist}`));

console.log('\nVerificación de Ucayali (Código 25):');
console.log(Array.from(provincias.entries()).filter(([c, p]) => p.coddep === '25'));
// Comprobar distritos con caracteres especiales (Ñ, tildes)
console.log('\nDistritos con caracteres especiales:');
const conEspeciales = Array.from(distritos.values()).filter(d => /[ÑÁÉÍÓÚñáéíóú]/.test(d.nombdist) || d.nombdist.includes('CANETE') || d.nombdist.includes('PURUS'));
console.log(conEspeciales.slice(0, 10).map(d => `${d.coddist} ${d.nombdist}`));
