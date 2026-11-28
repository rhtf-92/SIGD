import 'dotenv/config';
import { crearPool } from '../src/database.js';

export interface AreaSeed {
  id: string;
  codigo: string;
  nombre: string;
  padreCodigo: string | null;
}

export const AREAS_IESTP_SUIZA: AreaSeed[] = [
  // Nivel 1: Dirección General
  {
    id: '24987bfe-5378-40ba-9c80-a7015e3a6c02',
    codigo: 'ARE_DIR',
    nombre: 'Dirección General',
    padreCodigo: null,
  },

  // Nivel 2: Órganos de Dirección, Recepción y Apoyo directos de Dirección General
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900001',
    codigo: 'ARE_SUBDIR',
    nombre: 'Sub Dirección',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: '2720dcef-cc8b-440a-a43e-ff83a93266f1',
    codigo: 'ARE_MPV',
    nombre: 'Mesa de Partes y Ventanilla',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900002',
    codigo: 'ARE_ABA',
    nombre: 'Abastecimiento Administrativo',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: '97f7e7b8-b519-4c0b-b880-a6246cf95e12',
    codigo: 'ARE_SEC',
    nombre: 'Secretaría Académica',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900005',
    codigo: 'ARE_CAL',
    nombre: 'Calidad',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: '79360374-edaa-4c3b-8f6e-e591711b0083',
    codigo: 'ARE_ADM',
    nombre: 'Administración y Finanzas',
    padreCodigo: 'ARE_DIR',
  },
  {
    id: '50329bbd-6cbd-4506-affb-d6ed0d2b2dd1',
    codigo: 'ARE_ARC',
    nombre: 'Archivo Central y Acervo Documentario',
    padreCodigo: 'ARE_ADM',
  },
  {
    id: '4fc2a68f-9eb2-496d-9c59-66a57b7d1118',
    codigo: 'ARE_DSI',
    nombre: 'Coordinación de Desarrollo de Sistemas e Informática',
    padreCodigo: 'ARE_ADM',
  },

  // Nivel 3: Coordinaciones dependientes de Sub Dirección (ARE_SUBDIR)
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900003',
    codigo: 'ARE_ACAD',
    nombre: 'Coordinación Académica',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900004',
    codigo: 'ARE_BIE',
    nombre: 'Bienestar',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900006',
    codigo: 'ARE_INV',
    nombre: 'Investigación',
    padreCodigo: 'ARE_SUBDIR',
  },

  // Nivel 3: Las 10 Coordinaciones de Programas de Estudio (Carreras) bajo Sub Dirección
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900011',
    codigo: 'ARE_CADM',
    nombre: 'Coordinación de Administración de Empresas',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900012',
    codigo: 'ARE_CTUR',
    nombre: 'Coordinación de Administración en Operaciones Turísticas',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900013',
    codigo: 'ARE_CENF',
    nombre: 'Coordinación de Enfermería Técnica',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900014',
    codigo: 'ARE_CCON',
    nombre: 'Coordinación de Construcción Civil',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900015',
    codigo: 'ARE_CASS',
    nombre: 'Coordinación de Asistencia Administrativa',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900016',
    codigo: 'ARE_CFOR',
    nombre: 'Coordinación de Manejo Forestal',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900017',
    codigo: 'ARE_CAGR',
    nombre: 'Coordinación de Producción Agropecuaria',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900018',
    codigo: 'ARE_CELE',
    nombre: 'Coordinación de Electricidad Industrial',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900019',
    codigo: 'ARE_CCONTA',
    nombre: 'Coordinación de Contabilidad',
    padreCodigo: 'ARE_SUBDIR',
  },
  {
    id: 'f1e2d3c4-b5a6-4789-9012-345678900020',
    codigo: 'ARE_CAUT',
    nombre: 'Coordinación de Mecatrónica Automotriz',
    padreCodigo: 'ARE_SUBDIR',
  },
];

async function main(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres_password@localhost:5432/sigd_prueba';

  const pool = crearPool(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Sembrando organigrama oficial IESTP Suiza...');

    for (const area of AREAS_IESTP_SUIZA) {
      let padreId: string | null = null;
      if (area.padreCodigo) {
        const resPadre = await client.query<{ area_id: string }>(
          'SELECT area_id FROM sigd_org.area WHERE codigo = $1',
          [area.padreCodigo]
        );
        padreId = resPadre.rows[0]?.area_id ?? null;
      }

      await client.query(
        `INSERT INTO sigd_org.area (area_id, codigo, nombre, area_padre_id, vigente)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (codigo) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             area_padre_id = EXCLUDED.area_padre_id,
             vigente = TRUE`,
        [area.id, area.codigo, area.nombre, padreId]
      );
      console.log(`✓ Área lista: [${area.codigo}] ${area.nombre}`);
    }

    await client.query('COMMIT');
    console.log('Organigrama oficial de IESTP Suiza sembrado exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al sembrar organigrama:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('seedOrganigramaSuiza.ts') || process.argv[1]?.endsWith('seedOrganigramaSuiza.js')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
