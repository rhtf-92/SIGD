/**
 * Prueba funcional extremo a extremo del SIGD.
 *
 * A diferencia de `probe.mts` (que solo sondea codigos de estado), este recorrido
 * EJERCE el flujo real de negocio de punta a punta contra la base de datos:
 *
 *   1. Registro de un ciudadano nuevo (IdentiCore)
 *   2. Autenticacion del ciudadano
 *   3. Consulta del catalogo TUPA y upload presigned a MinIO
 *   4. Radicacion virtual (TramiCore) -> genera CUT y cargo digital
 *   5. Consulta publica del CUT (TramiCore, anonimo)
 *   6. Lectura del expediente en la bandeja (RutaDoc, autenticado)
 *   7. Lectura de analitica ejecutiva (CoreLink)
 *
 * Cada paso verifica el dato devuelto, no solo el codigo HTTP. Si un modulo esta
 * simulado, simulado aparecera en el log.
 *
 * Uso: npx tsx prueba-e2e.mts [baseUrl]
 */
import { createHash } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let passed = 0;
const fallos: string[] = [];

function ok(nombre: string, detalle = ''): void {
  passed += 1;
  console.log(`  OK   ${nombre}${detalle ? ` :: ${detalle}` : ''}`);
}

function fallo(nombre: string, detalle: string): void {
  fallos.push(`${nombre} :: ${detalle}`);
  console.log(`  FALLA ${nombre} :: ${detalle}`);
}

function check(nombre: string, condicion: boolean, detalle: string): boolean {
  if (condicion) ok(nombre, detalle);
  else fallo(nombre, detalle);
  return condicion;
}

interface Respuesta<T> {
  estado: number;
  cuerpo: T;
}

async function pedir<T>(
  metodo: string,
  ruta: string,
  opciones: { cuerpo?: unknown; token?: string } = {},
): Promise<Respuesta<T>> {
  const cabeceras: Record<string, string> = {};
  if (opciones.cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
  if (opciones.token) cabeceras.authorization = `Bearer ${opciones.token}`;

  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  const texto = await r.text();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = texto;
  }
  return { estado: r.status, cuerpo: cuerpo as T };
}

const sello = Date.now().toString().slice(-6);
const dni = `4${sello}01`.slice(0, 8).padEnd(8, '0');

