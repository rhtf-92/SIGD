# RBAC, TUPA y Mesa de Partes — intervención del 27/10/2026

## Resultado ejecutivo

Se corrigieron cuatro defectos de autorización/clasificación sin cambiar rutas,
DTO, esquema, FSM ni infraestructura. El catálogo funciona en HTTP y en Chrome.
**No se aprueba todavía el RBAC integral ni una radicación E2E nueva**: hay una
asignación ciudadana de lectura global y decisiones documentales pendientes.
No se inició sesión ni se ejecutaron DML, DDL, migraciones, callbacks, workers,
subidas de archivos o funciones generadoras de CUT durante esta intervención.

## Estado inicial y preservación

- Rama `B_JACOBO`; HEAD `bf30d8a0c85e266a86381fb10bf3740a8451c032`.
- Referencia local de main: `8d3bc10`, consultada sin cambiarla.
- Inicio: 152 archivos seguidos con diferencias locales, además de archivos sin
  seguimiento. Se inspeccionaron status, stat y nombres antes de editar.
- Los tres contenedores canónicos PostgreSQL, Redis y MinIO estaban running/healthy.
  Backend 3008 y frontend 5178 estaban detenidos; no había procesos Node del
  prototipo activos identificados. Antigravity estaba abierto; no se interfirió
  con su auditoría de Resoluciones/ReFirma.
- La consulta real utilizó `127.0.0.1:5433/sigd_jacobo_demo`, rol técnico
  `sigd_jacobo_user`, `transaction_read_only=on`. El puerto interno informado por
  PostgreSQL es 5432, publicado como 5433 por Docker. Antes de la prueba no había
  conexiones del backend a esa base en pg_stat_activity.
- El iniciador habitual activa Outbox. Para respetar cero escrituras se utilizó
  `construirApp` original con un Pool forzado a READ ONLY, sin importar server.ts,
  y Vite temporal en los mismos puertos libres 3008/5178. No se cambió su
  configuración permanente. Ambos procesos temporales se cerraron al terminar.

## RBAC real y matriz de acceso

El modelo tiene seis roles vigentes; no existe SUPER_ADMIN en el catálogo
consultado. No hay herencia de permisos por una jerarquía de roles. El árbol de
áreas no implica herencia de facultades. Cada decisión depende de cuenta activa,
asignación vigente, rol vigente, permiso y ámbito. JWT identifica la cuenta;
localStorage sólo controla presentación y puede manipularse.

Permisos observados, sin inferir privilegios por el nombre de rol:

| Rol persistido | Permisos persistidos |
|---|---|
| ADMINISTRADOR | EXPEDIENTE_LEER/GLOBAL, EXPEDIENTE_DERIVAR/AREA, EXPEDIENTE_RESOLVER/AREA, FIRMA_FIRMAR/GLOBAL, ADMIN_USUARIOS/GLOBAL, REPORTE_LEER/GLOBAL |
| DIRECTOR | EXPEDIENTE_LEER/GLOBAL, EXPEDIENTE_RESOLVER/AREA, FIRMA_FIRMAR/GLOBAL, REPORTE_LEER/GLOBAL |
| SECRETARIO | EXPEDIENTE_LEER/GLOBAL, EXPEDIENTE_DERIVAR/AREA, EXPEDIENTE_RESOLVER/AREA |
| ESPECIALISTA | EXPEDIENTE_LEER/GLOBAL, EXPEDIENTE_DERIVAR/AREA, EXPEDIENTE_RESOLVER/AREA |
| MESA_PARTES | EXPEDIENTE_LEER/GLOBAL, EXPEDIENTE_DERIVAR/AREA |
| CIUDADANO | **EXPEDIENTE_LEER/GLOBAL: riesgo de acceso a expedientes ajenos cuando la asignación no tiene área** |

Un permiso GLOBAL con asignación de área no satisface la facultad global de
Administración/Reportes. Un permiso AREA sin área no debe convertirse en global.
La base contiene asignaciones vigentes globales y de área; no se alteraron.

Los nueve dominios funcionales se distribuyen en carpetas existentes; Despacho y
FirmaCore reutilizan DocuCore, Analítica reutiliza CoreLink. No se crearon módulos.

