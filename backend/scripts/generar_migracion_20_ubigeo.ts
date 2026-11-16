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
const provincias = new Map<string, { coddep: string; nombdep: string; nombprov: string }>();
const distritos = new Map<string, Row>();

for (const r of rows) {
  if (!departamentos.has(r.coddep)) {
    departamentos.set(r.coddep, r.nombdep);
  }
  if (!provincias.has(r.codprov)) {
    provincias.set(r.codprov, { coddep: r.coddep, nombdep: r.nombdep, nombprov: r.nombprov });
  }
  distritos.set(r.iddist, r);
}

console.log(`Departamentos: ${departamentos.size}`);
console.log(`Provincias: ${provincias.size}`);
console.log(`Distritos: ${distritos.size}`);

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

let sql = `-- =============================================================================
-- Migración 20 · Catálogo Geográfico Oficial del Perú (UBIGEO INEI 2022)
-- Esquema: sigd_auth
-- Rama: B_JACOBO
-- =============================================================================
-- Catálogo oficial del INEI (Plataforma Nacional de Datos Abiertos - PCM):
-- 25 Departamentos / Regiones (incluyendo la Provincia Constitucional del Callao)
-- 196 Provincias
-- 1,891 Distritos
-- Códigos oficiales de 6 dígitos preservando ceros a la izquierda (CHAR).
-- =============================================================================

BEGIN;

-- 1. Tabla de Departamentos / Unidades Territoriales de 1er Nivel
CREATE TABLE IF NOT EXISTS sigd_auth.departamento_ubigeo (
    codigo CHAR(2) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

-- 2. Tabla de Provincias
CREATE TABLE IF NOT EXISTS sigd_auth.provincia_ubigeo (
    codigo CHAR(4) PRIMARY KEY,
    departamento_codigo CHAR(2) NOT NULL
        REFERENCES sigd_auth.departamento_ubigeo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    CONSTRAINT uq_provincia_ubigeo UNIQUE (departamento_codigo, nombre)
);

-- 3. Tabla de Distritos
CREATE TABLE IF NOT EXISTS sigd_auth.distrito_ubigeo (
    codigo CHAR(6) PRIMARY KEY,
    provincia_codigo CHAR(4) NOT NULL
        REFERENCES sigd_auth.provincia_ubigeo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    departamento_codigo CHAR(2) NOT NULL
        REFERENCES sigd_auth.departamento_ubigeo(codigo) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre VARCHAR(120) NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_distrito_provincia
    ON sigd_auth.distrito_ubigeo(provincia_codigo);

CREATE INDEX IF NOT EXISTS idx_distrito_departamento
    ON sigd_auth.distrito_ubigeo(departamento_codigo);

CREATE INDEX IF NOT EXISTS idx_distrito_nombre
    ON sigd_auth.distrito_ubigeo(nombre);

CREATE INDEX IF NOT EXISTS idx_provincia_departamento
    ON sigd_auth.provincia_ubigeo(departamento_codigo);

-- 4. Vista Unificada del Catálogo Territorial del Perú
CREATE OR REPLACE VIEW sigd_auth.v_ubigeo_peru AS
SELECT
    d.codigo AS codigo_distrito,
    d.codigo AS ubigeo,
    d.nombre AS distrito,
    p.codigo AS codigo_provincia,
    p.nombre AS provincia,
    dep.codigo AS codigo_departamento,
    dep.nombre AS departamento
FROM sigd_auth.distrito_ubigeo d
JOIN sigd_auth.provincia_ubigeo p ON p.codigo = d.provincia_codigo
JOIN sigd_auth.departamento_ubigeo dep ON dep.codigo = d.departamento_codigo;

-- 5. Integración con el Modelo de Personas y Perfil Institucional
-- Perfil de Usuario (habilitación de domicilio para capacidadesRegistro)
ALTER TABLE sigd_auth.perfil_usuario
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(250),
    ADD COLUMN IF NOT EXISTS ubigeo_distrito CHAR(6),
    ADD COLUMN IF NOT EXISTS referencia VARCHAR(250);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_perfil_usuario_ubigeo'
           AND conrelid = 'sigd_auth.perfil_usuario'::regclass
    ) THEN
        ALTER TABLE sigd_auth.perfil_usuario
            ADD CONSTRAINT fk_perfil_usuario_ubigeo
            FOREIGN KEY (ubigeo_distrito)
            REFERENCES sigd_auth.distrito_ubigeo(codigo)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_perfil_usuario_ubigeo
    ON sigd_auth.perfil_usuario(ubigeo_distrito);

-- Persona Natural
ALTER TABLE sigd_auth.persona_natural
    ADD COLUMN IF NOT EXISTS direccion VARCHAR(250),
    ADD COLUMN IF NOT EXISTS ubigeo_distrito CHAR(6);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_persona_natural_ubigeo'
           AND conrelid = 'sigd_auth.persona_natural'::regclass
    ) THEN
        ALTER TABLE sigd_auth.persona_natural
            ADD CONSTRAINT fk_persona_natural_ubigeo
            FOREIGN KEY (ubigeo_distrito)
            REFERENCES sigd_auth.distrito_ubigeo(codigo)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_persona_natural_ubigeo
    ON sigd_auth.persona_natural(ubigeo_distrito);

-- Persona Jurídica (domicilio fiscal de la entidad)
ALTER TABLE sigd_auth.persona_juridica
    ADD COLUMN IF NOT EXISTS ubigeo_distrito CHAR(6);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'fk_persona_juridica_ubigeo'
           AND conrelid = 'sigd_auth.persona_juridica'::regclass
    ) THEN
        ALTER TABLE sigd_auth.persona_juridica
            ADD CONSTRAINT fk_persona_juridica_ubigeo
            FOREIGN KEY (ubigeo_distrito)
            REFERENCES sigd_auth.distrito_ubigeo(codigo)
            ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_persona_juridica_ubigeo
    ON sigd_auth.persona_juridica(ubigeo_distrito);

-- =============================================================================
-- 6. Carga de Datos Oficiales (Idempotente)
-- =============================================================================

-- Departamentos (25)
INSERT INTO sigd_auth.departamento_ubigeo (codigo, nombre) VALUES
`;

