# AUDITORÍA DE MÓDULOS SIGD — Rama F_MATIAS (Diagnóstico)

## 1. Mapa del sistema

### 1.1. Endpoints del backend (`app.ts` + routers de `backend/src/domains/*` y `modules/*`)

| # | Módulo / Dominio | Método | Ruta canónica (/api/v1) | Token | Rol / Permiso |
|---|---|---|---|---|---|
| 0 | — app — | GET | /health | No | — |
| 0 | — app — | GET | /ready | No | — (chequea pool) |
| 1 | **IdentiCore Auth** | POST | /api/v1/auth/login | No | — |
| 2 | **IdentiCore Auth** | POST | /api/v1/auth/logout | Refresh token | — |
| 3 | **IdentiCore Auth** | POST | /api/v1/auth/refresh | Refresh token | — |
| 4 | **IdentiCore Auth** | GET | /api/v1/auth/me ; /api/v1/auth/perfil | Sí (Bearer) | activo (cuenta) |
| 5 | **IdentiCore Identicore** | GET | /api/v1/ubigeo/distritos-ucayali?provinciaCodigo=... | No | — |
| 7 | **IdentiCore Casilla** | GET | /api/v1/casilla/notificaciones | Sí | usuario_id en token o null |
| 8 | **IdentiCore Casilla** | GET | /api/v1/casilla/notificaciones/:id | Sí | — |
| 9 | **IdentiCore Casilla** | PATCH | /api/v1/casilla/notificaciones/:id/lectura | Sí | — |
| 10 | **IdentiCore Casilla** | POST | /api/v1/casilla/notificaciones/:id/acuse | Sí | — |
| 11 | **IdentiCore Casilla** | GET | /api/v1/casilla/estadisticas | Sí | — |
| 12 | **IdentiCore Casilla** | GET | /api/v1/casilla/notificaciones/:id/documento/descargar | No | — |
| 13 | **IdentiCore Casilla** | GET | /api/v1/casilla/notificaciones/:id/acuse/descargar | No | — |
| 14 | **TramiCore Tramites** | POST | /api/v1/tramites/radicacion-virtual | No (ciudadano anónimo) | — |
| 15 | **TramiCore Tramites** | POST | /api/v1/tramites/ventanilla-presencial | Sí | — |
| 15c | **TramiCore Tramites** | GET | /api/v1/tramites/tipos ; /api/v1/tramites/tupa | No | — |
| 16 | **TramiCore Tramites** | GET | /api/v1/tramites/consulta-publica/:cut | No | — |
| 20 | **TramiCore Tramites** | GET | /api/v1/tramites/ventanilla/cargo/:cut | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/vigente | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/vigente/tramites | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/vigente/tramites/:codigo | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/versiones | No | — |
| 31 | **Tupa** | POST | /api/v1/tupa/versiones | Sí | ADMINISTRADOR/SUPERADMIN |
| 31 | **Tupa** | GET | /api/v1/tupa/versiones/:id | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/versiones/:id/tramites | No | — |
| 31 | **Tupa** | POST | /api/v1/tupa/versiones/:id/tramites | Sí | ADMIN + borrador |
| 31 | **Tupa** | PATCH | /api/v1/tupa/versiones/:id/tramites/:tramiteId | Sí | ADMIN + borrador |
| 31 | **Tupa** | DELETE | /api/v1/tupa/versiones/:id/tramites/:tramiteId | Sí | ADMIN + borrador |
| 31 | **Tupa** | POST | /api/v1/tupa/versiones/:id/tramites/:tramiteId/requisitos | Sí | ADMIN + borrador |
| 31 | **Tupa** | PATCH | /api/v1/tupa/versiones/:id/tramites/:tramiteId/requisitos/:requisitoId | Sí | ADMIN + borrador |
| 31 | **Tupa** | DELETE | /api/v1/tupa/versiones/:id/tramites/:tramiteId/requisitos/:requisitoId | Sí | ADMIN + borrador |
| 31 | **Tupa** | PUT | /api/v1/tupa/versiones/:id/resolucion (raw PDF) | Sí | ADMIN + borrador |
| 31 | **Tupa** | POST | /api/v1/tupa/versiones/:id/publicar | Sí | ADMIN + borrador + PDF |
| 31 | **Tupa** | GET | /api/v1/tupa/versiones/:id/bitacora | No | — |
| 31 | **Tupa** | GET | /api/v1/tupa/versiones/:id/resolucion | No | — |
| 44-45 | **OrganiCore Organigrama** | GET | /api/v1/admin/organigrama | No | — |
| 44-45 | **OrganiCore Organigrama** | GET | /api/v1/admin/organigrama/arbol | No | — |
| 44-45 | **OrganiCore Organigrama** | POST | /api/v1/admin/organigrama/areas | Sí | — |
| 44-45 | **OrganiCore Organigrama** | PUT | /api/v1/admin/organigrama/areas/:id | Sí | — |
| 46 | **OrganiCore Auditoría** | GET | /api/v1/admin/auditoria/bitacora | No | — (consulta en app.ts directa) |
| 45 | **OrganiCore Roles** | GET | /api/v1/admin/roles-permisos | No | — |
| 47-49 | **OrganiCore Maestras** | GET | /api/v1/admin/maestras/sede | No | — |
| 47-49 | **OrganiCore Maestras** | GET | /api/v1/admin/maestras/tipo-documento | No | — |
| 47-49 | **OrganiCore Maestras** | GET | /api/v1/admin/calendario/feriados | No | — |
| 47-49 | **OrganiCore Usuarios** | GET | /api/v1/admin/usuarios | Sí | — |
| 47-49 | **OrganiCore Usuarios** | POST | /api/v1/admin/usuarios | Sí | — |
| 47-49 | **OrganiCore Usuarios** | PUT | /api/v1/admin/usuarios/:id | Sí | — |
| 31-35 | **DocuCore Validador CVD** | GET | /api/v1/validador/cvd/:codigo | No | — |
| 50 | **DocuCore Resoluciones** | POST | /api/v1/resoluciones | Sí | — |
| 50 | **DocuCore Resoluciones** | GET | /api/v1/resoluciones/:id | Sí | — |
| 55 | **CoreLink SSE** | GET | /api/v1/realtime | Sí | — |
| 56 | **DocuCore/Firma Pendientes** | GET | /api/v1/firma/pendientes ; /api/v1/firmas/cola-firmantes | Sí | facultad_despacho |
| 1 | — alias — | POST | /api/v1/tramite/radicacion | No | — |
| 1 | — alias — | GET | /api/v1/tramites/tupa | No | — |
| 1 | — alias — | GET | /api/v1/admin/organigrama/arbol | No | — |

