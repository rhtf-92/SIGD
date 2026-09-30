/**
 * Renderiza la matriz RBAC de OrganiCore leyéndola del DDL real, para que la
 * visualización no se desincronice del modelo que se despliega.
 *
 * Fuente única: docs/02_organicore/11_organi_matriz_rbac_permisos.sql
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SIN_COLOR = process.env.NO_COLOR !== undefined || process.env.NO_COLOR === '';
const c = (codigo, texto) => (SIN_COLOR ? texto : `\u001b[${codigo}m${texto}\u001b[0m`);
const negrita = (t) => c('1', t);
const verde = (t) => c('32', t);
const rojo = (t) => c('31', t);
const amarillo = (t) => c('33', t);
const tenue = (t) => c('90', t);

const RUTA_DDL = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs/02_organicore/11_organi_matriz_rbac_permisos.sql',
);

export function leerMatriz(ruta = RUTA_DDL) {
  if (!existsSync(ruta)) {
    throw new Error(`No se encontró el DDL de la matriz RBAC en: ${ruta}`);
  }
  const sql = readFileSync(ruta, 'utf8');

  // Cada cat��logo se acota a su propio INSERT: en el resto del archivo hay otros
  // bloques con el mismo shape de comillas que producirían falsos positivos.
  const bloqueRoles = extraerBloque(sql, 'INSERT INTO sigd_org\\.rol_sistema');
  const bloquePermisos = extraerBloque(sql, 'INSERT INTO sigd_org\\.permiso_sistema');

  const roles = [...bloqueRoles.matchAll(/'([A-Z_]+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'/g)].map(
    (m) => ({ codigo: m[1], nombre: m[2], descripcion: m[3] }),
  );

  const permisos = [
    ...bloquePermisos.matchAll(/'([a-z0-9_]+\.[a-z0-9_]+)'\s*,\s*'([^']*)'\s*,\s*'(AREA|SUBAREAS|GLOBAL)'/g),
  ].map((m) => ({ codigo: m[1], descripcion: m[2], alcance: m[3] }));

  // La matriz se lee POR BLOQUE, no línea por línea: el DDL escribe
  //   JOIN ... ON p.codigo IN ( ... )   WHERE r.codigo = 'DIRECTOR'
  // de modo que el rol se declara después de su lista de permisos. Un barrido lineal
  // atribuiría cada lista al rol anterior.
  const matriz = new Map();
  const seccionMatriz = sql.slice(sql.indexOf('4. MATRIZ ROL'));
  for (const bloque of seccionMatriz.split('INSERT INTO sigd_org.rol_permiso').slice(1)) {
    const encontrado = bloque.match(/WHERE r\.codigo\s*=\s*'([A-Z_]+)'/);
    if (!encontrado) continue;
    const codigo = encontrado[1];

    if (/CROSS JOIN\s+sigd_org\.permiso_sistema/.test(bloque)) {
      matriz.set(codigo, new Set(permisos.map((p) => p.codigo)));
      continue;
    }

    const lista = bloque.match(/p\.codigo\s+IN\s*\(([\s\S]*?)\)/);
    const concedidos = new Set();
    if (lista) {
      for (const m of lista[1].matchAll(/'([a-z0-9_]+\.[a-z0-9_]+)'/g)) concedidos.add(m[1]);
    }
    matriz.set(codigo, concedidos);
  }

  return { roles, permisos, matriz };
}

/** Devuelve el texto de un INSERT hasta su cláusula ON CONFLICT. */
function extraerBloque(sql, patron) {
  const inicio = sql.search(new RegExp(patron));
  if (inicio === -1) throw new Error(`No se encontró el bloque ${patron} en el DDL.`);
  const fin = sql.indexOf('ON CONFLICT', inicio);
  return sql.slice(inicio, fin === -1 ? undefined : fin);
}

/** Invariantes de mínimo privilegio declarados en el propio DDL. */
function verificarInvariantes({ roles, permisos, matriz }) {
  const prohibidos = ['permiso.gestionar', 'rol.editar', 'configuracion.editar', 'auditoria.ver'];
  const catalogo = new Set(permisos.map((p) => p.codigo));

  const controles = [
    {
      nombre: 'Los 5 roles canónicos están registrados',
      ok: roles.length === 5,
      detalle: `${roles.length} encontrados`,
    },
    {
      nombre: 'El catálogo tiene 30 o más permisos atómicos',
      ok: permisos.length >= 30,
      detalle: `${permisos.length} permisos`,
    },
    {
      nombre: 'SUPER_ADMIN tiene el catálogo completo (trazabilidad total)',
      ok: (matriz.get('SUPER_ADMIN')?.size ?? 0) === permisos.length,
      detalle: `${matriz.get('SUPER_ADMIN')?.size ?? 0} de ${permisos.length}`,
    },
    {
      nombre: 'ESTUDIANTE no administra la matriz, configuración ni auditoría',
      ok: prohibidos.every((p) => !matriz.get('ESTUDIANTE')?.has(p)),
      detalle: prohibidos.filter((p) => matriz.get('ESTUDIANTE')?.has(p)).join(', ') || 'ninguno',
    },
    {
      nombre: 'Ningún rol concede un permiso inexistente en el catálogo',
      ok: [...matriz.values()].every((set) => [...set].every((p) => catalogo.has(p))),
      detalle: 'integralidad N:M verificada',
    },
    {
      nombre: 'Mínimo privilegio: ningún rol queda sin definir en la matriz',
      ok: roles.every((r) => matriz.has(r.codigo)),
      detalle: `${matriz.size} de ${roles.length} roles`,
    },
  ];

  return controles;
}