async function main(): Promise<void> {
  console.log(`\n=== PRUEBA FUNCIONAL E2E · ${BASE} ===\n`);

  // -------------------------------------------------------------------------
  console.log('[1] IdentiCore · registro de ciudadano');
  const registro = await pedir<{ idPersona?: string; casillaId?: string; correo?: string }>(
    'POST',
    '/api/v1/auth/registro-ciudadano',
    {
      cuerpo: {
        tipoPersona: 'NATURAL',
        dni,
        nombres: 'Prueba',
        apellidoPaterno: 'Funcional',
        apellidoMaterno: 'Automatica',
        correo: `ciudadano.${sello}@correo.com`,
        celular: '9' + sello.padEnd(8, '0').slice(0, 8),
        ubigeoDistrito: '250101',
        direccion: 'Jr. Probe 123, Pucallpa',
        password: `Clave*${sello}`,
        consentimientoDatos: true,
        aceptaNotificaciones: true,
      },
    },
  );
  const idPersona = registro.cuerpo?.idPersona ?? registro.cuerpo?.personaId;
  check('POST /auth/registro-ciudadano', registro.estado === 201, `HTTP ${registro.estado}`);
  if (!idPersona) {
    fallo('persona creada', `la respuesta no traia idPersona: ${JSON.stringify(registro.cuerpo).slice(0, 200)}`);
    return;
  }
  ok('persona creada', idPersona);
  check(
    'casilla electronica creada',
    typeof registro.cuerpo?.casillaId === 'string',
    String(registro.cuerpo?.casillaId ?? 'ausente'),
  );

  // -------------------------------------------------------------------------
  console.log('\n[2] IdentiCore · autenticacion');
  const login = await pedir<{ tokenAcceso?: string; accessToken?: string }>(
    'POST',
    '/api/v1/auth/login',
    { cuerpo: { identificador: dni, password: `Clave*${sello}` } },
  );
  const token = login.cuerpo?.accessToken ?? login.cuerpo?.tokenAcceso;
  check('POST /auth/login', login.estado === 200 && Boolean(token), `HTTP ${login.estado}`);

  const loginAdmin = await pedir<{ tokenAcceso?: string; accessToken?: string }>('POST', '/api/v1/auth/login', {
    cuerpo: { identificador: 'admin', password: 'Admin2026' },
  });
  const tokenAdmin = loginAdmin.cuerpo?.accessToken ?? loginAdmin.cuerpo?.tokenAcceso;
  check('login administrador', loginAdmin.estado === 200 && Boolean(tokenAdmin), `HTTP ${loginAdmin.estado}`);

  // -------------------------------------------------------------------------
  console.log('\n[3] TramiCore · catalogo TUPA');
  const tupa = await pedir<
    Array<{ id: string; codigo: string; denominacion: string }> | { items?: Array<{ id: string; codigo: string }> }
  >('GET', '/api/v1/tramites/tupa');
  const items = Array.isArray(tupa.cuerpo)
    ? tupa.cuerpo
    : (tupa.cuerpo?.items ?? []);
  check('GET /tramites/tupa', tupa.estado === 200 && items.length > 0, `${items.length} procedimientos`);

  // -------------------------------------------------------------------------
  console.log('\n[4] Storage · carga presigned a MinIO');
  const contenido = Buffer.from(`documento de prueba ${sello}`, 'utf8');
  const sha256 = createHash('sha256').update(contenido).digest('hex');
  const nombreArchivo = `prueba-${sello}.pdf`;

  const presigned = await pedir<{ url?: string; uploadUrl?: string; clave?: string; s3Key?: string }>(
    'POST',
    '/api/v1/storage/presigned-url',
    {
      token,
      cuerpo: { nombreArchivo, tamanoBytes: contenido.length, mimeType: 'application/pdf', sha256Hash: sha256 },
    },
  );
  const urlCarga = presigned.cuerpo?.url ?? presigned.cuerpo?.uploadUrl;
  check('POST /storage/presigned-url', presigned.estado === 200 || presigned.estado === 201, `HTTP ${presigned.estado}`);

  let storagePath: string | undefined;
  if (urlCarga) {
    const cabecerasSubida: Record<string, string> = { 'content-type': 'application/pdf' };
    for (const [nombre, valor] of Object.entries((presigned.cuerpo as Record<string, unknown>).requiredHeaders ?? {})) {
      cabecerasSubida[nombre.toLowerCase()] = String(valor);
    }
    const subida = await fetch(urlCarga, { method: 'PUT', body: contenido, headers: cabecerasSubida });
    check('PUT a MinIO con la URL presigned', subida.ok, `HTTP ${subida.status}`);
    const clave = presigned.cuerpo?.clave ?? presigned.cuerpo?.s3Key;
    if (clave) storagePath = `sigd-expedientes/${clave}`;
  } else {
    fallo('PUT a MinIO con la URL presigned', 'el backend no devolvio url presigned');
  }

  // -------------------------------------------------------------------------
  console.log('\n[5] TramiCore · radicacion virtual');
  const primerTramite = items[0] as { id: string; codigo: string };
  const idTipoTramite = primerTramite.id;

  const radicacion = await pedir<{ cut?: string; cargoDigital?: { codigo?: string; hashSha256?: string } }>(
    'POST',
    '/api/v1/tramites/radicacion-virtual',
    {
      token,
      cuerpo: {
        asunto: `Solicitud de prueba funcional automatizada ${sello}`,
        idTipoTramiteTupa: idTipoTramite,
        idPersona,
        nombreSolicitante: 'Prueba Funcional Automatica',
        correo: `ciudadano.${sello}@correo.com`,
        totalFolios: 3,
        documentos: [
          {
            nombreArchivo,
            contentType: 'application/pdf',
            tamanoBytes: contenido.length,
            hashSha256: sha256,
            ...(storagePath ? { storagePath } : {}),
          },
        ],
      },
    },
  );
  const cut = radicacion.cuerpo?.cut;
  check('POST /tramites/radicacion-virtual', radicacion.estado === 200 || radicacion.estado === 201, `HTTP ${radicacion.estado}`);
  if (!cut) {
    fallo('CUT asignado', `sin CUT: ${JSON.stringify(radicacion.cuerpo).slice(0, 300)}`);
  } else {
    ok('CUT asignado', cut);
    check('cargo digital emitido', Boolean(radicacion.cuerpo?.cargoDigital?.codigo), String(radicacion.cuerpo?.cargoDigital?.codigo ?? 'ausente'));
  }

  // -------------------------------------------------------------------------
  console.log('\n[6] TramiCore · consulta publica del CUT');
  if (cut) {
    const consulta = await pedir<{ cut?: string; estadoTramite?: string; tipoTramite?: string; documentos?: unknown[]; administrado?: { documentoEnmascarado?: string } }>(
      'GET',
      `/api/v1/tramites/consulta-publica/${cut}`,
    );
    check('GET /tramites/consulta-publica/:cut', consulta.estado === 200, `HTTP ${consulta.estado}`);
    check('devuelve el CUT consultado', consulta.cuerpo?.cut === cut, String(consulta.cuerpo?.cut));
    check('devuelve el tipo de tramite', Boolean(consulta.cuerpo?.tipoTramite), String(consulta.cuerpo?.tipoTramite ?? 'ausente'));
    check('devuelve estado del tramite', Boolean(consulta.cuerpo?.estadoTramite), String(consulta.cuerpo?.estadoTramite ?? 'ausente'));
    check('documento enmascarado (no el DNI integro)', /\*+/.test(String(consulta.cuerpo?.administrado?.documentoEnmascarado ?? '')), String(consulta.cuerpo?.administrado?.documentoEnmascarado ?? 'ausente'));
    check('adjuntos registrados', (consulta.cuerpo?.documentos?.length ?? 0) > 0, `${consulta.cuerpo?.documentos?.length ?? 0} documentos`);
  }

  // -------------------------------------------------------------------------
  console.log('\n[7] RutaDoc · bandeja de expedientes');
  const bandeja = await pedir<{ elementos?: unknown[]; datos?: unknown[]; porEstado?: Record<string, number> }>(
    'GET',
    '/api/v1/expedientes?pestana=PENDIENTES&limite=20',
    { token: tokenAdmin },
  );
  check('GET /expedientes?pestana=PENDIENTES', bandeja.estado === 200, `HTTP ${bandeja.estado}`);
  const elementos = bandeja.cuerpo?.elementos ?? bandeja.cuerpo?.datos ?? [];
  check('bandeja no vacia', elementos.length > 0, `${elementos.length} expedientes`);
  const contieneNuevo = JSON.stringify(elementos).includes(cut ?? '@@@@');
  check('el expediente recien radicado aparece en la bandeja', contieneNuevo, cut ?? '');

  // -------------------------------------------------------------------------
  console.log('\n[8] CoreLink · analitica ejecutiva');
  const resumen = await pedir<Record<string, unknown>>('GET', '/api/v1/reportes/dashboard/resumen', { token: tokenAdmin });
  check('GET /reportes/dashboard/resumen', resumen.estado === 200, `HTTP ${resumen.estado}`);
  const tendencias = await pedir<Record<string, unknown>>('GET', '/api/v1/reportes/dashboard/tendencias', { token: tokenAdmin });
  check('GET /reportes/dashboard/tendencias', tendencias.estado === 200, `HTTP ${tendencias.estado}`);

  // -------------------------------------------------------------------------
  console.log('\n[9] IdentiCore · catalogo territorial');
  const ubigeo = await pedir<{ provincias?: Array<{ codigo: string; distritos: unknown[] }>; datos?: unknown[] }>(
    'GET',
    '/api/v1/ubigeo/distritos-ucayali',
  );
  const provincias = ubigeo.cuerpo?.provincias ?? ubigeo.cuerpo?.datos ?? [];
  check('GET /ubigeo/distritos-ucayali', ubigeo.estado === 200 && provincias.length === 4, `${provincias.length} provincias`);

  // -------------------------------------------------------------------------
  console.log('\n[10] OrganiCore · directorio institucional');
  const directorio = await pedir<{ datos?: Array<{ nombre: string; rol: string | null; sede: string | null }> }>(
    'GET',
    '/api/v1/admin/usuarios?pagina=1&limite=50',
    { token: tokenAdmin },
  );
  const usuarios = directorio.cuerpo?.datos ?? [];
  check('GET /admin/usuarios', directorio.estado === 200 && usuarios.length > 0, `${usuarios.length} usuarios`);
  const conSede = usuarios.filter((u) => u.sede !== null).length;
  check('los usuarios resuelven su sede', conSede > 0, `${conSede}/${usuarios.length} con sede`);
  const conRol = usuarios.filter((u) => u.rol !== null).length;
  check('los usuarios resuelven su rol', conRol > 0, `${conRol}/${usuarios.length} con rol`);

  // -------------------------------------------------------------------------
  console.log(`\n=== RESUMEN: ${passed} correctos, ${fallos.length} fallos ===`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exit(fallos.length > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('\nFALLO INESPERADO:', e);
  process.exit(1);
});