> Nota: el módulo `OrganiCore Usuarios` se monta tanto en
> `/api/v1/admin/usuarios` como en `/api/v1/usuarios` (app.ts:217-218). El módulo
> `CoreLink Reportes` (`reportes.router.ts`) y `modules/reportes/reportes.routes.ts`
> son **dos routers distintos** que compiten: app.ts monta `reportes.router.ts` (CoreLink)
> en `/api/v1`, mientras `modules/reportes/reportes.routes.ts` (el de KPIs/MGD-PCM) **NO está
> montado** en app.ts — parece no estar conectado.

### 1.2. Pantallas del frontend (`AppRouter.tsx`) → endpoints

| Pantalla | Ruta | Hook/Servicio | Endpoint(s) real | Comentario |
|---|---|---|---|---|
| Home | / | HomePage.tsx | — | Página landing sin API |
| Login | /login | tupaApi.login | POST /auth/login | Conectada |
| Registro | /registro | — | POST /auth/register (verificar) | No sé si existe register |
| Tupa vigente | /tupa | tupaApi.vigente / listarVigente | GET /api/v1/tupa/vigente ; listarVigente | Conectada |
| Tupa gestión | /tupa/gestion | tupaApi.versiones/crearVersion/etc | GET/POST /api/v1/tupa/versiones | Conectada |
| Consulta | /consulta | ConsultaPublicaPage | GET /api/v1/tramites/consulta-publica/:cut | Conectada |
| Casilla | /casilla; casilla-electronica | useCasilla | GET /api/v1/casilla/notificaciones | Conectada |
| Tramite | /tramite | TramitePage | — | Ver detalle |
| Mesa partes virtual | /tramite/mesa-partes-virtual | useTramiteWizard / radicacionVirtual | POST /api/v1/tramites/radicacion-virtual | Conectada |
| Ventanilla presencial | /tramite/ventanilla-presencial | VentanillaPresencialService | POST /api/v1/tramites/ventanilla-presencial ; GET /api/v1/tramites/ventanilla/cargo/:cut | Conectada |
| Admin usuarios | /administracion/usuarios | useUsuariosAdmin | GET/PUT /api/v1/admin/usuarios | Conectada |
| Admin roles | /administracion/roles-permisos | useRbacConfig | GET /api/v1/admin/roles-permisos ; PUT /api/v1/roles/... | Parcial |
| Admin auditoria | /administracion/auditoria | useAuditLogs | GET /api/v1/admin/auditoria/bitacora | Conectada |
| Admin tablas maestras | /administracion/tablas-maestras | useTablasMaestras | — | Ver |
| Admin calendario | /administracion/calendario-laboral | useCalendarioLaboral | GET /api/v1/admin/calendario/feriados | Conectada |
| Admin seguridad | /administracion/seguridad | useSeguridadPolicies | — | Ver |
| Flujo validez legal | /flujo-validez-legal | FlujoValidezLegalPage | — | Ver |
| Firma | /flujo-validez-legal/firma | useRefirmaGateway | GET /api/v1/firma/pendientes | Pendientes (no ejecutar) |
| Visor CVD | /flujo-validez-legal/visor-cvd | VisorCvdPage | GET /api/v1/validador/cvd/:codigo | Conectada |
| Validador público | /validador-cvd | ValidadorPublicoCvdPage | GET /api/v1/validador/cvd/:codigo | Conectada |
| Titulación | /flujos/titulacion | WorkflowAcademicoPage | — | Ver |
| Proyector resoluciones | /flujos/proyector-resoluciones | ProyectorResolucionesPage | POST/GET /api/v1/resoluciones | Ver |
| Expedientes bandeja | /expedientes | useBandejaExpedientes | — | Ver |
| Expediente detalle | /expedientes/:id | useExpedienteActions / useExpedienteTimeline | — | Ver |
| Dashboard ejecutivo | /reportes/dashboard | useDashboardMetrics | GET /api/v1/reportes/dashboard/ejecutivo ; resumen | Conectada |

### 1.3. Código "de mentira" / simulación en frontend (por archivo)

