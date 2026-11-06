import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tipos = await pool.query<{ tipo_tramite_id: string; codigo: string; denominacion: string }>(
    `SELECT tipo_tramite_id, codigo, denominacion
       FROM sigd_doc.tipo_tramite_tupa
      WHERE vigente = TRUE
      ORDER BY codigo ASC`
  );

  if (tipos.rows.length === 0) {
    throw new Error('No hay tipos TUPA vigentes para sembrar.');
  }

  for (const t of tipos.rows) {
    const codigo = t.codigo;
    const nombre = `Solicitud (FUT) - ${t.denominacion}`;
    await pool.query(
      `INSERT INTO sigd_doc.tipo_documento
          (tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
       VALUES (gen_random_uuid(), $1, $2, 'pdf', 'application/pdf', 25, FALSE, TRUE)
       ON CONFLICT (codigo) DO UPDATE
          SET nombre = EXCLUDED.nombre,
              vigente = TRUE`,
      [codigo, nombre]
    );
  }

  const resultado = await pool.query<{ codigo: string; nombre: string }>(
    `SELECT codigo, nombre FROM sigd_doc.tipo_documento WHERE nombre LIKE 'Solicitud (FUT) - %' ORDER BY codigo`
  );
  console.log(`Sembrados ${resultado.rows.length} tipos documento (FUT):`);
  for (const f of resultado.rows) {
    console.log(`  - ${f.codigo}: ${f.nombre}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
