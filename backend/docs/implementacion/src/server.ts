import 'dotenv/config';
import { crearPool } from './database.js';
import { construirApp } from './app.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL no definida. Defínela de forma explícita antes de iniciar el servidor.',
  );
}
const port = Number(process.env.PORT ?? 3000);

const pool = crearPool(databaseUrl);
const app = construirApp(pool);

app.listen(port, () => {
  console.log(`SIGD CoreLink escuchando en http://localhost:${port}`);
});