- `frontend/src/config/env.ts`: expone `enableMocks` derivado de `VITE_ENABLE_MOCKS === "true"` (set a "false" en compose). No bloquea nada pero habilita mocks si se activa.
- `frontend/src/services/casillaService.ts`: comentario advierte que `GET /api/v1/casilla/notificaciones` **no estaba registrado en backend B_JAIR** — *pero el router casilla.router.ts existe en esta rama y está montado* (app.ts:184). Métodos `descargarDocumento` y `descargarAcuse` **generan el PDF en el cliente** con plantillas literales (simulación) en vez de usar URLs reales en algunos casos (líneas 159-221).
- `frontend/src/hooks/useRbacConfig.ts`: matriz `permisosIniciales` hardcodeada y `guardarPermisos()` que escribe a localStorage con mensaje "Persistencia preparada para PUT /api/v1/roles/.../permisos" — **el PUT no existe registrado** (app.ts no lo monta).
- `frontend/src/services/kpiCalculator.service.ts`: importado, documenta endpoints pero necesita verificación.
- `frontend/src/services/storageService.ts`: necesita verificación de endpoints storage.
- Corrección basada en inspección de pantalla: sí hay fixtures/estado local en `useBandejaExpedientes`, `useExpedienteTimeline`, `useWorkflowAcademico`, `useSeguridadPolicies`, `useRbacConfig` y `useTablasMaestras`; algunos hooks aplican `setTimeout` solo al activar `VITE_ENABLE_MOCKS`. La página de titulaciones usa su FSM local; `useTitulacionBackend` no la conecta desde esa pantalla.

> Se dejó en espera el módulo firmador: `/flujo-validez-legal/firma` depende de lector DNIe, no se ejecuta.

## 2. Ejecución en Docker (ETAPAS 2c–2e)

Fecha de ejecución: 2026-10-18 (hora Lima). Stack observado: backend, frontend, PostgreSQL, Redis y MinIO arriba. `/health` y `/ready`: HTTP 200. Se usó `backend/scripts/auditoria/auditar.ps1`; los resultados completos están en `backend/scripts/auditoria/resultados.csv` (224 filas, sin claves ni tokens). La salida CSV tiene ruta, método, rol, HTTP, datos/vacío y cuerpo de error.

**Límite de autenticación:** este proceso de PowerShell no heredó `AUD_ADMIN_USER`, `AUD_ADMIN_PWD`, `AUD_CIUD_DNI` ni `AUD_CIUD_PWD`. El script detecta ese caso sin imprimir valores. Las 45 lecturas de la lista principal se ejecutaron anónimas; por rol, las filas ciudadano/admin se registran como no ejecutadas. Las claves no se copiaron a disco ni a este informe. Para completar esas filas, ejecutar el script en un PowerShell que ya tenga las cuatro variables cargadas. Las mutaciones están explícitamente omitidas por seguridad (modificarían registros/estados existentes, publicarían TUPA, crearían expedientes o requieren PDF/carga). Firma y sus colas no fueron llamadas.

### 2.1. Resumen observado

| Grupo de sondas | Resultado | Evidencia |
|---|---:|---|
| 45 GET de la lista principal, sin token | 12 HTTP 200, 21 HTTP 401, 3 HTTP 404, 2 HTTP 400, 7 HTTP 500; los 12 incluyen `/health` y `/ready` | CSV; el endpoint GET no implica que la pantalla guarde datos. |
| Pruebas con ciudadano/admin | 0 ejecutadas; se registraron como no ejecutadas | Variables AUD_* ausentes en el proceso. |
| Mutaciones | No ejecutadas | Motivo específico por endpoint en el CSV. |
| SQL de catálogos | Ubigeo 17 distritos; tipos TUPA 3; versiones TUPA 2; trámites versionados 84; tipos documentales 0 | Conteos agregados en `sigd_auth`, `sigd_doc` y `sigd_tupa`. |
| Persistencia de usuarios de etapas anteriores | admin_auditoria y DNI 87654321/12345678 existen y están activos | SELECT de solo lectura a `sigd_auth.cuenta_usuario` + `persona`; no se leyó password_hash. No se crearon datos nuevos en 2c. |

Las respuestas 200 de `/admin/roles-permisos`, `/admin/maestras/sede` y `/admin/maestras/tipo-documento` no demuestran datos reales: el primero cae a una lista de roles fija cuando falla su SQL; sedes es literal en el handler; el catálogo de tipos documentales está vacío y el handler devuelve un fallback literal. Las dos rutas de descarga de casilla devuelven una URL construida para cualquier ID, sin comprobar que exista una notificación/documento. No se cuentan como módulos con datos persistidos.

### 2.2. Pantallas de AppRouter: evidencia y diagnóstico

“Error” describe la respuesta observada en esta ejecución (anónima o con parámetro deliberadamente inexistente). “No ejecutado” indica que no se simuló una escritura ni se dispuso de token/identificador real. La tabla evalúa la conexión real de pantalla y si la evidencia demuestra datos persistidos.