| Dominio/recurso | Roles o condición real | Frontend | Backend | Evidencia y límite |
|---|---|---|---|---|
| M1 IdentiCore: perfil/registro | Cuenta autenticada; registro público con bloqueo de compatibilidad | Login/registro públicos | JWT y cuenta persistida; registro valida modelo | Unitarias; sin login real ni nuevas sesiones |
| M2 OrganiCore: usuarios/roles/auditoría | ADMIN_USUARIOS/GLOBAL y asignación sin área; corresponde a ADMINISTRADOR sólo si está realmente asignado así | Administración exige facultad almacenada | Guarda consulta RBAC vigente | GET real sin JWT/inválido 401; 403 y permiso positivo con dobles |
| M3 TramiCore: TUPA/MPV | Catálogo y consulta pública; radicación exige cuenta activa e identidad coincidente | Wizard público; envío autenticado | TUPA vigente, identidad, clasificación y Storage antes del CUT | Catálogo 200/19 real y Chrome; transacción sólo con dobles |
| M3 Ventanilla/cargo | MESA_PARTES persistido vigente | Ruta limitada a MESA_PARTES | Ahora vuelve a consultar RBAC, no acepta sólo claims | JWT revocado/rol ausente 403 con dobles; GET real sin sesión 401 |
| M4 RutaDoc: Bandeja/Detalle/seguimiento | Titular, EXPEDIENTE_LEER global o área autorizada según consulta | Ruta autenticada | Cuenta/propiedad/permisos; movimientos y FSM originales | Regresiones de áreas, parámetros y JWT; riesgo ciudadano global pendiente |
| M4 Derivación/reversión | Permisos de expediente en su ámbito; reversión admite ADMIN_USUARIOS/GLOBAL explícito | Acciones según respuesta | Corregidos alcance global y bypass por etiqueta en reversión | 9 regresiones nuevas; ninguna mutación real |
| M5 DocuCore: documentos | Titular o permiso documental vigente en ámbito autorizado | Visor protegido por API | Storage ya no concede descarga sólo por ADMINISTRADOR/DIRECTOR | Pruebas de propiedad/denegación; no se descargaron nuevos documentos |
| M6 Despacho/resoluciones | Políticas existentes en resoluciones.controller.ts | Proyector autenticado | Tiene política propia de roles/permisos/áreas | Unitarias de regresión; auditoría paralela pendiente, archivos no editados |
| M7 FirmaCore/CVD | Facultad de firma comprobada; CVD público | Firma limitada; validador público | Guardas y evidencia de firma existentes | Pruebas controladas; ninguna firma ni verificación positiva real nueva |
| M8 CoreLink/Casilla | Cuenta activa y destinatario correspondiente | Portal ciudadano; API protege datos | Aislamiento por destinatario, Outbox original | Regresiones de aislamiento/Outbox; GET sin sesión 401, sin eventos ni lectura mutante |
| M9 Analítica | REPORTE_LEER/GLOBAL sin área | Reportes exige facultad | RBAC persistido | GET sin JWT/inválido 401; positivo/403 con dobles |
| Tesorería | No se encontró un endpoint autónomo de tesorería en el flujo inspeccionado | TUPA informa tasas y menciones de pago | Comprobante documental no acredita por sí mismo pago validado | No se inventó permiso ni operación de cobro |

### Riesgo de datos que impide aprobar aislamiento ciudadano

La relación CIUDADANO → EXPEDIENTE_LEER/GLOBAL existe y hay cuatro asignaciones
ciudadanas vigentes sin área. Las consultas de Bandeja/Detalle/Storage permiten
el alcance global explícito. No es correcto afirmar que todas esas cuentas sólo
ven expedientes propios. La descripción canónica del rol ciudadano indica acceso
restringido a su casilla; requiere decisión institucional sobre esa relación.
Se preparó `scripts/propuesta-restringir-lectura-ciudadano.sql`, **no ejecutado**:
retira únicamente esa relación en `sigd_jacobo_demo`, con claves naturales,
guardas, idempotencia, postcondición y reversión documentada. No elimina el acceso
por titularidad ni modifica permisos de otros roles. Requiere respaldo y aprobación.

## TUPA: estado medido y discrepancias de fuente

- Tabla real `sigd_doc.tipo_tramite_tupa`: 22 filas, 19 SUZ26 vigentes y tres
  TUPA-01/02/03 inactivos. GET `/api/v1/tramites/tipos` devuelve exactamente los
  19 códigos vigentes de PostgreSQL, con `tipos_documentales`.
- Las relaciones reales usan `requisito.requisito_id/tipo_tramite_id/codigo/
  denominacion/obligatorio/orden` y `tipo_documento_requisito.id_relacion/
  requisito_id/tipo_documental_id/condicion_json_pointer`, comprobadas en metadatos.
- **050, 051 y 054 ya tienen COMPROBANTE_PAGO, obligatorio=false.** El antecedente
  de ausencia ya no es vigente. Sus descripciones contienen `menci??n/Tesorer??a`.
  El archivo canónico de carga sigue indicando explícitamente no agregar esas
  asociaciones y sus descripciones sólo mencionan pago en Tesorería.
