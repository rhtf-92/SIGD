import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgres://postgres:15092006@localhost:5432/sigd_prueba' });

async function main() {
  const actorId = '980707c7-5ee2-4372-98b7-37c60b65b29b'; // responsable_ingles_demo
  const actorAreaId = 'a0000000-0000-0000-0000-000000000003'; // Centro de Idiomas
  const sdaAreaId = 'a0000000-0000-0000-0000-000000000001'; // Subdirección Académica

  // 1. Consulta SQL de Bandeja Personal (sin filtro de área física)
  const sqlPersonal = `
    SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
           COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
           COALESCE(ultimo.area_actual_id, e.area_destino_id::text) AS area_actual_id,
           a.nombre AS area_actual_nombre,
           ultimo.usuario_asignado_id::text AS usuario_asignado_id
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    LEFT JOIN sigd_org.area a ON a.area_id::text = COALESCE(ultimo.area_actual_id, e.area_destino_id::text)
    WHERE ultimo.usuario_asignado_id = $1::uuid
    ORDER BY e.fecha_radicacion DESC`;
  const resP = await pool.query(sqlPersonal, [actorId]);
  console.log('EXPEDIENTES EN BANDEJA PERSONAL DE RESPONSABLE INGLES:', resP.rows);

  // 2. Consulta SQL de Bandeja de Área con jerarquía padre/hijo (SDA <-> CI)
  const sqlArea = `
    SELECT e.expediente_id::text AS id_expediente, e.codigo_expediente AS cut,
           COALESCE(ultimo.estado_nuevo, 'REGISTRADO') AS estado_actual,
           COALESCE(ultimo.area_actual_id, e.area_destino_id::text) AS area_actual_id,
           a.nombre AS area_actual_nombre
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
    LEFT JOIN sigd_org.area a ON a.area_id::text = COALESCE(ultimo.area_actual_id, e.area_destino_id::text)
    WHERE (
      COALESCE(ultimo.area_actual_id, e.area_destino_id::text) = $1::text
      OR COALESCE(ultimo.area_actual_id, e.area_destino_id::text) IN (
        SELECT a_sub.area_id::text FROM sigd_org.area a_sub WHERE a_sub.area_padre_id::text = $1::text
      )
      OR COALESCE(ultimo.area_actual_id, e.area_destino_id::text) IN (
        SELECT a_pad.area_padre_id::text FROM sigd_org.area a_pad WHERE a_pad.area_id::text = $1::text AND a_pad.area_padre_id IS NOT NULL
      )
    )
    ORDER BY e.fecha_radicacion DESC`;
  const resA = await pool.query(sqlArea, [actorAreaId]);
  console.log('EXPEDIENTES EN BANDEJA AREA DE CI (CON PADRE SDA):', resA.rows.map(r => r.cut));

  await pool.end();
}
main().catch(console.error);