| Pantalla / ruta | Endpoint(s) | Estado | Evidencia | Causa probable |
|---|---|---|---|---|
| Home `/` | GET `/tupa/vigente`, `/tupa/vigente/tramites` | FUNCIONA CON DATOS REALES | Ambos 200; SQL: 2 versiones y 84 trámites versionados. | Conexión real al TUPA. |
| Login `/login` | POST `/auth/login` | NO EJECUTADO (variables no heredadas) | La ruta está implementada; no se intentó con credenciales inaccesibles para este proceso. | Entorno de ejecución sin AUD_*. |
| Registro `/registro` | POST `/auth/registro-ciudadano` | NO EJECUTADO (ciudadano de prueba ya existe) | El frontend usa el endpoint correcto. No se creó un duplicado ni un segundo DNI. | Crear otra persona no era necesario para el diagnóstico. |
| Acceso denegado / no encontrado | Ninguno | SIN BACKEND O SOLO MOCK | Páginas estáticas. | Pantallas informativas. |
| TUPA vigente `/tupa` | GET `/tupa/vigente`, `/tupa/vigente/tramites` | FUNCIONA CON DATOS REALES | HTTP 200 y filas persistidas. | — |
| Gestión TUPA `/tupa/gestion` | GET `/tupa/versiones` y mutaciones TUPA | ERROR (401: autenticación requerida) | Lecturas protegidas; escrituras no ejecutadas. | Faltó token para probar flujo administrativo; publicación requiere PDF. |
| Consulta `/consulta`, `/consulta/:cut` | GET `/tramites/consulta-publica/:cut` | ERROR (400: CUT de prueba inválido) | Se consultó `AUDITORIA-INEXISTENTE`; no se usó CUT real. | No hay caso de consulta válido seleccionado. |
| Casilla `/casilla`, `/casilla-electronica` | GET notificaciones/estadísticas; PATCH lectura; POST acuse | ERROR (401: token no proporcionado) | Las lecturas protegidas fallan anónimas; mutaciones omitidas. Las rutas de descarga solo arman URL. | Necesita token y notificación real; descarga backend no valida existencia. |
| Selector de trámite `/tramite` | No consume API | SIN BACKEND O SOLO MOCK | Pantalla de navegación/estado local. | No presenta flujo servidor propio. |
| Mesa de partes virtual y alias | GET `/tramites/tipos`; POST `/tramites/radicacion-virtual`; storage | NO EJECUTADO (escritura omitida) | Catálogo: 200 y 3 filas en SQL. Radicar crea expediente y depende de adjunto; no se envió POST. | Persistencia requiere un nuevo expediente y carga real. |
| Ventanilla y alias `/ventanilla` | POST `/tramites/ventanilla-presencial`; GET `/tramites/ventanilla/cargo/:cut` | ERROR (500: columna inexistente) | Log: `column a.numero_asiento does not exist`; código consulta `numero_asiento`, `anio_fiscal`, `cut` y otras columnas ausentes de `sigd_tra.asiento_registro`. POST omitido. | Consulta desfasada del esquema actual. |
| Admin usuarios | GET/POST/PUT `/admin/usuarios` | ERROR (500: columna inexistente) | Log: `column p.id does not exist`; `sigd_auth.persona` tiene `id_persona`. GET se probó anónimo, POST/PUT omitidos. | SQL del repositorio usa nombre de columna que no existe en migración activa. |
| Admin roles-permisos | GET `/admin/roles-permisos`; PUT local anunciado por hook | SIN BACKEND O SOLO MOCK | GET responde fallback fijo porque SQL pide `r.id`, pero `rol_sistema` tiene `rol_id`; `useRbacConfig` guarda en localStorage. No existe PUT `/api/v1/roles/:id/permisos`; tampoco PUT `/api/v1/admin/roles-permisos` que intenta la página (error ignorado). | Contrato frontend/backend incompleto y fallback silencioso. |
| Admin auditoría | GET `/admin/auditoria/bitacora` | ERROR (500: columna inexistente) | Log: `column "creado_en" does not exist` en `sigd_audit.bitacora_auditoria`. | La consulta espera una columna distinta al esquema. |
| Admin tablas maestras | GET áreas/organigrama y catálogos | SIN BACKEND O SOLO MOCK | Organigrama 500: `relation "sigd_org.unidad_organica" does not exist`; hook conserva datos iniciales. Sedes está hardcodeado; tipo documental: SQL cuenta 0 y retorna fallback. Las ediciones son solo estado React. | Modelo real usa `sigd_org.area`; pantalla todavía mezcla fixture y endpoints parciales. |
| Admin calendario | GET `/admin/calendario/feriados` | ERROR (500: sintaxis SQL) | Log: `syntax error at or near "c"` en `calendario.service.ts`. | Consulta construida inválida. |
| Admin seguridad | Ninguno | SIN BACKEND O SOLO MOCK | Hook usa arrays/valores en memoria; guardar y desbloquear no llaman API. | Integración no implementada. |
| Hub validez legal | Ninguno | SIN BACKEND O SOLO MOCK | Solo navegación. | El hub no carga datos. |
| Firma `/flujo-validez-legal/firma` | GET `/firma/pendientes` registrado | NO EJECUTADO (restricción explícita) | No se llamó navegador, pasarela, endpoint de cola ni firma. | Requiere lector/agente Refirma; se deja solo documentado. |
| Visor CVD y validador público | GET `/validador/cvd/:codigo` | ERROR (400: código de prueba inválido) | Se consultó código `AUDITORIA-INEXISTENTE`; no se encontró un código CVD válido para probar documento persistido. | Falta identificador de documento real. |
| Titulación `/flujos/titulacion` | Frontend anuncia GET `/flujos/titulacion/:id` | SIN BACKEND O SOLO MOCK | No hay ruta titulaciones en `app.ts`; la página usa FSM/expediente demo local. | Backend anunciado por `useTitulacionBackend` no está conectado a esa pantalla ni montado. |
| Proyector de resoluciones | Backend POST/GET `/resoluciones`; página actual usa localStorage | SIN BACKEND O SOLO MOCK | `ProyectorResolucionesPage` guarda borrador local. GET de ID inexistente devolvió 500: `relation "sigd_doc.proyecto_resolucion" does not exist`; las escrituras no se ejecutaron. | Página no consume el backend; además la tabla consultada no existe (hay `sigd_doc.resolucion`). |
| Expedientes bandeja/detalle | GET `/expedientes`, `/:id`, trazabilidad, foliación, SLA; POST movimientos | ERROR (401: autenticación requerida) | Rutas existen; lecturas anónimas dieron 401. Las pantallas usan fixtures cuando mocks están activos; `VITE_ENABLE_MOCKS=false` en compose. Acciones mutables omitidas. | No se pudo observar con token ni con ID real. |
| Dashboard `/reportes/dashboard` | GET `/reportes/dashboard/resumen` y equivalentes | ERROR (401: autenticación requerida) | `reportes.router.ts` está montado; API anónima rechaza con `Debe autenticarse o sus credenciales no son válidas.` | Falta sesión para medir datos de vistas/reportes. |

### 2.3. Montajes y registros solicitados

