import 'dotenv/config';
import { crearPool } from './database.js';
import { construirApp } from './app.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const app = construirApp(pool);

app.listen(port, () => {
  console.log(`SIGD Backend escuchando en http://localhost:${port}`);
});