- No se conoce por esta intervención quién añadió esas relaciones ni con qué
  aprobación. No se borraron, recargaron ni respaldaron como requisitos oficiales.
- **066 conserva FUT y COMPROBANTE_PAGO**, ambos obligatorio=false, sin condición.
  Los cambios preexistentes ya admitían varios archivos con clasificación explícita
  por ID/código. Se preservaron. Las pruebas ejercitan dos adjuntos clasificados y
  su persistencia mediante dobles; no acreditan una radicación real.
- El backend preexistente exige cubrir todos los tipos para la clasificación
  multiarchivo, aunque el catálogo los rotula opcionales. Esa contradicción entre
  regla técnica y obligatoriedad institucional necesita aprobación; no se eliminó
  FUT ni se afirmó que el formulario web lo sustituya.
- Se corrigió que un tipo explícito incorrecto se ignoraba cuando sólo había una
  opción, y que ID y código contradictorios se aceptaban priorizando el ID.
  Ahora fallan antes de generar CUT o insertar registros.
- Fuente local: `backend/carga_tupa_suiza_2026.sql` y
  `frontend/src/data/tupaSuiza2026.ts`, contrastadas con PostgreSQL; el segundo
  contiene conceptos informativos y no reemplaza el catálogo formal.
  El PDF fuente citado, SHA-256
  `377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622`, no se encontró
  entre los PDF del repositorio. Por tanto **no se certifica un nuevo cotejo con
  el PDF oficial**, ni requisitos/tasas inferidos. Defaults de plazo/silencio
  permanecen advertidos como técnicos, no valores institucionales acreditados.
- No se preparó otro DML para 050/051/054: las asociaciones ya existen y no hay
  evidencia suficiente para justificarlas como exigencias documentales. El script
  preexistente `propuesta_remediacion_tupa_fase2b.sql` no fue ejecutado ni modificado.

## Mesa de Partes, CUT y seguimiento

- MPV: original verifica TUPA vigente, identidad, clasificación, archivos y hash;
  coordina expediente DocuCore/TramiCore, adjuntos, folios y asiento dentro de una
  transacción; COMMIT antecede a respuesta exitosa. Regresiones verifican rollback.
- Ventanilla muestra el catálogo formal por API y restringe el acceso a MESA_PARTES.
  **Su contrato actual no incluye `tipo_tramite_id`: la selección TUPA se conserva
  en el asunto, no como asociación formal de expediente a procedimiento.** Por eso
  19 opciones visibles no prueban 19 radicaciones TUPA correctamente asociadas.
  Resolver esa limitación requiere aprobar el contrato; no se modificó el DTO.
- CUT/asiento: funciones y correlativos originales intactos. Pruebas controladas
  aprobadas; las dos pruebas de CUT concurrente con PostgreSQL quedaron omitidas.
- Consulta pública real de EXP-2026-000001: HTTP 200, estado REGISTRADO. La prueba
  verificó ausencia de correo/teléfono y de URLs/claves de descarga en documentos.
  No equivale a una revisión jurídica completa de la publicidad de cada metadato.
- No se creó expediente ni se consumió asiento/CUT; no se procesó Outbox.

## Archivos de esta intervención

| Archivo | Cambio y evidencia |
|---|---|
| backend/src/domains/tramicore/tramites.controller.ts | Reutiliza obtenerAutorizacionCuenta en registro/cargo presencial; mismo payload/rutas |
| backend/src/domains/tramicore/radicacionVirtual.service.ts | Valida clasificación explícita e ID/código concordantes antes del CUT |
| backend/src/core/storage/storage.router.ts | Retira bypass de descarga por etiqueta ADMINISTRADOR/DIRECTOR; conserva propiedad y permisos |
| backend/src/domains/rutadoc/rutadoc.router.ts | GLOBAL exige ámbito global y área nula; reversión no concede por nombre de rol |
| backend/tests/unit/domains/tramicore/ventanilla-registro-acceso.spec.ts | Dobles de roles persistidos, revocación y claims antiguos |
| backend/tests/unit/domains/tramicore/ventanilla-cargo-acceso.spec.ts | Rechazo de lectura del cargo tras retirar rol/cuenta |
| backend/tests/unit/domains/tramicore/radicacion-tupa-ddl.spec.ts | Clasificación inválida/contradictoria rechazada sin CUT ni inserciones |
| backend/tests/unit/app-routes.spec.ts | Regresión de la consulta de autorización documental sin bypass por rol |
| backend/tests/unit/domains/rutadoc/alcance-permisos.spec.ts | Nueve casos de permisos globales/de área y rechazo antes de transacción |
| scratch/e2e_runner/auditar_rbac_tupa_readonly.mts | Harness reproducible, aplicación original/Chrome, conexión READ ONLY, huellas antes/después, cierre de procesos propios |
| scripts/propuesta-restringir-lectura-ciudadano.sql | Propuesta de datos pendiente de aprobación; no ejecutada |
| Este informe | Matriz, resultados, limitaciones y decisiones pendientes |