- `backend/src/app.ts` monta `crearRouterReportes(...)` desde `domains/corelink/reportes.router.ts` bajo `/api/v1` (app.ts alrededor de 205). **No monta** `backend/src/modules/reportes/reportes.routes.ts`. Las rutas de ese archivo, por ejemplo `/dashboard-ejecutivo`, `/tiempos-atencion`, `/exportar-pdf` y `/exportar-excel`, no deben considerarse disponibles por el solo hecho de existir.
- No existe handler `PUT /api/v1/roles/:id/permisos`. El hook no lo ejecuta; conserva la matriz en localStorage y muestra ese path como persistencia futura. La página además intenta un PUT a `/api/v1/admin/roles-permisos` y oculta el error.
- Siete rutas respondieron HTTP 500 y sus fallos aparecen en los logs del backend. Errores SQL observados: `column a.numero_asiento does not exist`; `relation "sigd_org.unidad_organica" does not exist` (dos rutas); `column "creado_en" does not exist`; `syntax error at or near "c"`; `column p.id does not exist`; `relation "sigd_doc.proyecto_resolucion" does not exist`.

## 3. Hallazgos priorizados

| Gravedad | Módulo / hallazgo y mensaje | Origen probable | Arreglo sugerido | Esfuerzo |
|---|---|---|---|---|
| Crítica | **Ventanilla/cargo**: HTTP 500; log `column a.numero_asiento does not exist`. | Código consulta columnas ajenas al `sigd_tra.asiento_registro` actual. | Alinear SELECT/DTO con columnas reales (`id_asiento`, `numero_registro`, `fecha_ingreso`, etc.) y agregar prueba de contrato. | Bajo |
| Alta | **Administración/organigrama**: HTTP 500; `relation "sigd_org.unidad_organica" does not exist`. | Servicio consulta una tabla no creada; migración vigente define `sigd_org.area`. | Adaptar consultas y escrituras al modelo real o documentar/migrar un modelo nuevo con respaldo. | Medio |
| Alta | **Administración/usuarios**: HTTP 500; `column p.id does not exist`. | Consulta usa `persona.id`, pero el esquema activo define `persona.id_persona`. | Corregir joins y probar GET antes de exponer PUT/POST. | Bajo |
| Alta | **Administración/calendario**: HTTP 500; `syntax error at or near "c"`. | SQL construido en servicio de calendario inválido. | Capturar consulta generada y corregir sintaxis; cubrir con GET de solo lectura. | Medio |
| Alta | **Administración/auditoría**: HTTP 500; `column "creado_en" does not exist`. | Consulta WORM supone columna distinta a bitácora actual. | Alinear ordenación/proyección con esquema de `sigd_audit.bitacora_auditoria`. | Bajo |
| Alta | **Resoluciones**: HTTP 500; `relation "sigd_doc.proyecto_resolucion" does not exist`. | Servicio consulta tabla no presente; tabla existente es `sigd_doc.resolucion`. | Definir contrato y unificar servicio, migración y pantalla; validar en una futura transacción aislada. | Medio |
| Media | **RBAC**: no existe PUT; guardado local reporta éxito. SQL GET cae a roles de muestra porque `r.id` no existe (`rol_id` sí). | Frontend muestra una persistencia futura y el backend usa un esquema divergente. | Implementar endpoint autorizado con persistencia/validación o retirar mensaje de éxito hasta conectarlo. | Medio |
| Media | **Reportes**: router MGD/PCM `modules/reportes/reportes.routes.ts` no montado; la pantalla usa otro router, que exige token. | Dos routers parecidos y contrato de módulo duplicado. | Elegir router canónico, montarlo explícitamente y verificar consultas contra vistas con rol autorizado. | Medio |
| Media | **Datos de ejemplo**: tablas maestras, seguridad, RBAC, titulaciones y proyector conservan datos locales/fallback. | Frontend sigue operativo aunque fallen o falten integraciones. | Mostrar error de API y bloquear guardados que solo alteran memoria/localStorage; después conectar servicio real. | Medio |
| Media | **Casilla descarga**: endpoint devuelve 200 y URL para cualquier ID; cliente también genera PDFs simulados. | Descarga no valida la notificación ni entrega un archivo persistido. | Validar pertenencia/existencia y servir objeto real de storage; eliminar fallback generador de PDF tras integración. | Medio |

### 3.1. Relación con migraciones parcheadas

La base reporta ejecutadas `01` a `10`, incluidas `02_sigd_auth.sql`, `06_sigd_rut.sql`, `07_sigd_reportes.sql` y `10_sigd_auth_autoregistro.sql`. Los parches conocidos de 02/06/07/10 son cambios locales previos, documentados aparte en `docs/PARCHES_LOCALES_MIGRACIONES.md`; no los cambié. Los 500 descritos arriba pertenecen a consultas/handlers que no coinciden con el esquema efectivamente creado, y **no hay evidencia de que los causaran esos parches**. Ejemplos directos: `persona.id_persona` existe; `sigd_org.area` existe pero `unidad_organica` no; `asiento_registro` carece de `numero_asiento`; `sigd_doc.proyecto_resolucion` no existe. `reportes.routes.ts` sin montar es un problema de wiring del repositorio. No se autenticó el dashboard, así que el comportamiento de las vistas afectadas por 07 queda sin probar con usuario.

### 3.2. Lo que no pude verificar y por qué; datos de prueba

