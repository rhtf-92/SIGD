import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sigd_prueba',
  user: process.env.DB_USER || 'sigd_user',
  password: process.env.DB_PASSWORD || 'sigd_password',
});

async function main() {
  const r = await pool.query('SELECT documento_adjunto_id, s3_bucket, s3_key, nombre_archivo, mime_type FROM sigd_doc.documento_adjunto ORDER BY creado_en DESC LIMIT 10');
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