function ancho(texto) {
  return [...String(texto)].length;
}

function pad(texto, largo, alinear = 'izq') {
  const dif = Math.max(0, largo - ancho(texto));
  return alinear === 'der' ? ' '.repeat(dif) + texto : texto + ' '.repeat(dif);
}

function render() {
  const datos = leerMatriz();
  const { roles, permisos, matriz } = datos;
  const orden = ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE', 'MESA_PARTES', 'ESTUDIANTE'].filter((r) =>
    roles.some((x) => x.codigo === r),
  );

  const L = 78;
  console.log('');
  console.log(tenue('╔' + '═'.repeat(L) + '╗'));
  console.log(
    tenue('║') + negrita('  MATRIZ RBAC · OrganiCore (SIGD)'.padEnd(L)) + tenue('║'),
  );
  console.log(
    tenue('║') + tenue('  Fuente: docs/02_organicore/11_organi_matriz_rbac_permisos.sql'.padEnd(L)) + tenue('║'),
  );
  console.log(tenue('╚' + '═'.repeat(L) + '╚'));
  console.log('');
  console.log(
    `  ${negrita(String(roles.length))} roles canónicos  ·  ${negrita(String(permisos.length))} permisos atómicos  ·  ${tenue('nomenclatura dominio.accion')}`,
  );
  console.log('');

  // --- Volumen por rol ---
  console.log(negrita('  VOLUMEN POR ROL'));
  console.log(tenue('  ' + '─'.repeat(L - 4)));
  const maxVol = Math.max(...orden.map((r) => matriz.get(r)?.size ?? 0));
  for (const codigo of orden) {
    const total = matriz.get(codigo)?.size ?? 0;
    const barra = '█'.repeat(Math.round((total / maxVol) * 24)).padEnd(24, '░');
    const color = codigo === 'ESTUDIANTE' ? amarillo : verde;
    console.log(`  ${pad(codigo, 13)}${color(barra)} ${pad(String(total), 3, 'der')}`);
  }
  console.log('');

  // --- Rejilla por dominio ---
  const dominios = new Map();
  for (const p of permisos) {
    const [dominio] = p.codigo.split('.');
    if (!dominios.has(dominio)) dominios.set(dominio, []);
    dominios.get(dominio).push(p.codigo);
  }

  const anchoDominio = Math.max(...[...dominios.keys()].map((d) => ancho(d))) + 2;
  const anchoRol = 12;
  const total = anchoDominio + anchoRol * orden.length;

  console.log(negrita('  PERMISOS POR DOMINIO'));
  console.log(tenue('  ' + '─'.repeat(total)));
  const cabecera = '  ' + pad('DOMINIO', anchoDominio);
  console.log(tenue(cabecera + orden.map((r) => pad(r.slice(0, 11), anchoRol, 'centro')).join('')));

  for (const [dominio, codigos] of dominios) {
    console.log(
      '  ' + pad(dominio, anchoDominio) + orden.map((r) => {
        const concedidos = codigos.filter((p) => matriz.get(r)?.has(p)).length;
        const marca = concedidos === 0 ? tenue('·') : concedidos === codigos.length ? verde('●') : amarillo('◐');
        return pad(`${marca} ${concedidos}/${codigos.length}`, anchoRol, 'centro');
      }).join(''),
    );
  }
  console.log('');
  console.log(
    '  ' + tenue('● todos   ◐ parcial   · ninguno'),
  );
  console.log('');

  // --- Verificación de invariantes ---
  console.log(negrita('  INVARIANTES DE MÍNIMO PRIVILEGIO'));
  console.log(tenue('  ' + '─'.repeat(L - 4)));
  let fallos = 0;
  for (const control of verificarInvariantes(datos)) {
    if (!control.ok) fallos++;
    console.log(
      `  ${control.ok ? verde('[OK]  ') : rojo('[FALLA]')} ${pad(control.nombre, 58)}${tenue(control.detalle)}`,
    );
  }
  console.log('');

  // --- Superficie HTTP ---
  console.log(negrita('  ENDPOINTS ASIGNADOS'));
  console.log(tenue('  ' + '─'.repeat(L - 4)));
  console.log(`  GET  /api/v1/admin/roles-permisos   ${tenue('#41')}  ${pad('permiso: rol.ver', 27)}lectura de la matriz`);
  console.log(`  PUT  /api/v1/admin/roles-permisos   ${tenue('#42')}  ${pad('permiso: permiso.gestionar', 27)}escritura + purga de caché`);
  console.log('');

  if (fallos > 0) {
    console.log(rojo(`  ${fallos} invariante(s) incumplido(s).`));
    process.exitCode = 1;
  } else {
    console.log(verde('  Todos los invariantes se cumplen.'));
  }
  console.log('');
}

render();
