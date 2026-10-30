import 'dotenv/config';
import { crearPool } from '../../database.js';
import { CONCEPTOS_TUPA_33 } from './catalogoTupa33.data.js';

const pool = crearPool(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba');

try {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const concepto of CONCEPTOS_TUPA_33) {
      const catalogo = await cliente.query<{ catalogo_id: string }>(`INSERT INTO sigd_doc.catalogo_institucional(codigo,nombre,tipo_catalogo,dependencia,autoridad,vigente) VALUES($1,$2,'PROCEDIMIENTO_ADMINISTRATIVO',$3,$4,TRUE) ON CONFLICT(codigo) DO UPDATE SET nombre=EXCLUDED.nombre,dependencia=EXCLUDED.dependencia,autoridad=EXCLUDED.autoridad RETURNING catalogo_id`, [concepto.codigo, concepto.nombre, concepto.dependencia ?? null, concepto.autoridad ?? null]);
      const id = catalogo.rows[0].catalogo_id;
      const existe = await cliente.query('SELECT 1 FROM sigd_doc.catalogo_institucional_version WHERE catalogo_id=$1', [id]);
      if (!existe.rowCount) {
        const version = await cliente.query<{ version_id: string }>(`INSERT INTO sigd_doc.catalogo_institucional_version(catalogo_id,numero_version,requisitos,tarifas,monto_texto,fuente,motivo,vigente_desde) VALUES($1,1,$2::jsonb,'[]'::jsonb,$3,'TUPA institucional','Carga inicial TUPA',CURRENT_DATE) RETURNING version_id`, [id, JSON.stringify(concepto.requisitos), concepto.montoTexto ?? null]);
        await cliente.query('UPDATE sigd_doc.catalogo_institucional SET version_publicada_id=$2 WHERE catalogo_id=$1', [id, version.rows[0].version_id]);
      }
    }
    await cliente.query('COMMIT');
    console.log(`[CATALOGO] ${CONCEPTOS_TUPA_33.length} conceptos TUPA verificados.`);
  } catch (error) { await cliente.query('ROLLBACK'); throw error; } finally { cliente.release(); }
} finally { await pool.end(); }
