import 'dotenv/config';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { RepositorioMgdAnalytics } from '../../src/domains/corelink/mgdAnalytics.repository.js';
const url=new URL(process.env.DATABASE_URL!);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.ok(['/sigd_prueba','/sigd_validacion_f_bartra'].includes(url.pathname));
const pool=new Pool({connectionString:url.toString()});
try{console.log(await new RepositorioMgdAnalytics(pool).refrescarVistasMgd());}finally{await pool.end();}
