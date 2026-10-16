/**
 * Sondeo empirico del superficie de endpoints del SIGD.
 * Ejecuta un GET/POST contra cada endpoint canonico y reporta el codigo de estado,
 * distinguiendo 500 (error de servidor, normalmente deriva de esquema) de 4xx (guardas).
 *
 * Uso: npx tsx probe.mts [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

type Caso = { metodo: 'GET' | 'POST'; ruta: string; cuerpo?: unknown; auth?: boolean };

const CASOS: Caso[] = [
  { metodo: 'GET', ruta: '/health' },
  { metodo: 'GET', ruta: '/ready' },

  // IdentiCore / auth
  { metodo: 'GET', ruta: '/api/v1/auth/validar-documento?tipo=DNI&numero=74561238' },
  { metodo: 'GET', ruta: '/api/v1/ubigeo/distritos-ucayali' },

  // Casilla
  { metodo: 'GET', ruta: '/api/v1/casilla/bandeja', auth: true },
  { metodo: 'GET', ruta: '/api/v1/casilla/notificaciones', auth: true },
  { metodo: 'GET', ruta: '/api/v1/casilla/estadisticas', auth: true },

  // Tramites
  { metodo: 'GET', ruta: '/api/v1/tramites/tipos' },
  { metodo: 'GET', ruta: '/api/v1/tramites/tupa' },
  { metodo: 'GET', ruta: '/api/v1/tramites/consulta-publica/EXP-2026-000001' },

  // RutaDoc
  { metodo: 'GET', ruta: '/api/v1/expedientes', auth: true },
  { metodo: 'GET', ruta: '/api/v1/expedientes/clasificador-ccd', auth: true },

  // Reportes / CoreLink
  { metodo: 'GET', ruta: '/api/v1/reportes/dashboard/resumen', auth: true },
  { metodo: 'GET', ruta: '/api/v1/reportes/dashboard/cuellos-botella', auth: true },
  { metodo: 'GET', ruta: '/api/v1/reportes/dashboard/tendencias', auth: true },
  { metodo: 'GET', ruta: '/api/v1/reportes/tiempos-atencion', auth: true },

  // OrganiCore
  { metodo: 'GET', ruta: '/api/v1/admin/usuarios', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/usuarios/lista', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/tablas-maestras', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/calendario-laboral', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/roles-permisos', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/auditoria/bitacora', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/organigrama/arbol', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/maestras/sede', auth: true },
  { metodo: 'GET', ruta: '/api/v1/admin/maestras/tipo-documento', auth: true },

  // DocuCore
  { metodo: 'GET', ruta: '/api/v1/firma/pendientes', auth: true },
  { metodo: 'GET', ruta: '/api/v1/firmas/cola-firmantes', auth: true },

  // Storage
  { metodo: 'POST', ruta: '/api/v1/storage/presigned-url', auth: true, cuerpo: { bucket: 'sigd-expedientes', clave: 'probe.txt', contentType: 'text/plain' } },
];

async function main(): Promise<void> {
  let token = '';
  try {
    const r = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identificador: 'admin', password: 'Admin2026' }),
    });
    const j = (await r.json()) as { tokenAcceso?: string; accessToken?: string; token?: string };
    token = j.tokenAcceso ?? j.accessToken ?? j.token ?? '';
    console.log(`[login] HTTP ${r.status} token=${token ? 'OK' : 'AUSENTE'}`);
  } catch (e) {
    console.log(`[login] FALLO: ${(e as Error).message}`);
  }

  const filas: string[] = [];
  for (const c of CASOS) {
    const cabeceras: Record<string, string> = {};
    if (c.cuerpo) cabeceras['content-type'] = 'application/json';
    if (c.auth && token) cabeceras.authorization = `Bearer ${token}`;

    let estado = 'ERR';
    let detalle = '';
    try {
      const r = await fetch(`${BASE}${c.ruta}`, {
        method: c.metodo,
        headers: cabeceras,
        body: c.cuerpo ? JSON.stringify(c.cuerpo) : undefined,
      });
      estado = String(r.status);
      const texto = await r.text();
      if (r.status >= 400) {
        try {
          const j = JSON.parse(texto) as { title?: string; detail?: string; message?: string; code?: string; error?: string };
          detalle = (j.detail ?? j.message ?? j.error ?? j.title ?? '').toString().slice(0, 110);
          if (j.code) detalle += ` [${j.code}]`;
        } catch {
          detalle = texto.slice(0, 110);
        }
      }
    } catch (e) {
      detalle = (e as Error).message.slice(0, 110);
    }
    filas.push(`${estado.padEnd(4)} ${c.metodo.padEnd(4)} ${c.ruta.padEnd(58)} ${detalle}`);
  }

  console.log('\n' + filas.join('\n'));

  const con500 = filas.filter((f) => f.startsWith('500'));
  console.log(`\n--- Resumen: ${filas.length} casos, ${con500.length} con HTTP 500 ---`);
}

main();