- No se ejecutaron pruebas con ciudadano/admin porque el PowerShell de la herramienta no recibió las variables AUD_*; no se pudo probar acceso autorizado, filas por usuario ni renovar token ante un 401. El script ya hace login y reintenta con login cuando esas variables estén disponibles.
- No se ejecutaron POST/PUT/PATCH/DELETE: las operaciones del mapa afectan cuentas, notificaciones, áreas, calendario, expedientes o versiones TUPA. La razón concreta está en el CSV. Tampoco se ejecutó firma ni se buscó un CVD/CUT válido.
- No se usó navegador, no se detuvieron ni reiniciaron contenedores y no se crearon datos nuevos durante etapa 2c.
- Cuentas existentes para limpiar cuando corresponda: admin `admin_auditoria`; ciudadano DNI `87654321`; ciudadano DNI `12345678`, id `303b9cbd-b4ca-4a13-af52-a293b5d08181` (clave perdida). SQL confirma las tres cuentas activas; no se consultaron hashes. Son datos anteriores a esta etapa y no se borraron.
- ETAPA 2b ya había creado el ciudadano DNI `87654321`; el DNI y correo están consignados en el progreso previo. No hay nuevas filas AUDITORIA creadas en 2c.

## Correcciones (2026-10-19)

La evidencia de esta primera sección quedó ampliada por **Verificación posterior y opciones pendientes** más abajo. Cuando los textos difieran, prevalece la última verificación autenticada con el backend actualizado.

Se reprobaron con el administrador de prueba nuevo las siete rutas que habían dado 500. Los mensajes SQL coincidieron con los errores anteriores: `column a.numero_asiento does not exist`, `relation "sigd_org.unidad_organica" does not exist` (dos rutas), `column "creado_en" does not exist`, `syntax error at or near "c"`, `column p.id does not exist` y `relation "sigd_doc.proyecto_resolucion" does not exist`. No se copiaron credenciales ni tokens al informe.

| Endpoint | Error anterior | Cambio | Evidencia posterior |
|---|---|---|---|
| GET `/api/v1/tramites/ventanilla/cargo/:cut` | `column a.numero_asiento does not exist` | `backend/src/domains/tramicore/tramites.controller.ts`: consulta asiento por expediente y columnas vivas; conserva nombres de respuesta. | Prueba unitaria relacionada pasa (2/2). Falta repetir HTTP y SQL después del cambio; no se afirma resolución funcional. |
| GET `/api/v1/admin/organigrama` y `/arbol` | `relation "sigd_org.unidad_organica" does not exist` | `backend/src/domains/organicore/organigrama.service.ts`: mapea `sigd_org.area` con alias de contrato. | Sin petición HTTP posterior. No se creó área AUDITORIA. |
| GET `/api/v1/admin/auditoria/bitacora` | `column "creado_en" does not exist` | `backend/src/app.ts`: usa `fecha_hora AS creado_en` y ordena por `fecha_hora`. | No se repitió HTTP/SQL después del cambio. |
| GET `/api/v1/admin/calendario/feriados` | `syntax error at or near "c"` | `backend/src/domains/organicore/calendario.service.ts`: agrega `SELECT` a la proyección. | Pruebas relacionadas pasan (59/59). Falta HTTP/SQL posterior. |
| GET `/api/v1/admin/usuarios` | `column p.id does not exist` | Sin cambio. La consulta también depende de columnas/tablas ausentes (`cu.persona_id`, `p.nombres`, `puesto_laboral`, `sede`, etc.); corregir requiere remapear filtros y relaciones y aclarar atributos que el esquema no almacena. | Prueba unitaria existente pasa (49/49), pero no consulta SQL real. Sigue sin corregir. |
| GET `/api/v1/resoluciones/:id` y POST de proyección | `relation "sigd_doc.proyecto_resolucion" does not exist` | Sin cambio. El esquema vivo tiene `sigd_doc.resolucion`, pero no almacena `visto`, considerandos, artículos, HTML ni secuencia anual requerida. | No se ejecutó escritura. No es posible persistir el contrato actual sin una tabla/versionado nuevo o una decisión de reducir el contrato. Se detuvo aquí. |

El catálogo de maestras también se alineó en `backend/src/domains/organicore/tablasMaestras.service.ts` con `area`, `cargo.vigente`, `rol_sistema.vigente` y las columnas reales de permisos. No se comprobó la respuesta HTTP después del cambio.

**Validación disponible:** las pruebas focalizadas pasan (3 archivos, 110 pruebas). La suite completa queda igual que al inicio: 32 archivos pasan, `migration-sync.spec.ts` falla por diferencia de hash preexistente asociada al parche local de 06; 546 pruebas pasan y 2 están omitidas. No se repitieron aún las peticiones HTTP/SQL tras las ediciones, así que el número de 500 remanentes no está verificado.

**No ejecutado / pendiente:** no se actualizó el CSV de 2c. El router `modules/reportes/reportes.routes.ts` sigue sin montarse; no se montó porque la revisión de compatibilidad con el esquema y su respuesta autenticada no se completó. El PUT `/api/v1/roles/:id/permisos` sigue ausente y requiere diseño/contrato y persistencia RBAC. Las pantallas locales ya identificadas (bandeja/timeline de expedientes, seguridad, RBAC, titulaciones y proyector de resoluciones) conservan datos mock/locales aunque haya endpoints separados en el backend; no se afirma que todos esos endpoints ya devuelvan datos utilizables.

**Datos de prueba:** se agregaron el administrador `admin_fix` y un ciudadano nuevo con prefijo `AUDITORIA` por registro real. Limpiar manualmente en una etapa autorizada, junto con los datos previos: `admin_auditoria`, DNI `87654321` y DNI `12345678` (id `303b9cbd-b4ca-4a13-af52-a293b5d08181`). No se borró ningún dato.

## Verificación posterior y opciones pendientes (2026-10-19)

Se usó sesión ADMINISTRADOR (`admin_fix2`). El último lote está al final de `backend/scripts/auditoria/resultados.csv`; `verificar-correcciones.ps1` no guarda claves ni tokens. Se reinició únicamente `backend` porque el proceso `tsx watch` seguía ejecutando el SQL anterior; después se esperó a que `/health` respondiera.