const depEntries = Array.from(departamentos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
sql += depEntries.map(([cod, nomb]) => `    ('${cod}', '${escapeSql(nomb)}')`).join(',\n');
sql += `\nON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;\n\n`;

// Provincias (196)
sql += `-- Provincias (196)\nINSERT INTO sigd_auth.provincia_ubigeo (codigo, departamento_codigo, nombre) VALUES\n`;
const provEntries = Array.from(provincias.entries()).sort((a, b) => a[0].localeCompare(b[0]));
sql += provEntries.map(([cod, p]) => `    ('${cod}', '${p.coddep}', '${escapeSql(p.nombprov)}')`).join(',\n');
sql += `\nON CONFLICT (codigo) DO UPDATE SET departamento_codigo = EXCLUDED.departamento_codigo, nombre = EXCLUDED.nombre;\n\n`;

// Distritos (1,891)
sql += `-- Distritos (1,891)\nINSERT INTO sigd_auth.distrito_ubigeo (codigo, provincia_codigo, departamento_codigo, nombre) VALUES\n`;
const distEntries = Array.from(distritos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
sql += distEntries.map(([cod, d]) => `    ('${cod}', '${d.codprov}', '${d.coddep}', '${escapeSql(d.nombdist)}')`).join(',\n');
sql += `\nON CONFLICT (codigo) DO UPDATE SET provincia_codigo = EXCLUDED.provincia_codigo, departamento_codigo = EXCLUDED.departamento_codigo, nombre = EXCLUDED.nombre;\n\n`;

sql += `COMMIT;\n`;

const outPath = path.resolve('migraciones/20_sigd_auth_catalogo_ubigeo_peru.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Migración escrita exitosamente en: ${outPath} (${Buffer.byteLength(sql, 'utf8')} bytes)`);