Los archivos de aplicación ya tenían cambios locales: se aplicaron parches
localizados conservando esas modificaciones. No se editaron frontend, DTO,
Resoluciones, ReFirma, migraciones, scripts de carga ni Compose en esta ejecución.
Hay diferencias **preexistentes** respecto de HEAD en migraciones 02/06/07 y en
Resoluciones/ReFirma; no se certifican como idénticas al commit ni se revirtieron.

## Pruebas ejecutadas

| Tipo | Resultado |
|---|---|
| Línea base backend focalizada | 145 aprobadas, 2 omitidas |
| Regresión backend final, 67 archivos | **1.156 aprobadas, 10 omitidas**, exit 0; 66 archivos aprobados y uno omitido |
| Regresión frontend, 62 archivos | **700 aprobadas, una omitida**, exit 0; warning no fatal de navegación jsdom |
| Typecheck backend y frontend | Aprobados; backend repetido después del último cambio funcional |
| HTTP real con Pool READ ONLY | 16 verificaciones: health/ready/catálogo/consulta pública 200; seis recursos privados sin JWT y con token inválido 401 |
| Chrome real | Wizard paso 2: 19 opciones, selección SUZ26-066, cero errores JS; /ventanilla, /administracion, /reportes y /expedientes redirigen a login |
| Integridad real | Conteos y huellas iguales antes/después en diez tablas de cuentas/sesiones/notificaciones/documentos/expedientes/asientos/CUT/asignaciones/permisos |
| git diff --check | Exit 0 |
| E2E autenticado positivo, radicación, firma, asignación de roles | **No ejecutados**: requieren operaciones persistentes autorizadas; no sustituir por mocks |

Comandos reproducibles de pruebas:

```powershell
# Backend: quitar URLs de integración sólo del proceso de pruebas para impedir DML.
Remove-Item Env:DATABASE_URL,Env:TEST_DATABASE_URL,Env:SIGD_SUIZA_REPRO_DATABASE_URL -ErrorAction SilentlyContinue
cd backend
npm.cmd run typecheck
npm.cmd run test:unit
cd ../frontend
npm.cmd run typecheck
npm.cmd test -- --run
cd ..
# Exige puertos libres y configuración privada ya existente; no inicia workers.
node --import ./backend/node_modules/tsx/dist/loader.mjs scratch/e2e_runner/auditar_rbac_tupa_readonly.mts
git diff --check
```

Logs: `scratch/rbac-regression-backend.log`, `scratch/rbac-regression-frontend.log`.
Estado detallado Git: `scratch/rbac-git-final-status.txt`, `scratch/rbac-git-final-stat.txt`
y `scratch/rbac-git-final-names.txt`. Sin staging, commits, pushes o cambios de rama.
No se abrió conexión a sigd_prueba ni se inició un procedimiento que pudiera
escribir en ella. Huellas verifican las diez tablas indicadas de la demo, no una
comparación histórica completa de todas las bases ni cambios de otras herramientas.

## Decisiones indispensables, por prioridad

1. Aprobar o rechazar retirar CIUDADANO → EXPEDIENTE_LEER/GLOBAL mediante el script
   preparado. Es condición para demostrar aislamiento ciudadano sin contradecir
   los permisos persistidos. No otorgar facultades nuevas para una prueba positiva.
2. Aportar/ratificar la fuente institucional de requisitos 050/051/054 y decidir
   obligatoriedad instrumental de FUT/pago para 066. No hay DML legítimo nuevo
   deducible sólo de una tasa. Conservar las asociaciones mientras se decide.
3. Aprobar una ampliación compatible del contrato presencial para identificar el
   procedimiento formal si se exige esa relación persistida; hoy sólo está en asunto.
4. Sólo tras esas decisiones, autorizar por separado una sesión sintética y una
   radicación identificada en la demo, con sus registros transaccionales, Storage,
   CUT/asiento y trazabilidad. No se presupone aprobación ni se ejecutará por reintento.

Estado de aceptación: catálogo y consultas públicas comprobados realmente;
reparaciones de código y regresiones aprobadas; RBAC integral y radicación
positiva quedan pendientes de las condiciones anteriores.