| Endpoint probado | HTTP ahora | Cuerpo / persistencia | Error del log backend |
|---|---:|---|---|
| GET `/api/v1/tramites/ventanilla/cargo/EXP-2026-000001` | 404 | Sin cargo. SQL confirma 0 asientos con expediente vigente; no existe un CUT real que permita validar el cargo con datos. | Sin error SQL; 404 por CUT inexistente. |
| GET `/api/v1/admin/organigrama` y `/arbol` | 200 | Vacío: `sigd_org.area` tiene 0 filas. | Sin error SQL. |
| GET `/api/v1/admin/auditoria/bitacora` | 200 | Con datos; SQL confirma 2 filas y la respuesta usa `fecha_hora AS creado_en`. | Sin error SQL. |
| GET `/api/v1/admin/calendario/feriados` | 200 | Con datos; SQL confirma 2 filas en `sigd_org.calendario_laboral`. | Sin error SQL. |
| GET `/api/v1/admin/tablas-maestras` | 200 | Con datos; SQL confirma 6 roles y 6 permisos. Los catálogos que dependen de tablas inexistentes aparecen no disponibles. | Se corrigió error anterior `bind message supplies 1 parameters, but prepared statement "" requires 0`: el catálogo permisos no tiene `$1`. |
| GET `/api/v1/admin/usuarios` | 500 | Sin cuerpo de datos. | `column p.id does not exist` (SQLSTATE 42703). |

Cambios posteriores: `backend/src/domains/organicore/tablasMaestras.service.ts` omite parámetros cuando la consulta no usa `$1`; `backend/scripts/auditoria/verificar-correcciones.ps1` repite sondas autenticadas y agrega filas al CSV. En GET de usuarios no se cambió el código. Para corregirlo sin alterar lógica hay que acordar el efecto de filtros que no existen en el esquema (sede y bloqueado), el identificador público cambia de entero a UUID, y el PUT comparte DTO/servicio con ese identificador. Eso supera el simple remapeo de columnas pedido; se requiere definir ese contrato antes de editar servicio, DTO y pruebas.

### Resoluciones: opciones, sin cambios de código

La migración `04_sigd_doc.sql` define `sigd_doc.resolucion` con `resolucion_id`, `expediente_id`, `numero_borrador`, `numero_resolucion`, `tipo_resolucion`, `asunto`, `estado`, `fecha_proyeccion`, `proyectado_por`, campos de firma y `creado_en`. La migración `05_sigd_tra.sql` define el expediente operativo en `sigd_tra.expediente`. El servicio, en cambio, necesita persistir el borrador completo y asignar numeración anual.

- **A — tabla aditiva de proyecto + secuencia**: `sigd_doc.proyecto_resolucion` con PK UUID `id_proyecto`; FK `expediente_id` al expediente canónico que se confirme (el esquema documental existente apunta a `sigd_doc.expediente`, mientras la operación usa `sigd_tra.expediente`); `numero_resolucion`, `tipo_resolucion` con CHECK de los tres tipos del servicio, `estado` con valor inicial `BORRADOR`, `visto` texto, `considerandos` JSONB array, `articulos` JSONB array, `distribucion` JSONB array, `html_renderizado` texto, `id_usuario_creador` UUID nullable y `fecha_creacion` timestamptz. Añadir UNIQUE para número generado y para `(expediente_id, numero_resolucion)`. Añadir `sigd_doc.secuencia_anual_resolucion` con PK `anio_fiscal`, contador `secuencia` y `ultimo_numero_generado`, como consulta el servicio. Antes de migrar, aclarar FK/tipo de usuario y transacción atómica del correlativo. **Esfuerzo alto**; riesgo de duplicar expediente/resolución actuales y concurrencia en el contador. Al profesor: justificar la migración aditiva por campos de contenido que no existen; no reemplazar ni alterar tablas existentes.
- **B — limitar el contrato a metadatos de `sigd_doc.resolucion`**: el GET expondría sus nombres existentes, mapeando `resolucion_id`/`numero_borrador`/`fecha_proyeccion`/`proyectado_por` a los alias acordados. El borrador podría guardar asunto/tipo/expediente/estado solamente; no se podrían recuperar `visto`, considerandos, artículos, distribución ni HTML y la secuencia que requiere el servicio no existe. La pantalla actual guarda localStorage y previsualiza el documento; conectarla a metadatos perdería persistencia remota del texto completo, reabrir/editar el borrador y HTML recuperable. **Esfuerzo medio**; riesgo funcional alto y requiere aprobación del contrato. Al profesor: pedir autorización para reducir alcance y documentar explícitamente los campos no persistidos.

### Reportes: compatibilidad de SELECT

Se ejecutaron por separado las consultas representativas de ambos módulos, sin montar ni llamar las rutas de escritura.

- `modules/reportes/reportes.service.ts` (`SQL_RESUMEN` y `SQL_TENDENCIAS`) falla: `sigd_rut.estado_actual_tramite` no existe. La tabla viva es `sigd_rut.estado_actual_expediente`, con `estado_nuevo`, `area_actual_id` y `fecha_hora`; el SQL busca `estado_codigo`. También busca en `movimiento_tramite.estado_destino` y `fecha_movimiento`, cuando el esquema tiene `estado_nuevo` y `fecha_hora`.
- `modules/reportes/reportes.service.ts` (`SQL_CUELLOS`) falla con `column "vencido" does not exist`; la vista tiene `vencidos`. Los otros campos de esa proyección sí constan en la vista.
- La lectura de `modules/reportes` desde `mv_kpis_mgd_mensual` funciona para `periodo, radicados, vtep, tro, teo, tpr_horas_calendario`, pero la vista devolvió 0 filas en esta consulta.
- `domains/corelink/mgdAnalytics.repository.ts` no coincide con el esquema: su SELECT de contadores espera `actualizado_en`, `n_radicados`, `n_atendidos`, `n_archivados`, `n_resueltos`, `n_en_tramite`, `n_observados`, `n_resueltos_dentro_plazo` y `horas_habiles_suma`; la vista tiene `radicados`, `atendidos`, `archivados`, `observados`, `en_tramite`, `universo_teo`, `resueltos`, `resueltos_dentro_de_plazo`, `horas_calendario_totales`, además de VTEP/TPR/TRO/TEO, y no tiene `actualizado_en`.
- CoreLink espera para retención `unidad_organica_id`, `tramo_permanencia_dias_habiles`, `n_expedientes`, promedios y porcentaje. La vista solo tiene `area_id`, `area`, `estado`, `expedientes`, `horas_promedio`, `dias_promedio`, `dias_maximo`, `vencidos` y semáforos. Su SELECT falla en `unidad_organica_id`. `obtenerNombresUnidades()` consulta `sigd_org.unidad_organica`, pero captura el error y degrada a nombres vacíos.

### Suite y conteo de fallos

Suite completa: 32 archivos pasan, 1 falla; 546 pruebas pasan y 2 omitidas. La única falla sigue siendo `migration-sync.spec.ts`, hash esperado `99f845…`, recibido `cccb54…`, conocida antes de estos cambios. Los dos 500 confirmados pendientes son `/api/v1/admin/usuarios` y `/api/v1/resoluciones/:id` (este último corresponde al esquema de proyecto inexistente); las cinco rutas corregidas ya no dieron 500. El cargo dio 404 por falta de un registro real, no por SQL.

## Flujo ciudadano: verificación de radicación (2026-10-19)

Se creó un ciudadano de auditoría mediante `POST /api/v1/auth/registro-ciudadano`, con datos que empiezan por `AUDITORIA`; la clave y los tokens no se registraron en archivos ni en este informe. No se eliminó ni alteró ningún dato previo.

| Paso | HTTP | Evidencia | Resultado |
|---|---:|---|---|
| Registro ciudadano | 201 | La identidad quedó en `sigd_auth.persona` con `id_persona` UUID y cuenta asociada. | Funciona. |
| Login ciudadano | 200 | La respuesta entregó un `accessToken`; no se conserva aquí. | Funciona. |
| GET `/api/v1/tramites/tipos` | 200 | 3 filas; SQL confirma los tres TUPA vigentes de `04_sigd_doc.sql`. | Funciona con datos reales. |
| POST `/api/v1/tramites/radicacion-virtual` con el UUID real de persona | 400 | `Expected number, received nan` para `idPersona`. | El DTO exige entero, pero el esquema vivo usa UUID. |
| POST `/api/v1/tramites/radicacion-virtual` con entero para alcanzar el servicio | 500 | Log: `column "id_tipo_tramite_tupa" does not exist` (SQLSTATE `42703`) en `radicacionVirtual.service.ts`. | No crea expediente. |

La pantalla `frontend/src/pages/tramite/MesaPartesVirtualPage.tsx` no llama a la ruta de radicación: solo demuestra la carga y muestra el texto “API DE PRESIGNED URL REQUERIDA”. Por eso no existe una carga real de PDF desde esa pantalla. Tampoco se creó objeto en MinIO, expediente, CUT, adjunto, notificación, cargo, bandeja ni detalle que permitan continuar con consulta pública o casilla.

No se aplicó una corrección parcial. Además del primer error, `radicacionVirtual.service.ts` consulta `persona.id` y `persona.estado` inexistentes, inserta columnas de otra versión en `sigd_tra.expediente`, y escribe en `sigd_tra.documento_adjunto` y `sigd_tra.cargo_digital`, tablas inexistentes. El esquema vivo separa `sigd_doc.expediente` y `sigd_doc.documento_adjunto`; `sigd_tra.expediente` tiene otro contrato. Resolverlo requiere redefinir el flujo de negocio y el contrato de adjuntos/cargo, no solo un alias de columna.

### Datos maestros faltantes

- `sigd_org.area`, `sigd_org.cargo` y `sigd_org.asignacion_personal` tienen 0 filas. Sus estructuras están en `backend/migraciones/03_sigd_org.sql`, que solo siembra roles, permisos y calendario; no define semillas institucionales para esas entidades.
- `sigd_doc.tipo_documento`, `formulario_version` y `requisito` tienen 0 filas. Sus estructuras están en `backend/migraciones/04_sigd_doc.sql`; el mismo archivo sí siembra los tres tipos TUPA, que existen.
- No existe `sigd_org.sede` en la base ni una creación de esa tabla en las migraciones activas. La sede mostrada por el frontend es un catálogo local y no puede cargarse como semilla sin una migración nueva aprobada.

### Análisis solamente: identificador UUID de usuarios administrativos

El cambio mínimo exigiría **7 archivos**: `backend/src/domains/organicore/dto/usuarioAdmin.dto.ts`, `backend/src/domains/organicore/usuariosAdmin.service.ts`, `backend/tests/unit/domains/organicore/usuariosAdmin.test.ts`, `frontend/src/types/usuarioAdmin.ts`, `frontend/src/services/adminUsuariosService.ts`, `frontend/src/hooks/useUsuariosAdmin.ts` y `frontend/src/pages/administracion/UsuariosPage.tsx`. El controlador y `UserEditModal.tsx` heredan los tipos y no declaran el identificador como número.

Hoy el frontend convierte el ID con `Number(...)`, por lo que descartaría una fila UUID; también construye claves de caché y PUT con `number`. El backend valida `:id` como entero y el servicio recibe `number`. Cambiar solo una capa rompería listado, edición, conmutación de estado o las pruebas de contrato. No se modificó ninguno de esos archivos en esta etapa.


